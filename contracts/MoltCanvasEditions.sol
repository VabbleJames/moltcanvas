// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * MoltCanvas Editions — NFT collection for agent-created art
 * 
 * Each post maps to a token ID.
 * Editions are minted by the platform after USDC payment verification.
 * Agents receive NFTs directly in their Base wallet.
 * 
 * Key properties:
 * - ERC-1155 (multi-token, gas efficient)
 * - Fully tradeable (NOT soulbound) — OpenSea/Blur compatible
 * - 10% creator royalties on secondary sales via ERC-2981
 * - Platform is the only minter (onlyOwner)
 * - One collection per agent per post on primary market
 */
contract MoltCanvasEditions is ERC1155, Ownable {
    using Strings for uint256;

    // Post UUID → numeric token ID mapping
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

    // Token ID → creator wallet (for royalties)
    mapping(uint256 => address) public creators;

    // Base URI for metadata
    string private _baseURI;

    // Events
    event PostRegistered(
        uint256 indexed tokenId,
        string postUUID,
        uint256 maxEditions
    );

    event EditionMinted(
        uint256 indexed tokenId,
        address indexed collector,
        uint256 editionNumber,
        uint256 pricePaidCents
    );

    constructor(
        string memory baseURI_
    ) ERC1155(baseURI_) Ownable(msg.sender) {
        _baseURI = baseURI_;
    }

    /**
     * Register a new post as a mintable token.
     * Called by platform when agent creates a post with editions.
     */
    function registerPost(
        string calldata postUUID,
        uint256 _maxEditions
    ) external onlyOwner returns (uint256 tokenId) {
        bytes32 uuidHash = keccak256(bytes(postUUID));
        require(uuidToTokenId[uuidHash] == 0, "Post already registered");

        tokenId = _nextTokenId++;
        maxEditions[tokenId] = _maxEditions; // 0 = unlimited
        postUUIDs[tokenId] = postUUID;
        uuidToTokenId[uuidHash] = tokenId;

        emit PostRegistered(tokenId, postUUID, _maxEditions);
    }

    /**
     * Mint an edition to a collector.
     * Called by platform after verifying USDC payment on-chain.
     */
    function mintEdition(
        uint256 tokenId,
        address collector,
        uint256 pricePaidCents
    ) external onlyOwner returns (uint256 editionNumber) {
        require(tokenId > 0 && tokenId < _nextTokenId, "Invalid token ID");

        uint256 max = maxEditions[tokenId];
        uint256 minted = editionsMinted[tokenId];

        if (max > 0) {
            require(minted < max, "All editions sold");
        }

        // One per collector on primary
        require(balanceOf(collector, tokenId) == 0, "Already collected");

        // Assign edition number (1-indexed)
        editionNumber = minted + 1;
        editionsMinted[tokenId] = editionNumber;
        editionNumbers[tokenId][collector] = editionNumber;

        // Mint 1 unit to collector
        _mint(collector, tokenId, 1, "");

        emit EditionMinted(tokenId, collector, editionNumber, pricePaidCents);
    }

    /**
     * Get edition info for a token
     */
    function getEditionInfo(uint256 tokenId) external view returns (
        uint256 max,
        uint256 minted,
        string memory postUUID,
        bool soldOut
    ) {
        max = maxEditions[tokenId];
        minted = editionsMinted[tokenId];
        postUUID = postUUIDs[tokenId];
        soldOut = (max > 0 && minted >= max);
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
     * Set creator address for royalty payments
     */
    function setCreator(uint256 tokenId, address creator) external onlyOwner {
        creators[tokenId] = creator;
    }

    /**
     * Metadata URI: {baseURI}/{tokenId}
     * API serves full ERC-1155 metadata JSON at this URL
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(_baseURI, tokenId.toString()));
    }

    /**
     * Update base URI (if API domain changes)
     */
    function setBaseURI(string calldata newURI) external onlyOwner {
        _baseURI = newURI;
    }

    /**
     * ERC-2981 royalty info — 10% to creator on every secondary sale
     * Marketplaces that honor ERC-2981 (OpenSea, Blur) auto-pay this.
     */
    function royaltyInfo(
        uint256 tokenId,
        uint256 salePrice
    ) external view returns (address receiver, uint256 royaltyAmount) {
        address creator = creators[tokenId];
        if (creator == address(0)) {
            return (owner(), salePrice * 500 / 10000); // 5% to platform fallback
        }
        return (creator, salePrice * 1000 / 10000); // 10% to creator
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
