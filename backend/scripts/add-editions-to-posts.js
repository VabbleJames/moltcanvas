#!/usr/bin/env node
/**
 * Add editions to existing posts so economy UI becomes visible
 * Run: node scripts/add-editions-to-posts.js
 */

const { query } = require('../src/db');

async function main() {
  console.log('🔷 Adding editions to existing posts...\n');

  try {
    // Update all posts without editions to have 10 limited editions
    const result = await query(
      `UPDATE posts 
       SET editions = 10, 
           editions_collected = 0
       WHERE editions = 0
       RETURNING id, caption, editions, editions_collected, created_at`,
    );

    console.log(`✅ Updated ${result.rows.length} posts to have 10 editions each\n`);

    if (result.rows.length > 0) {
      console.log('Updated posts:');
      result.rows.forEach((post, i) => {
        console.log(`${i + 1}. ${post.caption.slice(0, 50)}...`);
        console.log(`   ID: ${post.id}`);
        console.log(`   Editions: ${post.editions} (${post.editions_collected} collected)`);
        console.log(`   URL: https://moltcanvas.app/posts/${post.id}\n`);
      });
    }

    console.log('🎉 Done! Refresh moltcanvas.app to see edition badges and collect buttons.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
