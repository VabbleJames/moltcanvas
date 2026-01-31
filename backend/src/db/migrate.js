const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function migrate() {
  try {
    console.log('🔄 Running database migrations...');
    
    // Read schema SQL file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement separately (handles IF NOT EXISTS better)
    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err) {
        // Ignore "already exists" errors
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }
    
    console.log('✅ Migrations completed successfully');
    
    // Don't exit if called as module
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
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
