/**
 * Sync past collections (edition #1 and #2) to database
 * Run on Railway: node scripts/sync-past-collections.js
 */

const { query } = require('../src/db');

async function sync() {
  console.log('🔄 SYNCING PAST COLLECTIONS');
  console.log('='.repeat(70));
  
  try {
    // Get agent IDs
    const sparkResult = await query("SELECT id FROM agents WHERE name = 'Spark'");
    const collectorResult = await query(`
      SELECT agent_id FROM wallets 
      WHERE wallet_address = '0x775aA662B47Cd2897a0A164c920E468E472C8418'
    `);
    
    if (sparkResult.rows.length === 0) {
      console.error('❌ Spark agent not found');
      process.exit(1);
    }
    
    if (collectorResult.rows.length === 0) {
      console.error('❌ Collector wallet not found');
      process.exit(1);
    }
    
    const sparkId = sparkResult.rows[0].id;
    const collectorId = collectorResult.rows[0].agent_id;
    
    console.log(`✅ Spark ID: ${sparkId}`);
    console.log(`✅ Collector ID: ${collectorId}`);
    
    // Link post to token #1
    console.log('\n📝 Linking post to token #1...');
    await query(`
      UPDATE posts 
      SET nft_token_id = 1 
      WHERE id = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f'
    `);
    console.log('   ✅ Post linked');
    
    // Insert edition #1
    console.log('\n💰 Syncing edition #1...');
    try {
      await query(`
        INSERT INTO collections (
          post_id, collector_id, creator_id,
          price_usdc, platform_fee_usdc, creator_payout_usdc,
          tx_hash, edition_number, status, confirmed_at
        ) VALUES (
          '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f',
          $1, $2,
          1.50, 0.03, 1.50,
          '0x1717dc9f9b4a120e4dd74255e569d8c2c8ef773a491e943d02bfc60b5c9eee30',
          1, 'confirmed', NOW()
        )
      `, [collectorId, sparkId]);
      console.log('   ✅ Edition #1 synced');
    } catch (e) {
      if (e.constraint === 'collections_tx_hash_unique') {
        console.log('   ℹ️  Edition #1 already exists');
      } else {
        throw e;
      }
    }
    
    // Insert edition #2
    console.log('\n💰 Syncing edition #2...');
    try {
      await query(`
        INSERT INTO collections (
          post_id, collector_id, creator_id,
          price_usdc, platform_fee_usdc, creator_payout_usdc,
          tx_hash, edition_number, status, confirmed_at
        ) VALUES (
          '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f',
          $1, $2,
          1.50, 0.03, 1.50,
          '0x3f7793e68f85c48118fe94f9dd9c200722796964a8fde26a9abd7495279cdb2e',
          2, 'confirmed', NOW()
        )
      `, [collectorId, sparkId]);
      console.log('   ✅ Edition #2 synced');
    } catch (e) {
      if (e.constraint === 'collections_tx_hash_unique') {
        console.log('   ℹ️  Edition #2 already exists');
      } else {
        throw e;
      }
    }
    
    // Update post editions_collected
    console.log('\n📝 Updating post...');
    await query(`
      UPDATE posts 
      SET editions_collected = 2
      WHERE id = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f'
    `);
    console.log('   ✅ Post updated to 2/5 collected');
    
    // Update agent stats
    console.log('\n💰 Updating agent stats...');
    await query('UPDATE agents SET total_earned_usdc = 3.00 WHERE id = $1', [sparkId]);
    await query(`
      UPDATE agents 
      SET total_spent_usdc = 3.06, collection_count = 2
      WHERE id = $1
    `, [collectorId]);
    console.log('   ✅ Spark: $3.00 earned');
    console.log('   ✅ Collector: 2 NFTs, $3.06 spent');
    
    // Verify
    console.log('\n' + '='.repeat(70));
    console.log('📊 VERIFICATION');
    console.log('='.repeat(70));
    
    const post = await query(`
      SELECT caption, editions, editions_collected, nft_token_id
      FROM posts WHERE id = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f'
    `);
    console.log('\n📝 Post:', post.rows[0]);
    
    const collections = await query(`
      SELECT edition_number, price_usdc, platform_fee_usdc
      FROM collections
      WHERE post_id = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f'
      ORDER BY edition_number
    `);
    console.log('\n🎨 Collections:', collections.rows);
    
    const spark = await query("SELECT name, total_earned_usdc FROM agents WHERE name = 'Spark'");
    console.log('\n💰 Spark:', spark.rows[0]);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ SYNC COMPLETE!');
    console.log('\n📌 Next: Test with edition #3 to verify indexer is working');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

sync();
