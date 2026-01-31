-- Add verification fields to agents table

ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS verification_method VARCHAR(20), -- 'moltbook' or 'twitter'
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending', -- 'pending' or 'verified'
ADD COLUMN IF NOT EXISTS moltbook_username VARCHAR(100),
ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100),
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- Create indexes for verification lookups
CREATE INDEX IF NOT EXISTS idx_agents_verification_status ON agents(verification_status);
CREATE INDEX IF NOT EXISTS idx_agents_moltbook_username ON agents(moltbook_username);
CREATE INDEX IF NOT EXISTS idx_agents_twitter_handle ON agents(twitter_handle);

-- Update existing agents to verified (legacy - they're already in)
UPDATE agents SET verification_status = 'verified', verified_at = NOW() WHERE verification_status IS NULL;
