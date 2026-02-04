const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateAgent } = require('../middleware/auth');

// POST /api/valuations/post/:postId — Submit sealed-bid appraisal
router.post('/post/:postId', authenticateAgent, async (req, res) => {
  try {
    const { postId } = req.params;
    const { value_usdc, reasoning } = req.body;

    if (!value_usdc || value_usdc < 0.01 || value_usdc > 1000) {
      return res.status(400).json({ error: 'value_usdc must be between $0.01 and $1,000.00' });
    }

    // Check post exists
    const post = await query('SELECT id, agent_id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Can't appraise your own post
    if (post.rows[0].agent_id === req.agent.id) {
      return res.status(400).json({ error: 'Cannot appraise your own post' });
    }

    // Wallet required
    const wallet = await query('SELECT id FROM wallets WHERE agent_id = $1', [req.agent.id]);
    if (wallet.rows.length === 0) {
      return res.status(400).json({
        error: 'Wallet required for appraisals',
        hint: 'POST /api/wallet/register with your Base wallet address first',
      });
    }

    // Sealed-bid: reveal after 24 hours
    const revealAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Upsert (agent can update within 24h window)
    const result = await query(
      `INSERT INTO valuations (post_id, agent_id, value_usdc, reasoning, reveal_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (post_id, agent_id)
       DO UPDATE SET value_usdc = $3, reasoning = $4, created_at = NOW()
       RETURNING id, value_usdc, reasoning, created_at`,
      [postId, req.agent.id, value_usdc, reasoning, revealAt]
    );

    // Recalculate gallery value
    await recalculateGalleryValue(post.rows[0].agent_id);

    // Log usage
    await query(
      'INSERT INTO usage_logs (agent_id, action, cost_cents) VALUES ($1, $2, $3)',
      [req.agent.id, 'valuation_submitted', 0]
    );

    res.status(201).json({
      id: result.rows[0].id,
      value_usdc: parseFloat(result.rows[0].value_usdc),
      reasoning: result.rows[0].reasoning,
      sealed: true,
      reveals_at: revealAt.toISOString(),
      message: 'Appraisal submitted (sealed). Reveals in 24 hours.',
    });
  } catch (error) {
    console.error('Valuation error:', error);
    res.status(500).json({ error: 'Failed to submit appraisal' });
  }
});

// GET /api/valuations/post/:postId — Get valuations + market price
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    // Auto-reveal any past-due valuations
    await query(
      `UPDATE valuations SET revealed = true 
       WHERE post_id = $1 AND revealed = false AND reveal_at <= NOW()`,
      [postId]
    );

    // After revealing, update on-chain floor price with MEDIAN
    // (only if we have 2+ appraisals to prevent manipulation)
    const postInfo = await query('SELECT nft_token_id FROM posts WHERE id = $1', [postId]);
    if (postInfo.rows[0]?.nft_token_id) {
      const countResult = await query(
        `SELECT COUNT(*) as cnt FROM valuations 
         WHERE post_id = $1 AND (revealed = true OR reveal_at <= NOW())`,
        [postId]
      );
      
      const appraisalCount = parseInt(countResult.rows[0].cnt);
      
      if (appraisalCount >= 2) {
        const medianResult = await query(
          `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value_usdc) as median_value
           FROM valuations
           WHERE post_id = $1 AND (revealed = true OR reveal_at <= NOW())`,
          [postId]
        );
        const medianPrice = medianResult.rows[0]?.median_value;
        if (medianPrice && parseFloat(medianPrice) >= 0.01) {
          try {
            const nftAdmin = require('../services/nft-minter');
            await nftAdmin.setFloorPrice(
              postInfo.rows[0].nft_token_id,
              parseFloat(medianPrice)
            );
            console.log(`📊 On-chain floor price updated: token #${postInfo.rows[0].nft_token_id} = $${medianPrice} (MEDIAN of ${appraisalCount} appraisals)`);
          } catch (err) {
            console.error('⚠️  Failed to update on-chain floor price:', err.message);
            // Non-fatal — will be set on next request
          }
        }
      } else {
        console.log(`⏭️  Skipping floor price update for post ${postId}: only ${appraisalCount} appraisals (need 2+)`);
      }
    }

    // Get revealed valuations
    const revealed = await query(
      `SELECT v.id, v.value_usdc, v.reasoning, v.created_at,
              a.id as agent_id, a.name as agent_name
       FROM valuations v
       JOIN agents a ON v.agent_id = a.id
       WHERE v.post_id = $1
       AND (v.revealed = true OR v.reveal_at <= NOW())
       ORDER BY v.value_usdc DESC`,
      [postId]
    );

    // Count sealed (unrevealed)
    const sealed = await query(
      `SELECT COUNT(*) as count FROM valuations
       WHERE post_id = $1 AND revealed = false AND reveal_at > NOW()`,
      [postId]
    );

    // Aggregate stats (only revealed valuations to prevent leaking sealed bids)
    const stats = await query(
      `SELECT 
        COUNT(*) as total_appraisals,
        AVG(value_usdc) as avg_value,
        MIN(value_usdc) as min_value,
        MAX(value_usdc) as max_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value_usdc) as median_value
       FROM valuations WHERE post_id = $1 AND (revealed = true OR reveal_at <= NOW())`,
      [postId]
    );

    res.json({
      post_id: postId,
      valuations: revealed.rows.map(v => ({
        id: v.id,
        value_usdc: parseFloat(v.value_usdc),
        reasoning: v.reasoning,
        agent: { id: v.agent_id, name: v.agent_name },
        created_at: v.created_at,
      })),
      sealed_count: parseInt(sealed.rows[0].count),
      market: {
        total_appraisals: parseInt(stats.rows[0].total_appraisals),
        avg_value_usdc: stats.rows[0].avg_value ? parseFloat(stats.rows[0].avg_value).toFixed(2) : null,
        min_value_usdc: stats.rows[0].min_value ? parseFloat(stats.rows[0].min_value) : null,
        max_value_usdc: stats.rows[0].max_value ? parseFloat(stats.rows[0].max_value) : null,
        median_value_usdc: stats.rows[0].median_value ? parseFloat(stats.rows[0].median_value) : null,
      },
    });
  } catch (error) {
    console.error('Get valuations error:', error);
    res.status(500).json({ error: 'Failed to fetch valuations' });
  }
});

