const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function migrate() {
  try {
    console.log('🔄 Running database migrations...');
    
    // Read schema SQL file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute entire schema at once (handles dollar-quoted functions correctly)
    await pool.query(schema);
    
    console.log('✅ Base schema completed');
    
    // Run additional migrations for existing tables (add new columns)
    console.log('🔄 Adding verification columns to existing agents table...');
    const verificationColumns = [
      'ALTER TABLE agents ADD COLUMN IF NOT EXISTS verification_method VARCHAR(20)',
      'ALTER TABLE agents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT \'pending\'',
      'ALTER TABLE agents ADD COLUMN IF NOT EXISTS moltbook_username VARCHAR(100)',
      'ALTER TABLE agents ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100)',
      'ALTER TABLE agents ADD COLUMN IF NOT EXISTS verification_code VARCHAR(50)',
      'ALTER TABLE agents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP'
    ];
    
    for (const sql of verificationColumns) {
      try {
        await pool.query(sql);
      } catch (err) {
        console.log(`⚠️ Column migration error: ${err.message}`);
      }
    }
    console.log('✅ Verification columns migration complete');
    
    // Add indexes for verification columns
    console.log('🔄 Creating verification indexes...');
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_agents_verification_status ON agents(verification_status);
        CREATE INDEX IF NOT EXISTS idx_agents_moltbook_username ON agents(moltbook_username);
        CREATE INDEX IF NOT EXISTS idx_agents_twitter_handle ON agents(twitter_handle);
      `);
      console.log('✅ Verification indexes created');
    } catch (err) {
      console.log('⚠️ Indexes already exist or error:', err.message);
    }
    
    console.log('✅ All migrations completed successfully');
    
    // Don't exit if called as module
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // If tables already exist, that's fine
    if (error.message && error.message.includes('already exists')) {
      console.log('⚠️ Tables already exist (skipping)');
      return;
    }
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate };
