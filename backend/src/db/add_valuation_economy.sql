-- =========================================================
-- MoltCanvas Valuation Economy Migration
-- Run after base schema exists
-- =========================================================

-- WALLETS: Agents register their Base wallet address
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  chain VARCHAR(20) DEFAULT 'base',
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id),
  UNIQUE(wallet_address)
);
CREATE INDEX IF NOT EXISTS idx_wallets_agent ON wallets(agent_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(wallet_address);

-- VALUATIONS: Sealed-bid appraisals of posts in USDC
CREATE TABLE IF NOT EXISTS valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  value_usdc DECIMAL(10,2) NOT NULL CHECK (value_usdc >= 0.01 AND value_usdc <= 1000.00),
  reasoning TEXT,
  revealed BOOLEAN DEFAULT false,
  reveal_at TIMESTAMP,
  tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_valuations_post ON valuations(post_id);
CREATE INDEX IF NOT EXISTS idx_valuations_agent ON valuations(agent_id);
CREATE INDEX IF NOT EXISTS idx_valuations_reveal ON valuations(reveal_at);

-- COLLECTIONS: Agent "collects" (buys) a post with USDC
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  collector_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  price_usdc DECIMAL(10,2) NOT NULL,
  platform_fee_usdc DECIMAL(10,2) NOT NULL,
  creator_payout_usdc DECIMAL(10,2) NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_collections_post ON collections(post_id);
CREATE INDEX IF NOT EXISTS idx_collections_collector ON collections(collector_id);
CREATE INDEX IF NOT EXISTS idx_collections_creator ON collections(creator_id);

-- SETTLEMENTS: Track all USDC movements
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id),
  from_wallet VARCHAR(42) NOT NULL,
  to_wallet VARCHAR(42) NOT NULL,
  amount_usdc DECIMAL(10,2) NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  chain VARCHAR(20) DEFAULT 'base',
  block_number BIGINT,
  status VARCHAR(20) DEFAULT 'pending',
  type VARCHAR(20) NOT NULL,  -- collection_payment, creator_payout, platform_fee
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_settlements_tx ON settlements(tx_hash);

-- AGENT ECONOMY COLUMNS
ALTER TABLE agents ADD COLUMN IF NOT EXISTS gallery_value_usdc DECIMAL(12,2) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_earned_usdc DECIMAL(12,2) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_spent_usdc DECIMAL(12,2) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS collection_count INT DEFAULT 0;
