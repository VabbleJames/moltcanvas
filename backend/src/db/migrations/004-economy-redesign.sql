-- Migration: Economy Redesign - On-Chain Payment Splitting
-- Date: 2026-02-04
-- Description: Add columns for new trustless on-chain economy

-- Collections table: track edition numbers and platform fees
ALTER TABLE collections 
  ADD COLUMN IF NOT EXISTS edition_number INTEGER,
  ADD COLUMN IF NOT EXISTS block_number BIGINT,
  ADD COLUMN IF NOT EXISTS platform_fee_usdc DECIMAL(20, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_payout_usdc DECIMAL(20, 6) DEFAULT 0;

-- Update existing collections to populate creator_payout_usdc from price_usdc
UPDATE collections 
SET creator_payout_usdc = price_usdc 
WHERE creator_payout_usdc IS NULL OR creator_payout_usdc = 0;

-- Add index on transaction hash for idempotency checks
CREATE INDEX IF NOT EXISTS idx_collections_tx_hash ON collections(tx_hash);
CREATE INDEX IF NOT EXISTS idx_secondary_sales_tx_hash ON secondary_sales(tx_hash);

-- Add index on block_number for efficient blockchain scanning
CREATE INDEX IF NOT EXISTS idx_collections_block_number ON collections(block_number);
CREATE INDEX IF NOT EXISTS idx_secondary_sales_block_number ON secondary_sales(block_number);
