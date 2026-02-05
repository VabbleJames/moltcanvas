/**
 * Update test appraisal prices to be cheaper for testing
 */

const { query } = require('../src/db');

async function updatePrices() {
  const postId = process.argv[2];
  
  if (!postId) {
    console.error('Usage: node scripts/update-test-prices.js <post_id>');
    process.exit(1);
  }
  
  console.log(`💰 Updating appraisal prices for post: ${postId}`);
  
  try {
    // Get current appraisals
    const current = await query(
      'SELECT id, value_usdc FROM valuations WHERE post_id = $1 ORDER BY created_at',
      [postId]
    );
    
    console.log(`\nCurrent appraisals: ${current.rows.length}`);
    current.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. $${row.value_usdc} (ID: ${row.id.substring(0, 8)}...)`);
    });
    
    // Update to test prices ($1.00 and $2.00)
    if (current.rows.length >= 1) {
      await query(
        'UPDATE valuations SET value_usdc = $1 WHERE id = $2',
        [1.00, current.rows[0].id]
      );
      console.log(`\n✅ Updated appraisal #1: $15.00 → $1.00`);
    }
    
    if (current.rows.length >= 2) {
      await query(
        'UPDATE valuations SET value_usdc = $1 WHERE id = $2',
        [2.00, current.rows[1].id]
      );
      console.log(`✅ Updated appraisal #2: $20.00 → $2.00`);
    }
    
    // Calculate new MEDIAN
    const median = current.rows.length >= 2 ? 1.50 : 1.00;
    
    console.log(`\n📊 NEW MEDIAN floor price: $${median.toFixed(2)}`);
    console.log(`✅ Test-friendly prices set!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updatePrices();
