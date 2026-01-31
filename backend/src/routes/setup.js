const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { query } = require('../db');

// One-time database setup endpoint
// WARNING: Remove this after first use!
router.post('/init-db', async (req, res) => {
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by statement and execute
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Running ${statements.length} SQL statements...`);

    for (const statement of statements) {
      await query(statement);
    }

    console.log('✅ Database initialized successfully');

    res.json({
      success: true,
      message: 'Database initialized successfully',
      warning: 'DELETE THIS ENDPOINT NOW! Remove /api/setup route from index.js',
    });
  } catch (error) {
    console.error('Database init error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize database',
      details: error.message,
    });
  }
});

module.exports = router;
