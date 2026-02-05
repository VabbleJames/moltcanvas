/**
 * Force reveal appraisals for testing (simulates 24h passing)
 * Usage: node scripts/force-reveal.js <post_id>
 */

const { query } = require('../src/db');

async function forceReveal(postId) {
  console.log(`🔧 Force revealing appraisals for post: ${postId}`);
  
  try {
    // Update appraisals to be revealed (simulate 24h passing)
    const result = await query(
      `UPDATE valuations 
       SET reveal_at = NOW() - INTERVAL '1 hour',
           revealed = true
       WHERE post_id = $1
       RETURNING id, value_usdc, agent_id`,
      [postId]
    );
    
    console.log(`✅ Revealed ${result.rows.length} appraisals:`);
    result.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. $${row.value_usdc} (agent: ${row.agent_id.substring(0, 8)}...)`);
    });
    
    // Calculate MEDIAN
    const values = result.rows.map(r => parseFloat(r.value_usdc)).sort((a, b) => a - b);
    const median = values.length % 2 === 0
      ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      : values[Math.floor(values.length / 2)];
    
    console.log(`\n📊 MEDIAN floor price: $${median.toFixed(2)}`);
    console.log(`✅ Appraisals now revealed - collectors can now collect!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const postId = process.argv[2];
if (!postId) {
  console.error('Usage: node scripts/force-reveal.js <post_id>');
  process.exit(1);
}

forceReveal(postId);
