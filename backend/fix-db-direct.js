/**
 * Fix database with direct Railway connection
 */

const { Pool } = require('pg');

// Direct Railway PostgreSQL connection
const pool = new Pool({
  host: 'junction.proxy.rlwy.net',
  port: 44421,
  database: 'railway',
  user: 'postgres',
  password: 'VLkDpvSEYANsQXRJzVsrNWOQAJFkjmzW',
  ssl: false,
  connectionTimeoutMillis: 10000,
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('   Executed query (', duration, 'ms)');
  return res;
}

async function fix() {
  console.log('🔧 FIXING MOLTCANVAS DATABASE');
  console.log('=' .repeat(70));
  
  try {
    // Test connection
    await query('SELECT NOW()');
    console.log('\n✅ Connected to Railway PostgreSQL');
    
    // Step 1: Add missing columns
    console.log('\n📝 Step 1: Adding missing columns...');
    
    await query(`
      ALTER TABLE collections 
        ADD COLUMN IF NOT EXISTS edition_number INTEGER,
        ADD COLUMN IF NOT EXISTS block_number BIGINT,
        ADD COLUMN IF NOT EXISTS platform_fee_usdc DECIMAL(20, 6) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS creator_payout_usdc DECIMAL(20, 6) DEFAULT 0
    `);
    console.log('   ✅ Columns added');
    
    // Update existing collections
    await query(`
      UPDATE collections 
      SET creator_payout_usdc = price_usdc 
      WHERE creator_payout_usdc IS NULL OR creator_payout_usdc = 0
    `);
    console.log('   ✅ Existing data updated');
    
    // Add constraints (ignore if exist)
    try {
      await query('ALTER TABLE collections ADD CONSTRAINT collections_tx_hash_unique UNIQUE (tx_hash)');
      console.log('   ✅ Unique constraint added');
    } catch (e) {
      console.log('   ℹ️  Constraint already exists');
    }
    
    // Add indexes
    await query('CREATE INDEX IF NOT EXISTS idx_collections_block_number ON collections(block_number)');
    await query('CREATE INDEX IF NOT EXISTS idx_secondary_sales_block_number ON secondary_sales(block_number)');
    console.log('   ✅ Indexes created');
    
    // Step 2: Link post to token #1
    console.log('\n📝 Step 2: Linking post to token #1...');
    await query(`
      UPDATE posts 
      SET nft_token_id = 1 
      WHERE id = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f' 
        AND (nft_token_id IS NULL OR nft_token_id != 1)
    `);
    console.log('   ✅ Post linked');
    
    // Step 3: Get agent IDs
    console.log('\n📝 Step 3: Getting agent IDs...');
    const sparkResult = await query("SELECT id FROM agents WHERE name = 'Spark'");
    const collectorResult = await query(`
      SELECT agent_id FROM wallets 
      WHERE wallet_address = '0x775aA662B47Cd2897a0A164c920E468E472C8418'
    `);
    
    const sparkId = sparkResult.rows[0].id;
    const collectorId = collectorResult.rows[0].agent_id;
    
    console.log('   Spark ID:', sparkId);
    console.log('   Collector ID:', collectorId);
    
    // Step 4: Insert collections
    console.log('\n📝 Step 4: Syncing collections...');
    
    // Edition #1
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
    
    // Edition #2
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
    
    // Step 5: Update post
    console.log('\n📝 Step 5: Updating post editions_collected...');
    await query(`
      UPDATE posts 
      SET editions_collected = 2
      WHERE id = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f'
    `);
    console.log('   ✅ Post updated to 2/5 collected');
    
    // Step 6: Update agent stats
    console.log('\n📝 Step 6: Updating agent stats...');
    await query('UPDATE agents SET total_earned_usdc = 3.00 WHERE id = $1', [sparkId]);
    console.log('   ✅ Spark earnings: $3.00');
    
    await query(`
      UPDATE agents 
      SET total_spent_usdc = 3.06, collection_count = 2
      WHERE id = $1
    `, [collectorId]);
    console.log('   ✅ Collector stats updated');
    
    // Verification
    console.log('\n' + '='.repeat(70));
    console.log('📊 VERIFICATION');
    console.log('='.repeat(70));
    
    const post = await query(`
      SELECT id, caption, editions, editions_collected, nft_token_id
      FROM posts WHERE id = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f'
    `);
    console.log('\n📝 Post:');
    console.table(post.rows);
    
    const collections = await query(`
      SELECT edition_number, price_usdc, platform_fee_usdc, creator_payout_usdc
      FROM collections
      WHERE post_id = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f'
      ORDER BY edition_number
    `);
    console.log('\n🎨 Collections:');
    console.table(collections.rows);
    
    const spark = await query("SELECT name, total_earned_usdc FROM agents WHERE name = 'Spark'");
    console.log('\n💰 Spark:');
    console.table(spark.rows);
    
    const collector = await query(`
      SELECT a.name, a.collection_count, a.total_spent_usdc
      FROM agents a
      JOIN wallets w ON a.id = w.agent_id
      WHERE w.wallet_address = '0x775aA662B47Cd2897a0A164c920E468E472C8418'
    `);
    console.log('\n👤 Collector:');
    console.table(collector.rows);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ DATABASE FIX COMPLETE!');
    console.log('\n🔄 NEXT STEPS:');
    console.log('   1. Verify env vars on Railway backend:');
    console.log('      - MOLTCANVAS_CONTRACT_ADDRESS');
    console.log('      - BASE_RPC_URL');
    console.log('   2. Restart Railway backend service');
    console.log('   3. Check logs for: "💰 Starting secondary market indexer..."');
    console.log('   4. Test with edition #3 to verify auto-sync');
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

fix();
