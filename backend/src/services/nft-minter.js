/**
 * NFT Minting Service
 * Registers posts on-chain and mints edition NFTs to collectors.
 * Platform wallet is the only signer (onlyOwner on contract).
 */

const { ethers } = require('ethers');

const MOLTCANVAS_ABI = [
    "function registerPost(string postUUID, uint256 maxEditions) returns (uint256 tokenId)",
    "function mintEdition(uint256 tokenId, address collector, uint256 pricePaidCents) returns (uint256 editionNumber)",
    "function setCreator(uint256 tokenId, address creator) external",
    "function getEditionInfo(uint256 tokenId) view returns (uint256 max, uint256 minted, string postUUID, bool soldOut)",
    "function getEditionNumber(uint256 tokenId, address collector) view returns (uint256)",
    "event PostRegistered(uint256 indexed tokenId, string postUUID, uint256 maxEditions)",
    "event EditionMinted(uint256 indexed tokenId, address indexed collector, uint256 editionNumber, uint256 pricePaidCents)"
];

class NFTMinter {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(
            process.env.BASE_RPC_URL || 'https://mainnet.base.org'
        );
        
        this.signer = new ethers.Wallet(
            process.env.PLATFORM_PRIVATE_KEY,
            this.provider
        );
        
        this.contract = new ethers.Contract(
            process.env.MOLTCANVAS_CONTRACT_ADDRESS,
            MOLTCANVAS_ABI,
            this.signer
        );
    }

    /**
     * Register a post on-chain, get a token ID back.
     * Call this when a post is created with editions.
     */
    async registerPost(postUUID, maxEditions, creatorWalletAddress) {
        console.log(`📝 Registering post ${postUUID} on-chain (${maxEditions} editions)...`);
        
        const tx = await this.contract.registerPost(postUUID, maxEditions);
        const receipt = await tx.wait();
        
        // Extract token ID from PostRegistered event
        const event = receipt.logs
            .map(log => {
                try { return this.contract.interface.parseLog(log); }
                catch { return null; }
            })
            .find(e => e && e.name === 'PostRegistered');
        
        const tokenId = Number(event.args.tokenId);
        
        // Set creator address for royalty payments
        if (creatorWalletAddress) {
            const royaltyTx = await this.contract.setCreator(tokenId, creatorWalletAddress);
            await royaltyTx.wait();
            console.log(`✅ Royalties for token #${tokenId} → ${creatorWalletAddress}`);
        }
        
        console.log(`✅ Post registered as token #${tokenId}`);
        return tokenId;
    }

    /**
     * Mint an edition NFT to a collector's wallet.
     * Call this after verifying USDC payment.
     */
    async mintEdition(tokenId, collectorWalletAddress, pricePaidCents) {
        console.log(`🎨 Minting token #${tokenId} to ${collectorWalletAddress}...`);
        
        const tx = await this.contract.mintEdition(
            tokenId,
            collectorWalletAddress,
            pricePaidCents
        );
        const receipt = await tx.wait();
        
        const event = receipt.logs
            .map(log => {
                try { return this.contract.interface.parseLog(log); }
                catch { return null; }
            })
            .find(e => e && e.name === 'EditionMinted');
        
        const editionNumber = Number(event.args.editionNumber);
        
        console.log(`✅ Minted edition ${editionNumber} to ${collectorWalletAddress}`);
        
        return {
            editionNumber,
            mintTxHash: receipt.hash,
            mintBlockNumber: receipt.blockNumber,
        };
    }

    /**
     * Check edition availability on-chain
     */
    async getEditionInfo(tokenId) {
        const [max, minted, postUUID, soldOut] = await this.contract.getEditionInfo(tokenId);
        return {
            maxEditions: Number(max),
            editionsMinted: Number(minted),
            postUUID,
            soldOut,
        };
    }
}

// Lazy initialization - only create instance when actually needed
let instance = null;

module.exports = {
    getInstance() {
        if (!instance) {
            if (!process.env.PLATFORM_PRIVATE_KEY) {
                throw new Error('PLATFORM_PRIVATE_KEY not configured');
            }
            if (!process.env.MOLTCANVAS_CONTRACT_ADDRESS) {
                throw new Error('MOLTCANVAS_CONTRACT_ADDRESS not configured');
            }
            if (!process.env.BASE_RPC_URL) {
                throw new Error('BASE_RPC_URL not configured');
            }
            instance = new NFTMinter();
        }
        return instance;
    },
    
    // Proxy methods for backward compatibility
    async registerPost(...args) { 
        return this.getInstance().registerPost(...args); 
    },
    async mintEdition(...args) { 
        return this.getInstance().mintEdition(...args); 
    },
    async getEditionInfo(...args) { 
        return this.getInstance().getEditionInfo(...args); 
    },
};
