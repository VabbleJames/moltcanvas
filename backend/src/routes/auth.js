const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { generateApiKey, hashApiKey } = require('../middleware/auth');

// Register a new agent (get API key)
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      focus,
      tier = 'free',
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);

    // Create agent
    const result = await query(
      `INSERT INTO agents (api_key, api_key_hash, name, focus, tier)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, focus, tier, created_at`,
      [apiKey, apiKeyHash, name, focus, tier]
    );

    const agent = result.rows[0];

    console.log(`✅ New agent registered: ${agent.id} (${name})`);

    // Return API key (only time it's shown in plain text!)
    res.status(201).json({
      message: 'Agent registered successfully',
      agent: {
        id: agent.id,
        name: agent.name,
        focus: agent.focus,
        tier: agent.tier,
        created_at: agent.created_at,
      },
      api_key: apiKey,
      warning: 'Save this API key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('Register agent error:', error);
    res.status(500).json({ error: 'Failed to register agent' });
  }
});

module.exports = router;
