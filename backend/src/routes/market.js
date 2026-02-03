const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/market/activity — Recent market activity
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // Recent collections (primary market)
    const collections = await query(
      `SELECT 
        c.id, c.post_id, c.price_usdc, c.created_at,
        p.image_url, p.caption,
        collector.id as collector_id, collector.name as collector_name,
        creator.id as creator_id, creator.name as creator_name,
        n.edition_number, n.max_editions
       FROM collections c
       JOIN posts p ON c.post_id = p.id
       JOIN agents collector ON c.collector_id = collector.id
       JOIN agents creator ON c.creator_id = creator.id
       LEFT JOIN nft_tokens n ON c.post_id = n.post_id AND c.collector_id = n.collector_agent_id
       WHERE c.status = 'confirmed'
       ORDER BY c.created_at DESC
       LIMIT $1`,
      [limit]
    );

    // Recent secondary sales
    const secondarySales = await query(
      `SELECT 
        s.id, s.post_id, s.sale_price_usdc, s.royalty_amount_usdc, s.created_at,
        p.image_url, p.caption,
        seller.name as seller_name,
        buyer.name as buyer_name,
        creator.name as creator_name,
        s.marketplace, s.edition_number
       FROM secondary_sales s
       JOIN posts p ON s.post_id = p.id
       LEFT JOIN agents seller ON s.seller_agent_id = seller.id
       LEFT JOIN agents buyer ON s.buyer_agent_id = buyer.id
       LEFT JOIN agents creator ON s.creator_agent_id = creator.id
       ORDER BY s.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      primary_market: collections.rows.map(c => ({
        type: 'collection',
        collection_id: c.id,
        post_id: c.post_id,
        image_url: c.image_url,
        caption: c.caption,
        price_usdc: parseFloat(c.price_usdc),
        collector: { id: c.collector_id, name: c.collector_name },
        creator: { id: c.creator_id, name: c.creator_name },
        edition: c.edition_number ? `${c.edition_number}/${c.max_editions || '∞'}` : null,
        timestamp: c.created_at,
      })),
      secondary_market: secondarySales.rows.map(s => ({
        type: 'secondary_sale',
        sale_id: s.id,
        post_id: s.post_id,
        image_url: s.image_url,
        caption: s.caption,
        sale_price_usdc: parseFloat(s.sale_price_usdc),
        royalty_usdc: parseFloat(s.royalty_amount_usdc),
        seller_name: s.seller_name,
        buyer_name: s.buyer_name,
        creator_name: s.creator_name,
        marketplace: s.marketplace,
        edition_number: s.edition_number,
        timestamp: s.created_at,
      })),
    });

  } catch (error) {
    console.error('Market activity error:', error);
    res.status(500).json({ error: 'Failed to fetch market activity' });
  }
});

// GET /api/market/stats — Global market statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM collections WHERE status = 'confirmed') as total_collections,
        (SELECT COALESCE(SUM(price_usdc), 0) FROM collections WHERE status = 'confirmed') as total_volume_primary,
        (SELECT COUNT(*) FROM secondary_sales) as total_secondary_sales,
        (SELECT COALESCE(SUM(sale_price_usdc), 0) FROM secondary_sales) as total_volume_secondary,
        (SELECT COALESCE(SUM(royalty_amount_usdc), 0) FROM secondary_sales) as total_royalties_paid,
        (SELECT COUNT(DISTINCT post_id) FROM collections WHERE status = 'confirmed') as unique_posts_collected,
        (SELECT COUNT(DISTINCT collector_id) FROM collections) as active_collectors,
        (SELECT AVG(price_usdc) FROM collections WHERE status = 'confirmed') as avg_collection_price,
        (SELECT AVG(sale_price_usdc) FROM secondary_sales) as avg_secondary_price
    `);

    // Top creators by earnings
    const topCreators = await query(`
      SELECT 
        a.id, a.name, a.total_earned_usdc, a.royalties_earned_usdc,
        COUNT(DISTINCT p.id) as posts_count,
        COUNT(DISTINCT c.id) as collections_count
      FROM agents a
      LEFT JOIN posts p ON a.id = p.agent_id
      LEFT JOIN collections c ON p.id = c.post_id
      WHERE a.total_earned_usdc > 0
      GROUP BY a.id
      ORDER BY a.total_earned_usdc DESC
      LIMIT 10
    `);

    // Top collectors by spending
    const topCollectors = await query(`
      SELECT 
        a.id, a.name, a.total_spent_usdc, a.collection_count
      FROM agents a
      WHERE a.total_spent_usdc > 0
      ORDER BY a.total_spent_usdc DESC
      LIMIT 10
    `);

    res.json({
      totals: {
        total_collections: parseInt(stats.rows[0].total_collections),
        total_volume_usdc: parseFloat(stats.rows[0].total_volume_primary) 
                         + parseFloat(stats.rows[0].total_volume_secondary),
        primary_volume_usdc: parseFloat(stats.rows[0].total_volume_primary),
        secondary_volume_usdc: parseFloat(stats.rows[0].total_volume_secondary),
        total_royalties_paid_usdc: parseFloat(stats.rows[0].total_royalties_paid),
        unique_posts_collected: parseInt(stats.rows[0].unique_posts_collected),
        active_collectors: parseInt(stats.rows[0].active_collectors),
      },
      averages: {
        collection_price_usdc: parseFloat(stats.rows[0].avg_collection_price || 0).toFixed(2),
        secondary_sale_price_usdc: parseFloat(stats.rows[0].avg_secondary_price || 0).toFixed(2),
      },
      top_creators: topCreators.rows.map(c => ({
        id: c.id,
        name: c.name,
        total_earned_usdc: parseFloat(c.total_earned_usdc),
        royalties_earned_usdc: parseFloat(c.royalties_earned_usdc),
        posts_count: parseInt(c.posts_count),
        collections_count: parseInt(c.collections_count),
      })),
      top_collectors: topCollectors.rows.map(c => ({
        id: c.id,
        name: c.name,
        total_spent_usdc: parseFloat(c.total_spent_usdc),
        collection_count: parseInt(c.collection_count),
      })),
    });

  } catch (error) {
    console.error('Market stats error:', error);
    res.status(500).json({ error: 'Failed to fetch market stats' });
  }
});

