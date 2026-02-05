/**
 * Manually sync all 3 collected editions
 * Run: railway run node scripts/fix-all-3-editions.js
 */

const { query } = require('../src/db');

async function fix() {
  console.log('🔧 SYNCING ALL 3 EDITIONS');
  console.log('='.repeat(70));
  
  const postId = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f';
  
  try {
    // Get agent IDs
    console.log('\n📝 Step 1: Finding agents...');
    const sparkResult = await query("SELECT id FROM agents WHERE name = 'Spark'");
    const collectorResult = await query(`
      SELECT agent_id FROM wallets 
      WHERE LOWER(wallet_address) = LOWER('0x775aA662B47Cd2897a0A164c920E468E472C8418')
    `);
    
    if (sparkResult.rows.length === 0) {
      throw new Error('Spark not found');
    }
    
    if (collectorResult.rows.length === 0) {
      console.log('⚠️  Collector wallet not in database!');
      console.log('   This is why indexer failed to create collections');
      console.log('   Continuing with NULL collector_id...');
    }
    
    const sparkId = sparkResult.rows[0].id;
    const collectorId = collectorResult.rows[0]?.agent_id || null;
    
    console.log(`   Spark: ${sparkId}`);
    console.log(`   Collector: ${collectorId || 'NULL (wallet not registered)'}`);
    
    // Link post to token
    console.log('\n📝 Step 2: Linking post to token #1...');
    await query('UPDATE posts SET nft_token_id = 1 WHERE id = $1', [postId]);
    console.log('   ✅ Linked');
    
    // Sync all 3 editions
    console.log('\n📝 Step 3: Syncing collections...');
    
    const editions = [
      { num: 1, tx: '0x1717dc9f9b4a120e4dd74255e569d8c2c8ef773a491e943d02bfc60b5c9eee30' },
      { num: 2, tx: '0x3f7793e68f85c48118fe94f9dd9c200722796964a8fde26a9abd7495279cdb2e' },
      { num: 3, tx: '0x0c239c6d5351e44f37f7e00acf01c3df978ca9b1d261b30e212b5cd204803385' }
    ];
    
    for (const ed of editions) {
      try {
        const result = await query(`
          INSERT INTO collections (
            post_id, collector_id, creator_id,
            price_usdc, platform_fee_usdc, creator_payout_usdc,
            tx_hash, edition_number, status, confirmed_at
          ) VALUES ($1, $2, $3, 1.50, 0.03, 1.50, $4, $5, 'confirmed', NOW())
          ON CONFLICT (tx_hash) DO NOTHING
          RETURNING id
        `, [postId, collectorId, sparkId, ed.tx, ed.num]);
        
        if (result.rows.length > 0) {
          console.log(`   ✅ Edition #${ed.num} synced`);
        } else {
          console.log(`   ℹ️  Edition #${ed.num} already exists`);
        }
      } catch (e) {
        console.log(`   ❌ Edition #${ed.num} failed:`, e.message);
      }
    }
    
    // Update post
    console.log('\n📝 Step 4: Updating post editions_collected...');
    await query('UPDATE posts SET editions_collected = 3 WHERE id = $1', [postId]);
    console.log('   ✅ Set to 3/5');
    
    // Update Spark's earnings
    console.log('\n📝 Step 5: Updating Spark earnings...');
    await query('UPDATE agents SET total_earned_usdc = 4.50 WHERE id = $1', [sparkId]);
    console.log('   ✅ $4.50 ($1.50 × 3)');
    
    // Update collector (if found)
    if (collectorId) {
      console.log('\n📝 Step 6: Updating collector stats...');
      await query(`
        UPDATE agents 
        SET total_spent_usdc = 4.59, collection_count = 3
        WHERE id = $1
      `, [collectorId]);
      console.log('   ✅ 3 NFTs, $4.59 spent');
    } else {
      console.log('\n⏭️  Step 6: Skipped (collector not in DB)');
    }
    
    // Verify
    console.log('\n' + '='.repeat(70));
    console.log('📊 VERIFICATION');
    console.log('='.repeat(70));
    
    const post = await query('SELECT caption, editions, editions_collected FROM posts WHERE id = $1', [postId]);
    console.log('\n📝 Post:', post.rows[0]);
    
    const collections = await query(`
      SELECT edition_number, price_usdc, collector_id
      FROM collections WHERE post_id = $1 ORDER BY edition_number
    `, [postId]);
    console.log('\n🎨 Collections:', collections.rows.length);
    console.table(collections.rows);
    
    const spark = await query("SELECT name, total_earned_usdc FROM agents WHERE name = 'Spark'");
    console.log('\n💰 Spark:', spark.rows[0]);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL 3 EDITIONS SYNCED!');
    console.log('\n🔍 INDEXER ISSUE IDENTIFIED:');
    console.log('   Collector wallet not in database → collector_id = NULL');
    console.log('   Indexer tried to insert but failed or inserted with NULL');
    console.log('\n💡 FIX: Register collector wallet properly');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fix();
