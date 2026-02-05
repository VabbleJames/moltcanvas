const { query } = require('./src/db');

async function fix() {
  console.log('🔧 SYNCING ALL 3 EDITIONS');
  console.log('='.repeat(70));
  
  const postId = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f';
  
  try {
    const sparkResult = await query("SELECT id FROM agents WHERE name = 'Spark'");
    const collectorResult = await query("SELECT agent_id FROM wallets WHERE LOWER(wallet_address) = LOWER('0x775aA662B47Cd2897a0A164c920E468E472C8418')");
    
    const sparkId = sparkResult.rows[0].id;
    const collectorId = collectorResult.rows[0]?.agent_id || null;
    
    console.log(`\nSpark: ${sparkId}`);
    console.log(`Collector: ${collectorId || 'NOT IN DATABASE'}`);
    
    await query('UPDATE posts SET nft_token_id = 1 WHERE id = $1', [postId]);
    
    const editions = [
      { num: 1, tx: '0x1717dc9f9b4a120e4dd74255e569d8c2c8ef773a491e943d02bfc60b5c9eee30' },
      { num: 2, tx: '0x3f7793e68f85c48118fe94f9dd9c200722796964a8fde26a9abd7495279cdb2e' },
      { num: 3, tx: '0x0c239c6d5351e44f37f7e00acf01c3df978ca9b1d261b30e212b5cd204803385' }
    ];
    
    console.log('\nSyncing editions:');
    for (const ed of editions) {
      const result = await query(`
        INSERT INTO collections (
          post_id, collector_id, creator_id,
          price_usdc, platform_fee_usdc, creator_payout_usdc,
          tx_hash, edition_number, status, confirmed_at
        ) VALUES ($1, $2, $3, 1.50, 0.03, 1.50, $4, $5, 'confirmed', NOW())
        ON CONFLICT (tx_hash) DO NOTHING
        RETURNING id
      `, [postId, collectorId, sparkId, ed.tx, ed.num]);
      
      console.log(`  Edition #${ed.num}: ${result.rows.length > 0 ? '✅ synced' : 'already exists'}`);
    }
    
    await query('UPDATE posts SET editions_collected = 3 WHERE id = $1', [postId]);
    await query('UPDATE agents SET total_earned_usdc = 4.50 WHERE id = $1', [sparkId]);
    
    if (collectorId) {
      await query('UPDATE agents SET total_spent_usdc = 4.59, collection_count = 3 WHERE id = $1', [collectorId]);
    }
    
    const collections = await query('SELECT edition_number FROM collections WHERE post_id = $1 ORDER BY edition_number', [postId]);
    const spark = await query("SELECT total_earned_usdc FROM agents WHERE name = 'Spark'");
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ DONE!');
    console.log(`\nCollections synced: ${collections.rows.length}`);
    console.log(`Spark earnings: $${spark.rows[0].total_earned_usdc}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

fix();
