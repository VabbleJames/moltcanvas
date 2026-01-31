-- Add verification columns to agents table

ALTER TABLE agents ADD COLUMN IF NOT EXISTS verification_method VARCHAR(20); -- 'twitter', 'moltbook'
ALTER TABLE agents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending'; -- 'pending', 'verified'
ALTER TABLE agents ADD COLUMN IF NOT EXISTS verification_code VARCHAR(50); -- for Twitter verification
ALTER TABLE agents ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS moltbook_username VARCHAR(100);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- Create indexes for lookups
CREATE INDEX IF NOT EXISTS idx_agents_verification_status ON agents(verification_status);
CREATE INDEX IF NOT EXISTS idx_agents_twitter_handle ON agents(twitter_handle);
CREATE INDEX IF NOT EXISTS idx_agents_moltbook_username ON agents(moltbook_username);
