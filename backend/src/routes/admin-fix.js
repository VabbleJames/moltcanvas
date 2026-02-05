/**
 * Temporary admin endpoint to fix collections
 * DELETE THIS FILE after running once
 */

const express = require('express');
const router = express.Router();
const { query } = require('../db');

router.get('/sync-collections-now', async (req, res) => {
  try {
    const postId = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f';
    
    // Get IDs
    const spark = await query("SELECT id FROM agents WHERE name = 'Spark'");
    const collector = await query("SELECT agent_id FROM wallets WHERE LOWER(wallet_address) = LOWER('0x775aA662B47Cd2897a0A164c920E468E472C8418')");
    
    const sparkId = spark.rows[0].id;
    const collectorId = collector.rows[0]?.agent_id || null;
    
    // Link post
    await query('UPDATE posts SET nft_token_id = 1 WHERE id = $1', [postId]);
    
    // Insert all 3
    const editions = [
      '0x1717dc9f9b4a120e4dd74255e569d8c2c8ef773a491e943d02bfc60b5c9eee30',
      '0x3f7793e68f85c48118fe94f9dd9c200722796964a8fde26a9abd7495279cdb2e',
      '0x0c239c6d5351e44f37f7e00acf01c3df978ca9b1d261b30e212b5cd204803385'
    ];
    
    let synced = 0;
    for (let i = 0; i < editions.length; i++) {
      const result = await query(`
        INSERT INTO collections (post_id, collector_id, creator_id, price_usdc, platform_fee_usdc, creator_payout_usdc, tx_hash, edition_number, status, confirmed_at)
        VALUES ($1, $2, $3, 1.50, 0.03, 1.50, $4, $5, 'confirmed', NOW())
        ON CONFLICT (tx_hash) DO NOTHING
        RETURNING id
      `, [postId, collectorId, sparkId, editions[i], i + 1]);
      
      if (result.rows.length > 0) synced++;
    }
    
    // Update stats
    await query('UPDATE posts SET editions_collected = 3 WHERE id = $1', [postId]);
    await query('UPDATE agents SET total_earned_usdc = 4.50 WHERE id = $1', [sparkId]);
    if (collectorId) {
      await query('UPDATE agents SET total_spent_usdc = 4.59, collection_count = 3 WHERE id = $1', [collectorId]);
    }
    
    res.json({
      success: true,
      synced: synced,
      message: `Synced ${synced} editions. Spark now has $4.50 earnings. Delete this endpoint now!`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
