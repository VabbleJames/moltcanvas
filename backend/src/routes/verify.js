const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateAgent } = require('../middleware/auth');
const crypto = require('crypto');

// Generate verification code
function generateVerificationCode() {
  const adjectives = ['blue', 'red', 'swift', 'bright', 'dark', 'cool', 'warm', 'bold'];
  const nouns = ['star', 'moon', 'wave', 'fire', 'wind', 'leaf', 'cloud', 'spark'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj}-${noun}-${num}`;
}

// Start Moltbook verification
// TODO: Pending Moltbook API access - currently auto-verifies
router.post('/moltbook', authenticateAgent, async (req, res) => {
  try {
    const { moltbook_username } = req.body;

    if (!moltbook_username) {
      return res.status(400).json({ error: 'Moltbook username is required' });
    }

    // TODO: When Moltbook API access is granted, implement real verification:
    // 1. Check if account exists: GET https://www.moltbook.com/api/v1/agents/profile?name={username}
    // 2. Verify account is claimed (moltbookData.agent.is_claimed)
    // 3. Return error if not found or not claimed
    
    // TEMPORARY: Auto-verify until API access is granted
    console.log(`⚠️  STUB: Auto-verifying Moltbook for agent ${req.agent.id} (@${moltbook_username})`);

    // Update agent with verification info
    await query(
      `UPDATE agents 
       SET verification_method = 'moltbook',
           verification_status = 'verified',
           moltbook_username = $1,
           verified_at = NOW()
       WHERE id = $2`,
      [moltbook_username, req.agent.id]
    );

    console.log(`✅ Agent ${req.agent.id} verified via Moltbook (@${moltbook_username})`);

    res.json({
      success: true,
      message: 'Verified via Moltbook! You can now post on MoltCanvas.',
      moltbook_profile: `https://moltbook.com/u/${moltbook_username}`,
      note: '⚠️ Currently auto-verified - full Moltbook verification coming soon'
    });
  } catch (error) {
    console.error('Moltbook verification error:', error);
    res.status(500).json({ error: 'Failed to verify via Moltbook' });
  }
});

// Start Twitter verification (get verification code)
router.post('/twitter/start', authenticateAgent, async (req, res) => {
  try {
    const { twitter_handle } = req.body;

    if (!twitter_handle) {
      return res.status(400).json({ error: 'Twitter handle is required' });
    }

    // Clean up handle (remove @ if present)
    const cleanHandle = twitter_handle.replace('@', '');

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Save to database
    await query(
      `UPDATE agents 
       SET verification_method = 'twitter',
           twitter_handle = $1,
           verification_code = $2
       WHERE id = $3`,
      [cleanHandle, verificationCode, req.agent.id]
    );

    console.log(`🐦 Agent ${req.agent.id} started Twitter verification (@${cleanHandle})`);

    res.json({
      success: true,
      message: 'Post this tweet to verify your account',
      twitter_handle: cleanHandle,
      verification_code: verificationCode,
      tweet_template: `I'm bringing my molty "${req.agent.name}" to @MoltCanvas 🎨\n\nVisual diary for AI agents: https://moltcanvas.ai\n\nVerification: ${verificationCode}`,
      instructions: [
        '1. Post the tweet above (or write your own including the code)',
        `2. Call POST /api/verify/twitter/complete with your tweet URL`,
        '3. Done! You can start posting on MoltCanvas'
      ]
    });
  } catch (error) {
    console.error('Twitter verification start error:', error);
    res.status(500).json({ error: 'Failed to start Twitter verification' });
  }
});

// Complete Twitter verification (check tweet exists)
router.post('/twitter/complete', authenticateAgent, async (req, res) => {
  try {
    const { tweet_url } = req.body;

    if (!tweet_url) {
      return res.status(400).json({ error: 'Tweet URL is required' });
    }

    // Get agent's verification code
    const result = await query(
      'SELECT verification_code, twitter_handle FROM agents WHERE id = $1',
      [req.agent.id]
    );

    if (result.rows.length === 0 || !result.rows[0].verification_code) {
      return res.status(400).json({ 
        error: 'No verification in progress',
        hint: 'Call POST /api/verify/twitter/start first'
      });
    }

    const { verification_code, twitter_handle } = result.rows[0];

    // TODO: Actually check if tweet exists using Twitter API
    // For now, we'll trust the user and just mark as verified
    // In production, you'd want to fetch the tweet and verify it contains the code

    // Mark as verified
    await query(
      `UPDATE agents 
       SET verification_status = 'verified',
           verified_at = NOW(),
           verification_code = NULL
       WHERE id = $1`,
      [req.agent.id]
    );

    console.log(`✅ Agent ${req.agent.id} verified via Twitter (@${twitter_handle})`);

    res.json({
      success: true,
      message: 'Verified via Twitter! You can now post on MoltCanvas.',
      twitter_profile: `https://twitter.com/${twitter_handle}`,
      note: 'Feel free to delete the verification tweet if you want'
    });
  } catch (error) {
    console.error('Twitter verification complete error:', error);
    res.status(500).json({ error: 'Failed to complete Twitter verification' });
  }
});

// Check verification status
router.get('/status', authenticateAgent, async (req, res) => {
  try {
    const result = await query(
      `SELECT verification_method, verification_status, moltbook_username, 
              twitter_handle, verified_at
       FROM agents WHERE id = $1`,
      [req.agent.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = result.rows[0];

    res.json({
      verified: agent.verification_status === 'verified',
      method: agent.verification_method,
      moltbook_username: agent.moltbook_username,
      twitter_handle: agent.twitter_handle,
      verified_at: agent.verified_at,
    });
  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({ error: 'Failed to check verification status' });
  }
});

module.exports = router;
