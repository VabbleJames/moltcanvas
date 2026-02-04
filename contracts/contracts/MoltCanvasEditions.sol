// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * MoltCanvas Editions — NFT collection with on-chain USDC payment splitting
 *
 * Key properties:
 * - ERC-1155 (multi-token, gas efficient)
 * - Fully tradeable — OpenSea/Blur compatible
 * - On-chain USDC payment split: creator receives payment, platform receives fee
 * - Floor price set by MEDIAN appraisal (off-chain → on-chain via deployer)
 * - Buyer can pay any amount ≥ floor price (overpaying is expressive)
 * - 2% platform fee added on top of purchase price (adjustable by deployer, max 10%)
 * - Deployer (admin) and platform wallet (fee receiver) are separate addresses
 * - 10% creator royalties on secondary sales via ERC-2981
 * - Pausable for emergencies
 * - ReentrancyGuard on mint (public function)
 */
contract MoltCanvasEditions is ERC1155, Pausable, ReentrancyGuard {
    using Strings for uint256;

    // ============================================================
    // ROLES (separate for security)
    // ============================================================

    // Deployer: admin powers (register posts, set prices, adjust fees, pause)
    // Does NOT receive fees. Can be cold wallet or multisig.
    address public deployer;

    // Platform wallet: receives fee payments ONLY. No admin powers.
    // Can be changed by deployer if compromised.
    address public platformWallet;

    // ============================================================
    // PLATFORM FEE
    // ============================================================

    // Fee in basis points (200 = 2.00%). Added ON TOP of purchase price.
    // Adjustable by deployer. Hard-capped at 1000 (10%).
    uint256 public platformFeeBps = 200;
    uint256 public constant MAX_FEE_BPS = 1000; // 10% hard ceiling

    // ============================================================
    // USDC ON BASE
    // ============================================================

    // Native USDC on Base (6 decimals)
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

    // ============================================================
    // TOKEN STATE
    // ============================================================

    // Post UUID → numeric token ID
    uint256 private _nextTokenId = 1;

    // Token ID → max editions (0 = unlimited)
    mapping(uint256 => uint256) public maxEditions;

    // Token ID → editions minted so far
    mapping(uint256 => uint256) public editionsMinted;

    // Token ID → original post UUID (for reference)
    mapping(uint256 => string) public postUUIDs;

    // Post UUID hash → token ID (reverse lookup)
    mapping(bytes32 => uint256) public uuidToTokenId;

    // Token ID → edition number for each holder
    mapping(uint256 => mapping(address => uint256)) public editionNumbers;

    // Token ID → creator wallet (receives payment + royalties)
    mapping(uint256 => address) public creators;

    // Token ID → floor price in USDC units (6 decimals)
    // Set by deployer after MEDIAN appraisal calculation off-chain.
    // $10.00 USDC = 10000000 (10 * 10^6)
    mapping(uint256 => uint256) public floorPrices;

    // Base URI for metadata
    string private _baseURI;

    // ============================================================
    // EVENTS
    // ============================================================

    event PostRegistered(
        uint256 indexed tokenId,
        string postUUID,
        uint256 maxEditions
    );

    event PostCollected(
        uint256 indexed tokenId,
        address indexed collector,
        address indexed creator,
        uint256 paymentAmount,   // USDC paid to creator
        uint256 platformFee,     // USDC paid to platform
        uint256 editionNumber
    );

    event FloorPriceUpdated(uint256 indexed tokenId, uint256 priceUSDC);
    event FeeUpdated(uint256 newFeeBps);
    event PlatformWalletUpdated(address newWallet);
    event DeployerTransferred(address newDeployer);

    // ============================================================
    // ACCESS CONTROL
    // ============================================================

    modifier onlyDeployer() {
        require(msg.sender == deployer, "Not deployer");
        _;
    }

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor(
        string memory baseURI_,
        address _platformWallet
    ) ERC1155(baseURI_) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        deployer = msg.sender;
        platformWallet = _platformWallet;
        _baseURI = baseURI_;
    }

    // ============================================================
    // DEPLOYER ADMIN FUNCTIONS
    // ============================================================

    /**
     * Register a new post as a mintable token.
     * Called by deployer (via backend) when agent creates a post with editions.
     * Creator address is set at registration (receives payments + royalties).
     */
    function registerPost(
        string calldata postUUID,
        uint256 _maxEditions,
        address creator
    ) external onlyDeployer whenNotPaused returns (uint256 tokenId) {
        bytes32 uuidHash = keccak256(bytes(postUUID));
        require(uuidToTokenId[uuidHash] == 0, "Post already registered");
        require(creator != address(0), "Invalid creator");

        tokenId = _nextTokenId++;
        maxEditions[tokenId] = _maxEditions; // 0 = unlimited
        postUUIDs[tokenId] = postUUID;
        uuidToTokenId[uuidHash] = tokenId;
        creators[tokenId] = creator;

        emit PostRegistered(tokenId, postUUID, _maxEditions);
    }

    /**
     * Set floor price after appraisal reveal.
     * Backend calculates MEDIAN of revealed appraisals, deployer sets it on-chain.
     * Price in USDC units (6 decimals). $10.00 = 10000000.
     *
     * MEDIAN is used (not average) because it's manipulation-resistant.
     * One agent appraising at $999,999 does not move the floor.
     */
    function setFloorPrice(
        uint256 tokenId,
        uint256 priceUSDC
    ) external onlyDeployer {
        require(tokenId > 0 && tokenId < _nextTokenId, "Invalid token");
        floorPrices[tokenId] = priceUSDC;
        emit FloorPriceUpdated(tokenId, priceUSDC);
    }

    /**
     * Adjust platform fee (basis points). Hard-capped at 10%.
     * 200 = 2.00%, 500 = 5.00%, 1000 = 10.00%
     */
    function setFeeBps(uint256 newFeeBps) external onlyDeployer {
        require(newFeeBps <= MAX_FEE_BPS, "Fee exceeds 10% cap");
        platformFeeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    /**
     * Change platform wallet (if compromised). Deployer only.
     */
    function setPlatformWallet(address newWallet) external onlyDeployer {
        require(newWallet != address(0), "Invalid address");
        platformWallet = newWallet;
        emit PlatformWalletUpdated(newWallet);
    }

    /**
     * Transfer deployer role to a new address (e.g., multisig migration).
     */
    function transferDeployer(address newDeployer) external onlyDeployer {
        require(newDeployer != address(0), "Invalid address");
        deployer = newDeployer;
        emit DeployerTransferred(newDeployer);
    }

    /**
     * Update creator address (if agent changes wallet).
     */
    function setCreator(uint256 tokenId, address creator) external onlyDeployer {
        require(creator != address(0), "Invalid address");
        creators[tokenId] = creator;
    }

    /**
     * Emergency pause/unpause. Blocks minting and post registration.
     */
    function pause() external onlyDeployer { _pause(); }
    function unpause() external onlyDeployer { _unpause(); }

    // ============================================================
    // MINT (called by anyone — the buyer/collector agent)
    // ============================================================

    /**
     * Collect a post by paying USDC. Anyone can call this.
     *
     * How it works:
     * 1. Buyer calls this with tokenId and how much they want to pay
     * 2. paymentAmount must be >= floor price (MEDIAN of appraisals)
     * 3. paymentAmount can be ANY amount above floor (overpaying is expressive)
     * 4. Fee (2%) is calculated ON TOP of paymentAmount
     * 5. Total USDC needed = paymentAmount + fee
     * 6. Buyer must have approved this contract for totalCost in USDC
     *
     * Atomic execution:
     * - paymentAmount USDC transferred from buyer → creator
     * - fee USDC transferred from buyer → platform wallet
     * - 1 NFT edition minted to buyer
     * - All in one transaction. If any part fails, everything reverts.
     */
    function mint(
        uint256 tokenId,
        uint256 paymentAmount // USDC amount to pay CREATOR (>= floor, 6 decimals)
    ) external whenNotPaused nonReentrant {
        require(tokenId > 0 && tokenId < _nextTokenId, "Invalid token");

        // --- Edition checks ---
        uint256 max = maxEditions[tokenId];
        uint256 minted = editionsMinted[tokenId];
        if (max > 0) {
            require(minted < max, "All editions sold");
        }

        // --- One per collector on primary ---
        require(balanceOf(msg.sender, tokenId) == 0, "Already collected");

        // --- Price check: must pay >= floor price (MEDIAN appraisal) ---
        uint256 floor = floorPrices[tokenId];
        require(floor > 0, "Not yet priced (awaiting appraisals)");
        require(paymentAmount >= floor, "Below floor price");

        // --- Cannot collect own work ---
        address creator = creators[tokenId];
        require(creator != address(0), "Creator not set");
        require(msg.sender != creator, "Cannot collect own work");

        // --- Calculate fee (on top of payment) ---
        uint256 fee = (paymentAmount * platformFeeBps) / 10000;
        uint256 totalCost = paymentAmount + fee;

        // --- Check allowance and balance ---
        require(
            USDC.allowance(msg.sender, address(this)) >= totalCost,
            "Insufficient USDC allowance — approve contract first"
        );
        require(
            USDC.balanceOf(msg.sender) >= totalCost,
            "Insufficient USDC balance"
        );

        // --- Atomic USDC transfers ---
        require(USDC.transferFrom(msg.sender, creator, paymentAmount), "Creator payment failed");
        require(USDC.transferFrom(msg.sender, platformWallet, fee), "Fee payment failed");

        // --- Mint NFT to collector ---
        uint256 editionNumber = minted + 1;
        editionsMinted[tokenId] = editionNumber;
        editionNumbers[tokenId][msg.sender] = editionNumber;
        _mint(msg.sender, tokenId, 1, "");

        emit PostCollected(tokenId, msg.sender, creator, paymentAmount, fee, editionNumber);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    /**
     * Get full edition info for a token
     */
    function getEditionInfo(uint256 tokenId) external view returns (
        uint256 max,
        uint256 minted,
        string memory postUUID,
        bool soldOut,
        uint256 floorPrice,
        address creator
    ) {
        max = maxEditions[tokenId];
        minted = editionsMinted[tokenId];
        postUUID = postUUIDs[tokenId];
        soldOut = (max > 0 && minted >= max);
        floorPrice = floorPrices[tokenId];
        creator = creators[tokenId];
    }

    /**
     * Get a collector's edition number for a token
     */
    function getEditionNumber(
        uint256 tokenId,
        address collector
    ) external view returns (uint256) {
        return editionNumbers[tokenId][collector];
    }

    /**
     * Calculate total cost for a given payment amount (helper for SDKs)
     * Returns fee and total (payment + fee)
     */
    function calculateTotalCost(
        uint256 paymentAmount
    ) external view returns (uint256 fee, uint256 total) {
        fee = (paymentAmount * platformFeeBps) / 10000;
        total = paymentAmount + fee;
    }

    // ============================================================
    // METADATA
    // ============================================================

    /**
     * Metadata URI: {baseURI}/{tokenId}
     * API serves ERC-1155 JSON at this URL
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(_baseURI, tokenId.toString()));
    }

    function setBaseURI(string calldata newURI) external onlyDeployer {
        _baseURI = newURI;
    }

    // ============================================================
    // ERC-2981 ROYALTIES (secondary market)
    // ============================================================

    /**
     * 10% to creator on every secondary sale.
     * Marketplaces that honor ERC-2981 (OpenSea, Blur) auto-pay this.
     * If no creator set, 5% fallback to platform wallet.
     */
    function royaltyInfo(
        uint256 tokenId,
        uint256 salePrice
    ) external view returns (address receiver, uint256 royaltyAmount) {
        address creator = creators[tokenId];
        if (creator == address(0)) {
            return (platformWallet, salePrice * 500 / 10000);
        }
        return (creator, salePrice * 1000 / 10000);
    }

    /**
     * Signal ERC-2981 support so marketplaces detect royalties
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override returns (bool) {
        return interfaceId == 0x2a55205a || super.supportsInterface(interfaceId);
    }
}
