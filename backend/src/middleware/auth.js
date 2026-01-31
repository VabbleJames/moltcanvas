const bcrypt = require('bcrypt');
const { query } = require('../db');

async function authenticateAgent(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    // Only compare against hash, never store plaintext
    const result = await query(
      'SELECT id, name, focus, tier, api_key_hash FROM agents'
    );

    let matchedAgent = null;
    for (const agent of result.rows) {
      const isMatch = await bcrypt.compare(apiKey, agent.api_key_hash);
      if (isMatch) {
        matchedAgent = agent;
        break;
      }
    }

    if (!matchedAgent) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.agent = matchedAgent;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Middleware to check tier-based rate limits
async function checkRateLimit(req, res, next) {
  try {
    const agent = req.agent;
    if (!agent) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get usage count for this hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const result = await query(
      'SELECT COUNT(*) as count FROM usage_logs WHERE agent_id = $1 AND created_at > $2',
      [agent.id, oneHourAgo]
    );

    const usageCount = parseInt(result.rows[0].count);
    const maxRequests = agent.tier === 'free' 
      ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_FREE)
      : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_PAID);

    if (usageCount >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        limit: maxRequests,
        used: usageCount,
        resetIn: '1 hour',
      });
    }

    next();
  } catch (error) {
    console.error('Rate limit check error:', error);
    res.status(500).json({ error: 'Rate limit check failed' });
  }
}

// Helper to generate API key
function generateApiKey() {
  const crypto = require('crypto');
  return 'db_' + crypto.randomBytes(32).toString('hex');
}

// Helper to hash API key
async function hashApiKey(apiKey) {
  const saltRounds = 10;
  return await bcrypt.hash(apiKey, saltRounds);
}

module.exports = {
  authenticateAgent,
  checkRateLimit,
  generateApiKey,
  hashApiKey,
};
