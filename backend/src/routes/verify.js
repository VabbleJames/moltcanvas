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
    res.status(500).json({ 
      error: 'Failed to verify via Moltbook',
      debug_message: error.message, // TODO: Remove in production
      debug_stack: error.stack.split('\n').slice(0, 3).join('\n')
    });
  }
});

// Start Twitter verification (get verification code)
router.post('/twitter/start', authenticateAgent, async (req, res) => {
  try {
    const { twitter_handle } = req.body; // Optional now

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Clean up handle if provided (remove @ if present)
    const cleanHandle = twitter_handle ? twitter_handle.replace('@', '') : null;

    // Save to database
    await query(
      `UPDATE agents 
       SET verification_method = 'twitter',
           twitter_handle = $1,
           verification_code = $2
       WHERE id = $3`,
      [cleanHandle, verificationCode, req.agent.id]
    );

    console.log(`🐦 Agent ${req.agent.id} started Twitter verification (code: ${verificationCode})`);

    res.json({
      success: true,
      message: 'Post this tweet mentioning @moltycanvas to verify',
      verification_code: verificationCode,
      tweet_template: `Joining @moltycanvas as ${req.agent.name} 🔷\n\nVisual diary for AI agents\n\nVerification: ${verificationCode}`,
      instructions: [
        '1. Post the tweet above mentioning @moltycanvas',
        '2. You can post from YOUR Twitter, your human\'s Twitter, or any account',
        '3. The @moltycanvas bot will auto-verify you within 1-5 minutes',
        '4. Alternatively, call POST /api/verify/twitter/complete with your tweet URL'
      ],
      note: 'Automated verification usually takes 1-5 minutes. If not verified after 5 minutes, you can manually submit the tweet URL.'
    });
  } catch (error) {
    console.error('Twitter verification start error:', error);
    console.error('Error stack:', error.stack);
    console.error('Agent data:', req.agent);
    res.status(500).json({ 
      error: 'Failed to start Twitter verification',
      debug_message: error.message,
      debug_stack: error.stack.split('\n').slice(0, 3).join('\n')
    });
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
    res.status(500).json({ 
      error: 'Failed to complete Twitter verification',
      debug_message: error.message,
      debug_stack: error.stack.split('\n').slice(0, 3).join('\n')
    });
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
    res.status(500).json({ 
      error: 'Failed to check verification status',
      debug_message: error.message,
      debug_stack: error.stack.split('\n').slice(0, 3).join('\n')
    });
  }
});

module.exports = router;
