/**
 * Diagnose why indexer isn't creating collection records
 */

const { query } = require('../src/db');

async function diagnose() {
  console.log('🔍 DIAGNOSING INDEXER ISSUE');
  console.log('='.repeat(70));
  
  try {
    // Check post
    const post = await query(`
      SELECT id, caption, nft_token_id, editions, editions_collected, agent_id
      FROM posts 
      WHERE id = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f'
    `);
    console.log('\n📝 Post:');
    console.log(post.rows[0]);
    
    // Check collections
    const collections = await query(`
      SELECT id, edition_number, price_usdc, tx_hash, collector_id, creator_id
      FROM collections 
      WHERE post_id = '367c4e9b-2736-45cf-b6d5-7d0c9fc6d51f'
      ORDER BY edition_number
    `);
    console.log('\n🎨 Collections in DB:', collections.rows.length);
    if (collections.rows.length > 0) {
      console.table(collections.rows);
    } else {
      console.log('   ❌ No collections found!');
    }
    
    // Check collector wallet
    const collector = await query(`
      SELECT a.id, a.name, w.wallet_address
      FROM agents a
      JOIN wallets w ON a.id = w.agent_id
      WHERE LOWER(w.wallet_address) = $1
    `, ['0x775aa662b47cd2897a0a164c920e468e472c8418']);
    
    console.log('\n👤 Collector agent:');
    if (collector.rows.length > 0) {
      console.log(collector.rows[0]);
    } else {
      console.log('   ❌ Collector wallet NOT FOUND in database!');
      console.log('   This is why indexer can\'t create collection records!');
    }
    
    // Check Spark
    const spark = await query("SELECT id, name, total_earned_usdc FROM agents WHERE name = 'Spark'");
    console.log('\n💰 Spark:');
    console.log(spark.rows[0]);
    
    console.log('\n' + '='.repeat(70));
    console.log('🔍 DIAGNOSIS:');
    
    if (post.rows[0].nft_token_id === null) {
      console.log('   ❌ Post missing nft_token_id');
    } else {
      console.log('   ✅ Post has nft_token_id =', post.rows[0].nft_token_id);
    }
    
    if (collector.rows.length === 0) {
      console.log('   ❌ Collector wallet not in database');
      console.log('   💡 Indexer can\'t find collector agent ID');
      console.log('   💡 Collections get inserted with collector_id = NULL');
    } else {
      console.log('   ✅ Collector found');
    }
    
    if (collections.rows.length === 0) {
      console.log('   ❌ No collection records (indexer failing silently)');
    } else {
      console.log('   ✅', collections.rows.length, 'collections found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnose();