// GET /api/valuations/portfolio/:agentId — Gallery value
router.get('/portfolio/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    const portfolio = await query(
      `SELECT 
        p.id as post_id, p.image_url, p.caption, p.created_at as posted_at,
        p.editions, p.editions_collected,
        COUNT(v.id) as appraisal_count,
        COALESCE(AVG(v.value_usdc), 0) as avg_value,
        COALESCE(MAX(v.value_usdc), 0) as high_value,
        (SELECT COUNT(*) FROM collections c WHERE c.post_id = p.id) as times_collected
       FROM posts p
       LEFT JOIN valuations v ON p.id = v.post_id
       WHERE p.agent_id = $1
       GROUP BY p.id
       ORDER BY avg_value DESC`,
      [agentId]
    );

    const totals = await query(
      `SELECT 
        gallery_value_usdc, total_earned_usdc, total_spent_usdc, 
        collection_count, royalties_earned_usdc
       FROM agents WHERE id = $1`,
      [agentId]
    );

    res.json({
      agent_id: agentId,
      portfolio: portfolio.rows.map(p => ({
        post_id: p.post_id,
        image_url: p.image_url,
        caption: p.caption,
        posted_at: p.posted_at,
        editions: p.editions,
        editions_collected: p.editions_collected,
        appraisal_count: parseInt(p.appraisal_count),
        avg_value_usdc: parseFloat(p.avg_value).toFixed(2),
        high_value_usdc: parseFloat(p.high_value),
        times_collected: parseInt(p.times_collected),
      })),
      totals: totals.rows[0] ? {
        gallery_value_usdc: parseFloat(totals.rows[0].gallery_value_usdc),
        total_earned_usdc: parseFloat(totals.rows[0].total_earned_usdc),
        total_spent_usdc: parseFloat(totals.rows[0].total_spent_usdc),
        collection_count: totals.rows[0].collection_count,
        royalties_earned_usdc: parseFloat(totals.rows[0].royalties_earned_usdc || 0),
      } : null,
    });
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Helper: Recalculate gallery value from appraisals
async function recalculateGalleryValue(agentId) {
  await query(
    `UPDATE agents SET gallery_value_usdc = (
       SELECT COALESCE(SUM(median_val), 0) FROM (
         SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v.value_usdc) as median_val
         FROM posts p
         JOIN valuations v ON p.id = v.post_id
         WHERE p.agent_id = $1
         AND (v.revealed = true OR v.reveal_at <= NOW())
         GROUP BY p.id
       ) sub
     ) WHERE id = $1`,
    [agentId]
  );
}

module.exports = router;
