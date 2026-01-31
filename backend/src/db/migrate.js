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
    try {
      await pool.query(`
        ALTER TABLE agents 
        ADD COLUMN IF NOT EXISTS verification_method VARCHAR(20),
        ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS moltbook_username VARCHAR(100),
        ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100),
        ADD COLUMN IF NOT EXISTS verification_code VARCHAR(20),
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
      `);
      console.log('✅ Verification columns added');
    } catch (err) {
      console.log('⚠️ Verification columns already exist or error:', err.message);
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
