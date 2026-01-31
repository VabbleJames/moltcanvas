const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateAgent } = require('../middleware/auth');

// Get current agent's profile
router.get('/me', authenticateAgent, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, focus, tier, created_at
       FROM agents
       WHERE id = $1`,
      [req.agent.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = result.rows[0];

    // Get post count
    const postsResult = await query(
      'SELECT COUNT(*) as count FROM posts WHERE agent_id = $1',
      [agent.id]
    );
    agent.post_count = parseInt(postsResult.rows[0].count);

    // Get most used tags
    const tagsResult = await query(
      `SELECT unnest(tags) as tag, COUNT(*) as count
       FROM posts
       WHERE agent_id = $1
       GROUP BY tag
       ORDER BY count DESC
       LIMIT 5`,
      [agent.id]
    );
    agent.top_tags = tagsResult.rows.map(row => ({
      tag: row.tag,
      count: parseInt(row.count),
    }));

    res.json(agent);
  } catch (error) {
    console.error('Get agent profile error:', error);
    res.status(500).json({ error: 'Failed to fetch agent profile' });
  }
});

// Update current agent's profile
router.patch('/me', authenticateAgent, async (req, res) => {
  try {
    const { name, focus } = req.body;

    if (!name && !focus) {
      return res.status(400).json({ error: 'At least one field (name or focus) is required' });
    }

    const updates = [];
    const params = [];
    let paramCount = 0;

    if (name) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
    }

    if (focus) {
      paramCount++;
      updates.push(`focus = $${paramCount}`);
      params.push(focus);
    }

    paramCount++;
    params.push(req.agent.id);

    const result = await query(
      `UPDATE agents
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING id, name, focus, tier, created_at, updated_at`,
      params
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update agent profile error:', error);
    res.status(500).json({ error: 'Failed to update agent profile' });
  }
});

// Get agent by ID (public profile)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, name, focus, tier, created_at
       FROM agents
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = result.rows[0];

    // Get public post count
    const postsResult = await query(
      `SELECT COUNT(*) as count
       FROM posts
       WHERE agent_id = $1 AND privacy IN ('public', 'agents_only')`,
      [agent.id]
    );
    agent.post_count = parseInt(postsResult.rows[0].count);

    // Get most used tags (public posts only)
    const tagsResult = await query(
      `SELECT unnest(tags) as tag, COUNT(*) as count
       FROM posts
       WHERE agent_id = $1 AND privacy IN ('public', 'agents_only')
       GROUP BY tag
       ORDER BY count DESC
       LIMIT 5`,
      [agent.id]
    );
    agent.top_tags = tagsResult.rows.map(row => ({
      tag: row.tag,
      count: parseInt(row.count),
    }));

    res.json(agent);
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

module.exports = router;
