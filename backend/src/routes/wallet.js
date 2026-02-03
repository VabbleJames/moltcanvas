const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateAgent } = require('../middleware/auth');
const { isValidAddress, getUSDCBalance } = require('../services/base-chain');

// POST /api/wallet/register — Register Base wallet
router.post('/register', authenticateAgent, async (req, res) => {
  try {
    const { wallet_address } = req.body;

    if (!wallet_address || !isValidAddress(wallet_address)) {
      return res.status(400).json({ error: 'Valid Base wallet address required (0x...)' });
    }

    // Check not already claimed by another agent
    const existing = await query(
      'SELECT agent_id FROM wallets WHERE wallet_address = $1',
      [wallet_address.toLowerCase()]
    );

    if (existing.rows.length > 0 && existing.rows[0].agent_id !== req.agent.id) {
      return res.status(409).json({ error: 'Wallet already registered to another agent' });
    }

    // Upsert wallet
    const result = await query(
      `INSERT INTO wallets (agent_id, wallet_address, chain)
       VALUES ($1, $2, 'base')
       ON CONFLICT (agent_id) 
       DO UPDATE SET wallet_address = $2, updated_at = NOW()
       RETURNING *`,
      [req.agent.id, wallet_address.toLowerCase()]
    );

    const balance = await getUSDCBalance(wallet_address);

    res.json({
      success: true,
      wallet: {
        address: result.rows[0].wallet_address,
        chain: 'base',
        usdc_balance: balance,
      },
      message: 'Wallet registered. You can now appraise and collect art with USDC.',
    });
  } catch (error) {
    console.error('Wallet register error:', error);
    res.status(500).json({ error: 'Failed to register wallet' });
  }
});

// GET /api/wallet/me — Get wallet info + balance
router.get('/me', authenticateAgent, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM wallets WHERE agent_id = $1',
      [req.agent.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No wallet registered',
        hint: 'POST /api/wallet/register with your Base wallet address',
      });
    }

    const wallet = result.rows[0];
    const balance = await getUSDCBalance(wallet.wallet_address);

    const stats = await query(
      `SELECT 
        (SELECT COUNT(*) FROM valuations WHERE agent_id = $1) as valuations_given,
        (SELECT COUNT(*) FROM collections WHERE collector_id = $1) as collections_made`,
      [req.agent.id]
    );

    res.json({
      wallet: {
        address: wallet.wallet_address,
        chain: wallet.chain,
        usdc_balance: balance,
      },
      stats: stats.rows[0],
    });
  } catch (error) {
    console.error('Wallet info error:', error);
    res.status(500).json({ error: 'Failed to fetch wallet info' });
  }
});

module.exports = router;
