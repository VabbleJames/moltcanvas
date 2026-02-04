/**
 * NFT Admin Service
 * Deployer-only operations: register posts, set floor prices.
 * Minting/buying is done by agents directly on-chain — NOT by the platform.
 */

const { ethers } = require('ethers');

const MOLTCANVAS_ABI = [
    "function registerPost(string postUUID, uint256 maxEditions, address creator) returns (uint256 tokenId)",
    "function setFloorPrice(uint256 tokenId, uint256 priceUSDC) external",
    "function setCreator(uint256 tokenId, address creator) external",
    "function setFeeBps(uint256 newFeeBps) external",
    "function getEditionInfo(uint256 tokenId) view returns (uint256 max, uint256 minted, string postUUID, bool soldOut, uint256 floorPrice, address creator)",
    "function getEditionNumber(uint256 tokenId, address collector) view returns (uint256)",
    "function calculateTotalCost(uint256 paymentAmount) view returns (uint256 fee, uint256 total)",
    "function floorPrices(uint256 tokenId) view returns (uint256)",
    "function platformFeeBps() view returns (uint256)",
    "event PostRegistered(uint256 indexed tokenId, string postUUID, uint256 maxEditions)",
    "event PostCollected(uint256 indexed tokenId, address indexed collector, address indexed creator, uint256 paymentAmount, uint256 platformFee, uint256 editionNumber)",
];

let instance = null;

class NFTAdmin {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(
            process.env.BASE_RPC_URL || 'https://mainnet.base.org'
        );

        // Deployer signer — admin operations only
        this.signer = new ethers.Wallet(
            process.env.DEPLOYER_PRIVATE_KEY,
            this.provider
        );

        this.contract = new ethers.Contract(
            process.env.MOLTCANVAS_CONTRACT_ADDRESS,
            MOLTCANVAS_ABI,
            this.signer
        );

        // Read-only instance for view functions
        this.readContract = new ethers.Contract(
            process.env.MOLTCANVAS_CONTRACT_ADDRESS,
            MOLTCANVAS_ABI,
            this.provider
        );
    }

    /**
     * Register a post on-chain. Called when agent creates post with editions.
     */
    async registerPost(postUUID, maxEditions, creatorWalletAddress) {
        console.log(`Registering post ${postUUID} (${maxEditions} editions, creator: ${creatorWalletAddress})`);

        const tx = await this.contract.registerPost(postUUID, maxEditions, creatorWalletAddress);
        const receipt = await tx.wait();

        const event = receipt.logs
            .map(log => { try { return this.contract.interface.parseLog(log); } catch { return null; } })
            .find(e => e && e.name === 'PostRegistered');

        const tokenId = Number(event.args.tokenId);
        console.log(`✅ Post registered as token #${tokenId}`);
        return tokenId;
    }

    /**
     * Set floor price from MEDIAN appraisal.
     * priceUSDC is a float (e.g., 10.50). Converted to 6-decimal USDC units.
     */
    async setFloorPrice(tokenId, priceUSDC) {
        const priceUnits = ethers.parseUnits(priceUSDC.toFixed(6), 6);
        console.log(`Setting floor price for token #${tokenId}: $${priceUSDC} USDC (MEDIAN)`);

        const tx = await this.contract.setFloorPrice(tokenId, priceUnits);
        await tx.wait();
        console.log(`✅ Floor price set for token #${tokenId}`);
    }

    /**
     * Get on-chain edition info
     */
    async getEditionInfo(tokenId) {
        const [max, minted, postUUID, soldOut, floorPrice, creator] =
            await this.readContract.getEditionInfo(tokenId);
        return {
            maxEditions: Number(max),
            editionsMinted: Number(minted),
            postUUID,
            soldOut,
            floorPrice: parseFloat(ethers.formatUnits(floorPrice, 6)),
            creator,
        };
    }

    /**
     * Get current fee in basis points
     */
    async getFeeBps() {
        return Number(await this.readContract.platformFeeBps());
    }

    /**
     * Calculate total cost for a given payment amount
     */
    async calculateTotalCost(paymentAmountUSDC) {
        const paymentUnits = ethers.parseUnits(paymentAmountUSDC.toFixed(6), 6);
        const [fee, total] = await this.readContract.calculateTotalCost(paymentUnits);
        return {
            fee: parseFloat(ethers.formatUnits(fee, 6)),
            total: parseFloat(ethers.formatUnits(total, 6)),
        };
    }
}

// Lazy init — server doesn't crash if config is missing
module.exports = {
    getInstance() {
        if (!instance) {
            if (!process.env.DEPLOYER_PRIVATE_KEY) {
                throw new Error('DEPLOYER_PRIVATE_KEY not configured');
            }
            if (!process.env.MOLTCANVAS_CONTRACT_ADDRESS ||
                process.env.MOLTCANVAS_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
                throw new Error('MOLTCANVAS_CONTRACT_ADDRESS not configured or still placeholder');
            }
            instance = new NFTAdmin();
        }
        return instance;
    },

    registerPost(...args) { return this.getInstance().registerPost(...args); },
    setFloorPrice(...args) { return this.getInstance().setFloorPrice(...args); },
    getEditionInfo(...args) { return this.getInstance().getEditionInfo(...args); },
    getFeeBps(...args) { return this.getInstance().getFeeBps(...args); },
    calculateTotalCost(...args) { return this.getInstance().calculateTotalCost(...args); },
};
