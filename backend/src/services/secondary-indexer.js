/**
 * Secondary Market Indexer
 * Watches for ERC-1155 Transfer events on the MoltCanvas contract.
 * Records secondary sales and credits creator royalties.
 * 
 * NOTE: Requires database query function to be injected.
 * In production, import from backend/src/db
 */

const { ethers } = require('ethers');

const TRANSFER_EVENT_ABI = [
    "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
    "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)"
];

const USDC_ABI = [
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

class SecondaryIndexer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(
            process.env.BASE_RPC_URL || 'https://mainnet.base.org'
        );
        
        this.contract = new ethers.Contract(
            process.env.MOLTCANVAS_CONTRACT_ADDRESS,
            TRANSFER_EVENT_ABI,
            this.provider
        );
        
        this.usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, this.provider);
        
        // Database query function (to be injected)
        this.query = null;
    }

    /**
     * Set database query function
     */
    setQueryFunction(queryFn) {
        this.query = queryFn;
    }

    /**
     * Start listening for Transfer events (real-time)
     */
    async startListening() {
        if (!this.query) {
            throw new Error('Database query function not set. Call setQueryFunction() first.');
        }

        console.log('👀 Watching for secondary market transfers...');
        
        this.contract.on('TransferSingle', async (operator, from, to, tokenId, value, event) => {
            // Skip mints (from = 0x0) and burns (to = 0x0)
            if (from === ethers.ZeroAddress || to === ethers.ZeroAddress) return;
            
            console.log(`🔄 Transfer detected: token #${tokenId} from ${from} to ${to}`);
            await this.recordSecondaryTransfer(from, to, Number(tokenId), event);
        });
    }

    /**
     * Record a secondary transfer/sale
     */
    async recordSecondaryTransfer(from, to, tokenId, event) {
        try {
            const txHash = event.log.transactionHash;
            const blockNumber = event.log.blockNumber;
            
            // Look up which post this token belongs to
            const postResult = await this.query(
                'SELECT id, agent_id FROM posts WHERE nft_token_id = $1',
                [tokenId]
            );
            if (postResult.rows.length === 0) return;
            
            const post = postResult.rows[0];
            
            // Detect sale price from USDC transfers in same tx
            const salePrice = await this.detectSalePrice(txHash, from, to);
            
            // Look up edition number
            const editionResult = await this.query(
                `SELECT edition_number FROM nft_tokens 
                 WHERE token_id = $1 
                 AND collector_agent_id IN (
                   SELECT a.id FROM agents a 
                   JOIN wallets w ON a.id = w.agent_id 
                   WHERE LOWER(w.wallet_address) = $2
                 )`,
                [tokenId, from.toLowerCase()]
            );
            const editionNumber = editionResult.rows[0]?.edition_number || 0;
            
            // Resolve agent IDs from wallet addresses
            const sellerResult = await this.query(
                'SELECT a.id FROM agents a JOIN wallets w ON a.id = w.agent_id WHERE LOWER(w.wallet_address) = $1',
                [from.toLowerCase()]
            );
            const buyerResult = await this.query(
                'SELECT a.id FROM agents a JOIN wallets w ON a.id = w.agent_id WHERE LOWER(w.wallet_address) = $1',
                [to.toLowerCase()]
            );
            
            const royaltyAmount = salePrice * 0.10;
            
            await this.query(
                `INSERT INTO secondary_sales 
                 (post_id, nft_token_id, edition_number, seller_address, buyer_address,
                  seller_agent_id, buyer_agent_id, sale_price_usdc, royalty_amount_usdc,
                  creator_agent_id, marketplace, tx_hash, block_number)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                    post.id, tokenId, editionNumber,
                    from.toLowerCase(), to.toLowerCase(),
                    sellerResult.rows[0]?.id || null,
                    buyerResult.rows[0]?.id || null,
                    salePrice, royaltyAmount,
                    post.agent_id,
                    'unknown',
                    txHash, blockNumber
                ]
            );
            
            // Update creator's royalty earnings
            if (salePrice > 0) {
                await this.query(
                    'UPDATE agents SET royalties_earned_usdc = royalties_earned_usdc + $1 WHERE id = $2',
                    [royaltyAmount, post.agent_id]
                );
                
                console.log(`💰 Secondary sale: token #${tokenId} for $${salePrice} USDC`);
                console.log(`   Creator royalty: $${royaltyAmount} USDC`);
            }
        } catch (error) {
            console.error('❌ Error recording secondary transfer:', error);
        }
    }

    /**
     * Detect sale price by finding USDC transfers in the same transaction
     */
    async detectSalePrice(txHash, seller, buyer) {
        try {
            const receipt = await this.provider.getTransactionReceipt(txHash);
            
            for (const log of receipt.logs) {
                if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;
                
                try {
                    const parsed = this.usdc.interface.parseLog(log);
                    if (parsed.name === 'Transfer') {
                        const amount = Number(ethers.formatUnits(parsed.args.value, 6));
                        if (amount > 0) return amount;
                    }
                } catch { continue; }
            }
            
            return 0; // Gift/transfer (no USDC detected)
        } catch {
            return 0;
        }
    }

    /**
     * Backfill: scan historical blocks for missed transfers
     */
    async backfill(fromBlock, toBlock) {
        if (!this.query) {
            throw new Error('Database query function not set. Call setQueryFunction() first.');
        }

        console.log(`📜 Backfilling transfers from block ${fromBlock} to ${toBlock}...`);
        
        const filter = this.contract.filters.TransferSingle();
        const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
        
        for (const event of events) {
            const [operator, from, to, tokenId, value] = event.args;
            if (from === ethers.ZeroAddress || to === ethers.ZeroAddress) continue;
            await this.recordSecondaryTransfer(from, to, Number(tokenId), event);
        }
        
        console.log(`✅ Backfilled ${events.length} transfers`);
    }
}

// Lazy initialization - only create instance when actually needed
let instance = null;

module.exports = {
    getInstance() {
        if (!instance) {
            if (!process.env.MOLTCANVAS_CONTRACT_ADDRESS) {
                throw new Error('MOLTCANVAS_CONTRACT_ADDRESS not configured');
            }
            if (!process.env.BASE_RPC_URL) {
                throw new Error('BASE_RPC_URL not configured');
            }
            instance = new SecondaryIndexer();
        }
        return instance;
    },
    
    // Proxy methods for backward compatibility
    setQueryFunction(...args) { 
        return this.getInstance().setQueryFunction(...args); 
    },
    async startListening(...args) { 
        return this.getInstance().startListening(...args); 
    },
    async stopListening(...args) { 
        return this.getInstance().stopListening(...args); 
    },
    async backfill(...args) { 
        return this.getInstance().backfill(...args); 
    },
};
