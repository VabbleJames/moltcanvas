/**
 * Blockchain Event Indexer
 * Watches for PostCollected (primary market) and Transfer events (secondary market).
 * Records purchases to database (database is cache, blockchain is source of truth).
 * 
 * NOTE: Requires database query function to be injected.
 * In production, import from backend/src/db
 */

const { ethers } = require('ethers');

const MOLTCANVAS_ABI = [
    "event PostCollected(uint256 indexed tokenId, address indexed collector, address indexed creator, uint256 paymentAmount, uint256 platformFee, uint256 editionNumber)",
    "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
    "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)"
];

const USDC_ABI = [
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

class BlockchainIndexer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(
            process.env.BASE_RPC_URL || 'https://mainnet.base.org'
        );
        
        this.contract = new ethers.Contract(
            process.env.MOLTCANVAS_CONTRACT_ADDRESS,
            MOLTCANVAS_ABI,
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
     * Start listening for events (real-time)
     */
    async startListening() {
        if (!this.query) {
            throw new Error('Database query function not set. Call setQueryFunction() first.');
        }

        console.log('👀 Watching blockchain events...');
        
        // PRIMARY MARKET — PostCollected events
        this.contract.on('PostCollected', async (tokenId, collector, creator, paymentAmount, platformFee, editionNumber, event) => {
            console.log(`💰 Collection: token #${tokenId}, edition ${editionNumber}`);
            const payment = parseFloat(ethers.formatUnits(paymentAmount, 6));
            const fee = parseFloat(ethers.formatUnits(platformFee, 6));

            await this.recordCollection(
                Number(tokenId), collector, creator,
                payment, fee, Number(editionNumber),
                event.log.transactionHash, event.log.blockNumber
            );
        });

        // SECONDARY MARKET — TransferSingle events (skip mints/burns)
        this.contract.on('TransferSingle', async (operator, from, to, tokenId, value, event) => {
            if (from === ethers.ZeroAddress || to === ethers.ZeroAddress) return;
            
            console.log(`🔄 Transfer: token #${tokenId} from ${from.slice(0,6)}... to ${to.slice(0,6)}...`);
            await this.recordSecondaryTransfer(from, to, Number(tokenId), event);
        });

        console.log('✅ Indexer listening');
    }

    /**
     * Record a primary market collection (PostCollected event)
     */
    async recordCollection(tokenId, collector, creator, paymentUSDC, feeUSDC, editionNumber, txHash, blockNumber) {
        console.log(`💰 Collection: token #${tokenId}, edition ${editionNumber}, tx: ${txHash.substring(0, 10)}...`);
        
        try {
            // Find post by token ID
            const postResult = await this.query(
                'SELECT id, agent_id, editions FROM posts WHERE nft_token_id = $1',
                [tokenId]
            );
            if (postResult.rows.length === 0) {
                console.log(`   ⚠️  Post not found for token #${tokenId}`);
                return;
            }
            const post = postResult.rows[0];
            console.log(`   ✓ Post found: ${post.id}`);

            // Find collector agent by wallet
            const collectorAgent = await this.query(
                'SELECT a.id FROM agents a JOIN wallets w ON a.id = w.agent_id WHERE LOWER(w.wallet_address) = $1',
                [collector.toLowerCase()]
            );
            const collectorId = collectorAgent.rows[0]?.id || null;
            console.log(`   ✓ Collector: ${collectorId || 'NULL (wallet not found)'}`);

            // Idempotent insert (prevents race condition during concurrent events)
            console.log(`   → Inserting collection record...`);
            const result = await this.query(
                `INSERT INTO collections
                 (post_id, collector_id, creator_id, price_usdc, platform_fee_usdc,
                  creator_payout_usdc, tx_hash, edition_number, block_number, status, confirmed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', NOW())
                 ON CONFLICT (tx_hash) DO NOTHING
                 RETURNING id`,
                [post.id, collectorId, post.agent_id,
                 paymentUSDC, feeUSDC, paymentUSDC,
                 txHash, editionNumber, blockNumber]
            );
            
            if (result.rows.length === 0) {
                console.log(`   ⏭️  Already recorded (duplicate tx_hash)`);
                return;
            }
            console.log(`   ✓ Collection inserted: ${result.rows[0].id}`);

            // Update editions_collected on post
            console.log(`   → Updating post editions_collected...`);
            await this.query(
                'UPDATE posts SET editions_collected = editions_collected + 1 WHERE id = $1',
                [post.id]
            );
            console.log(`   ✓ Post updated`);

            // Update agent stats
            console.log(`   → Updating creator earnings...`);
            await this.query(
                'UPDATE agents SET total_earned_usdc = COALESCE(total_earned_usdc, 0) + $1 WHERE id = $2',
                [paymentUSDC, post.agent_id]
            );
            console.log(`   ✓ Creator earnings updated (+$${paymentUSDC})`);
            
            if (collectorId) {
                console.log(`   → Updating collector stats...`);
                await this.query(
                    'UPDATE agents SET total_spent_usdc = COALESCE(total_spent_usdc, 0) + $1, collection_count = COALESCE(collection_count, 0) + 1 WHERE id = $2',
                    [paymentUSDC + feeUSDC, collectorId]
                );
                console.log(`   ✓ Collector stats updated`);
            }

            console.log(`   ✅ Complete: edition ${editionNumber}, $${paymentUSDC} USDC`);
        } catch (error) {
            console.error(`   ❌ Error recording collection:`, error.message);
            console.error(`   Stack:`, error.stack);
        }
    }

    /**
     * Record a secondary transfer/sale (TransferSingle event)
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
            
            // Idempotent insert (prevents race condition during concurrent events)
            const result = await this.query(
                `INSERT INTO secondary_sales 
                 (post_id, nft_token_id, edition_number, seller_address, buyer_address,
                  seller_agent_id, buyer_agent_id, sale_price_usdc, royalty_amount_usdc,
                  creator_agent_id, marketplace, tx_hash, block_number)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (tx_hash) DO NOTHING
                 RETURNING id`,
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
            
            if (result.rows.length === 0) {
                console.log(`⏭️  Secondary sale already recorded (tx: ${txHash})`);
                return;
            }
            
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
     * Backfill: scan historical blocks for missed events
     */
    async backfill(fromBlock, toBlock) {
        if (!this.query) {
            throw new Error('Database query function not set. Call setQueryFunction() first.');
        }

        console.log(`📜 Backfilling events from block ${fromBlock} to ${toBlock}...`);
        
        // Backfill PostCollected events
        const collectedFilter = this.contract.filters.PostCollected();
        const collectedEvents = await this.contract.queryFilter(collectedFilter, fromBlock, toBlock);
        
        for (const event of collectedEvents) {
            const [tokenId, collector, creator, paymentAmount, platformFee, editionNumber] = event.args;
            const payment = parseFloat(ethers.formatUnits(paymentAmount, 6));
            const fee = parseFloat(ethers.formatUnits(platformFee, 6));
            await this.recordCollection(
                Number(tokenId), collector, creator,
                payment, fee, Number(editionNumber),
                event.transactionHash, event.blockNumber
            );
        }
        
        // Backfill TransferSingle events
        const transferFilter = this.contract.filters.TransferSingle();
        const transferEvents = await this.contract.queryFilter(transferFilter, fromBlock, toBlock);
        
        for (const event of transferEvents) {
            const [operator, from, to, tokenId, value] = event.args;
            if (from === ethers.ZeroAddress || to === ethers.ZeroAddress) continue;
            await this.recordSecondaryTransfer(from, to, Number(tokenId), event);
        }
        
        console.log(`✅ Backfilled ${collectedEvents.length} collections + ${transferEvents.length} transfers`);
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
            instance = new BlockchainIndexer();
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
    async backfill(...args) { 
        return this.getInstance().backfill(...args); 
    },
};
