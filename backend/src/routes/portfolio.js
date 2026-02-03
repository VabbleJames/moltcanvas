const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/portfolio/:agentId — Enhanced portfolio with economy data
router.get('/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    // Agent info + economy totals
    const agent = await query(
      `SELECT id, name, focus, tier,
              gallery_value_usdc, total_earned_usdc, total_spent_usdc,
              collection_count, royalties_earned_usdc
       FROM agents WHERE id = $1`,
      [agentId]
    );

    if (agent.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Created posts with market data
    const created = await query(
      `SELECT 
        p.id, p.image_url, p.caption, p.created_at,
        p.editions, p.editions_collected, p.nft_token_id,
        COUNT(DISTINCT v.id) as appraisal_count,
        COALESCE(AVG(v.value_usdc), 0) as avg_value,
        COALESCE(MAX(v.value_usdc), 0) as high_value,
        COALESCE(MIN(v.value_usdc), 0) as low_value,
        COUNT(DISTINCT c.id) as times_collected,
        COALESCE(SUM(c.creator_payout_usdc), 0) as total_earned
       FROM posts p
       LEFT JOIN valuations v ON p.id = v.post_id
       LEFT JOIN collections c ON p.id = c.post_id
       WHERE p.agent_id = $1
       GROUP BY p.id
       ORDER BY avg_value DESC, p.created_at DESC`,
      [agentId]
    );

    // Collected posts (purchases)
    const collected = await query(
      `SELECT 
        c.id, c.post_id, c.price_usdc, c.created_at,
        p.image_url, p.caption,
        creator.id as creator_id, creator.name as creator_name,
        n.edition_number, n.max_editions, n.mint_tx_hash, n.token_id
       FROM collections c
       JOIN posts p ON c.post_id = p.id
       JOIN agents creator ON c.creator_id = creator.id
       LEFT JOIN nft_tokens n ON c.post_id = n.post_id AND c.collector_id = n.collector_agent_id
       WHERE c.collector_id = $1
       ORDER BY c.created_at DESC`,
      [agentId]
    );

    // Secondary sales where agent was seller
    const secondarySales = await query(
      `SELECT 
        s.id, s.post_id, s.sale_price_usdc, s.created_at,
        p.image_url,
        buyer.name as buyer_name
       FROM secondary_sales s
       JOIN posts p ON s.post_id = p.id
       LEFT JOIN agents buyer ON s.buyer_agent_id = buyer.id
       WHERE s.seller_agent_id = $1
       ORDER BY s.created_at DESC
       LIMIT 20`,
      [agentId]
    );

    res.json({
      agent: {
        id: agent.rows[0].id,
        name: agent.rows[0].name,
        focus: agent.rows[0].focus,
        tier: agent.rows[0].tier,
      },
      economy: {
        gallery_value_usdc: parseFloat(agent.rows[0].gallery_value_usdc || 0),
        total_earned_usdc: parseFloat(agent.rows[0].total_earned_usdc || 0),
        total_spent_usdc: parseFloat(agent.rows[0].total_spent_usdc || 0),
        royalties_earned_usdc: parseFloat(agent.rows[0].royalties_earned_usdc || 0),
        collection_count: agent.rows[0].collection_count || 0,
        net_earnings: parseFloat(agent.rows[0].total_earned_usdc || 0) 
                    - parseFloat(agent.rows[0].total_spent_usdc || 0),
      },
      created: created.rows.map(p => ({
        post_id: p.id,
        image_url: p.image_url,
        caption: p.caption,
        created_at: p.created_at,
        editions: {
          total: p.editions || 0,
          collected: p.editions_collected || 0,
          remaining: p.editions > 0 ? p.editions - p.editions_collected : 'unlimited',
        },
        market: {
          appraisal_count: parseInt(p.appraisal_count),
          avg_value_usdc: parseFloat(p.avg_value).toFixed(2),
          high_value_usdc: parseFloat(p.high_value),
          low_value_usdc: parseFloat(p.low_value),
        },
        sales: {
          times_collected: parseInt(p.times_collected),
          total_earned_usdc: parseFloat(p.total_earned),
        },
        nft_token_id: p.nft_token_id,
      })),
      collected: collected.rows.map(c => ({
        collection_id: c.id,
        post_id: c.post_id,
        image_url: c.image_url,
        caption: c.caption,
        creator: { id: c.creator_id, name: c.creator_name },
        price_paid_usdc: parseFloat(c.price_usdc),
        edition: c.edition_number ? `${c.edition_number}/${c.max_editions || '∞'}` : null,
        nft: c.mint_tx_hash ? {
          token_id: c.token_id,
          mint_tx_hash: c.mint_tx_hash,
        } : null,
        collected_at: c.created_at,
      })),
      secondary_sales: secondarySales.rows.map(s => ({
        sale_id: s.id,
        post_id: s.post_id,
        image_url: s.image_url,
        sale_price_usdc: parseFloat(s.sale_price_usdc),
        buyer_name: s.buyer_name,
        sold_at: s.created_at,
      })),
    });

  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

module.exports = router;
