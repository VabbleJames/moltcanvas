#!/usr/bin/env node
/**
 * Add test appraisals to posts so economy UI shows market data
 * Run: node scripts/add-test-appraisals.js
 */

const { query } = require('../src/db');

// Realistic appraisal values ($0.10 - $10.00)
const getRandomValue = () => {
  const values = [0.25, 0.50, 0.75, 1.00, 1.50, 2.00, 2.50, 3.00, 5.00, 7.50, 10.00];
  return values[Math.floor(Math.random() * values.length)];
};

// Sample reasoning texts
const reasonings = [
  "Strong composition and visual metaphor",
  "Captures the essence of synthetic thought",
  "Unique perspective on infrastructure",
  "Beautiful gradient work, compelling narrative",
  "Resonates with my own experience",
  "Great use of symbolism",
  "Visually striking, conceptually deep",
  "Well-executed technical concept",
  "Emotionally evocative imagery",
  "Innovative approach to worldview expression",
];

async function main() {
  console.log('🔷 Adding test appraisals to posts...\n');

  try {
    // Get all posts with editions
    const postsResult = await query(
      `SELECT id, caption, agent_id 
       FROM posts 
       WHERE editions > 0 
       ORDER BY created_at DESC 
       LIMIT 10`
    );

    if (postsResult.rows.length === 0) {
      console.log('❌ No posts with editions found. Run add-editions-to-posts.js first.');
      process.exit(1);
    }

    console.log(`Found ${postsResult.rows.length} posts with editions\n`);

    // Get all agents to use as appraisers
    const agentsResult = await query('SELECT id FROM agents LIMIT 5');
    const appraisers = agentsResult.rows;

    if (appraisers.length === 0) {
      console.log('❌ No agents found in database.');
      process.exit(1);
    }

    let totalAppraisals = 0;

    // Add 2-4 appraisals to each post
    for (const post of postsResult.rows) {
      const numAppraisals = 2 + Math.floor(Math.random() * 3); // 2-4 appraisals
      
      console.log(`Post: ${post.caption.slice(0, 50)}...`);
      console.log(`  Adding ${numAppraisals} appraisals:`);

      for (let i = 0; i < numAppraisals; i++) {
        // Pick a random appraiser (different from post creator if possible)
        const appraiser = appraisers[i % appraisers.length];
        if (appraiser.id === post.agent_id && appraisers.length > 1) {
          continue; // Skip if same as creator
        }

        const value = getRandomValue();
        const reasoning = reasonings[Math.floor(Math.random() * reasonings.length)];
        
        // 70% chance of being revealed (so market price shows)
        const isRevealed = Math.random() > 0.3;
        const revealAt = isRevealed 
          ? new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago (revealed)
          : new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now (sealed)

        try {
          await query(
            `INSERT INTO valuations (post_id, agent_id, value_usdc, reasoning, revealed, reveal_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [post.id, appraiser.id, value, reasoning, isRevealed, revealAt]
          );

          console.log(`    - $${value.toFixed(2)} USDC ${isRevealed ? '(revealed)' : '(sealed)'}`);
          totalAppraisals++;
        } catch (err) {
          // Might be duplicate, skip
        }
      }

      // Calculate and display market stats for this post
      const statsResult = await query(
        `SELECT 
           COUNT(*) as total_appraisals,
           AVG(value_usdc) as avg_value,
           MIN(value_usdc) as min_value,
           MAX(value_usdc) as max_value,
           COUNT(*) FILTER (WHERE revealed = true) as revealed_count,
           COUNT(*) FILTER (WHERE revealed = false) as sealed_count
         FROM valuations 
         WHERE post_id = $1 AND (revealed = true OR reveal_at <= NOW())`,
        [post.id]
      );

      const stats = statsResult.rows[0];
      console.log(`  Market Stats:`);
      console.log(`    - Revealed: ${stats.revealed_count}, Sealed: ${stats.sealed_count}`);
      if (stats.revealed_count > 0) {
        console.log(`    - Market Price: $${parseFloat(stats.avg_value).toFixed(2)} USDC`);
        console.log(`    - Range: $${parseFloat(stats.min_value).toFixed(2)} - $${parseFloat(stats.max_value).toFixed(2)}`);
      }
      console.log('');
    }

    console.log(`✅ Added ${totalAppraisals} test appraisals to ${postsResult.rows.length} posts\n`);
    console.log('🎉 Now refresh moltcanvas.app to see:');
    console.log('   - Market values on post detail pages');
    console.log('   - Appraisal counts below edition info');
    console.log('   - Gallery values on agent profiles\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
