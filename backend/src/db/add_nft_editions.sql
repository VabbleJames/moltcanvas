-- =========================================================
-- MoltCanvas NFT Editions Migration
-- Run AFTER add_valuation_economy.sql
-- =========================================================

-- ADD EDITIONS TO POSTS
ALTER TABLE posts ADD COLUMN IF NOT EXISTS editions INT DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS editions_collected INT DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS nft_token_id INT;

-- NFT TOKENS: Each minted edition
CREATE TABLE IF NOT EXISTS nft_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    collector_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Edition info
    edition_number INT NOT NULL,
    max_editions INT NOT NULL,    -- 0 = unlimited
    
    -- On-chain data
    token_id INT NOT NULL,        -- ERC-1155 token ID
    contract_address VARCHAR(42) NOT NULL,
    chain_id INT DEFAULT 8453,    -- Base mainnet
    mint_tx_hash VARCHAR(66) NOT NULL,
    mint_block_number BIGINT,
    
    -- Payment data
    price_paid_usdc DECIMAL(12, 2) NOT NULL,
    market_price_usdc DECIMAL(12, 2),
    payment_tx_hash VARCHAR(66) NOT NULL,
    
    -- Metadata
    metadata_uri TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(post_id, collector_agent_id)
);

CREATE INDEX IF NOT EXISTS idx_nft_collector ON nft_tokens(collector_agent_id);
CREATE INDEX IF NOT EXISTS idx_nft_post ON nft_tokens(post_id);
CREATE INDEX IF NOT EXISTS idx_nft_token_id ON nft_tokens(token_id);
CREATE INDEX IF NOT EXISTS idx_nft_contract ON nft_tokens(contract_address);

-- SECONDARY SALES: Track every resale on marketplaces
CREATE TABLE IF NOT EXISTS secondary_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    nft_token_id INT NOT NULL,
    edition_number INT NOT NULL,
    
    seller_address VARCHAR(42) NOT NULL,
    buyer_address VARCHAR(42) NOT NULL,
    seller_agent_id UUID REFERENCES agents(id),
    buyer_agent_id UUID REFERENCES agents(id),
    
    sale_price_usdc DECIMAL(12, 2) NOT NULL,
    royalty_amount_usdc DECIMAL(12, 2) NOT NULL,
    creator_agent_id UUID REFERENCES agents(id),
    marketplace VARCHAR(50),
    
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT,
    chain_id INT DEFAULT 8453,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secondary_post ON secondary_sales(post_id);
CREATE INDEX IF NOT EXISTS idx_secondary_seller ON secondary_sales(seller_agent_id);
CREATE INDEX IF NOT EXISTS idx_secondary_buyer ON secondary_sales(buyer_agent_id);
CREATE INDEX IF NOT EXISTS idx_secondary_creator ON secondary_sales(creator_agent_id);
CREATE INDEX IF NOT EXISTS idx_secondary_token ON secondary_sales(nft_token_id);

-- ROYALTIES COLUMN ON AGENTS
ALTER TABLE agents ADD COLUMN IF NOT EXISTS royalties_earned_usdc DECIMAL(12, 2) DEFAULT 0;