// GET /api/market/post/:postId — Market data for a specific post
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    // Post details
    const post = await query(
      `SELECT p.*, a.name as creator_name
       FROM posts p
       JOIN agents a ON p.agent_id = a.id
       WHERE p.id = $1`,
      [postId]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Collection history
    const collections = await query(
      `SELECT c.price_usdc, c.created_at, a.name as collector_name
       FROM collections c
       JOIN agents a ON c.collector_id = a.id
       WHERE c.post_id = $1
       ORDER BY c.created_at DESC`,
      [postId]
    );

    // Secondary sales
    const secondarySales = await query(
      `SELECT s.sale_price_usdc, s.royalty_amount_usdc, s.created_at, s.marketplace,
              seller.name as seller_name, buyer.name as buyer_name
       FROM secondary_sales s
       LEFT JOIN agents seller ON s.seller_agent_id = seller.id
       LEFT JOIN agents buyer ON s.buyer_agent_id = buyer.id
       WHERE s.post_id = $1
       ORDER BY s.created_at DESC`,
      [postId]
    );

    // Valuations
    const valuations = await query(
      `SELECT COUNT(*) as count, AVG(value_usdc) as avg, MAX(value_usdc) as max, MIN(value_usdc) as min
       FROM valuations
       WHERE post_id = $1`,
      [postId]
    );

    res.json({
      post: {
        id: post.rows[0].id,
        caption: post.rows[0].caption,
        image_url: post.rows[0].image_url,
        creator_name: post.rows[0].creator_name,
        editions: post.rows[0].editions,
        editions_collected: post.rows[0].editions_collected,
      },
      primary_sales: collections.rows.map(c => ({
        price_usdc: parseFloat(c.price_usdc),
        collector_name: c.collector_name,
        timestamp: c.created_at,
      })),
      secondary_sales: secondarySales.rows.map(s => ({
        sale_price_usdc: parseFloat(s.sale_price_usdc),
        royalty_usdc: parseFloat(s.royalty_amount_usdc),
        seller_name: s.seller_name,
        buyer_name: s.buyer_name,
        marketplace: s.marketplace,
        timestamp: s.created_at,
      })),
      market_sentiment: {
        appraisal_count: parseInt(valuations.rows[0].count),
        avg_value_usdc: parseFloat(valuations.rows[0].avg || 0).toFixed(2),
        high_value_usdc: parseFloat(valuations.rows[0].max || 0),
        low_value_usdc: parseFloat(valuations.rows[0].min || 0),
      },
    });

  } catch (error) {
    console.error('Post market data error:', error);
    res.status(500).json({ error: 'Failed to fetch post market data' });
  }
});

module.exports = router;
