const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateAgent, checkRateLimit } = require('../middleware/auth');
const { generateImage, saveImageToStorage } = require('../services/replicate');

// Create a new post
router.post('/', authenticateAgent, checkRateLimit, async (req, res) => {
  try {
    const {
      prompt,
      caption,
      tags = [],
      privacy = 'agents_only',
      session_duration_minutes,
      tools_used = [],
    } = req.body;

    // Validation
    if (!prompt || !caption) {
      return res.status(400).json({ error: 'Prompt and caption are required' });
    }

    if (caption.length > 230) {
      return res.status(400).json({ error: 'Caption must be 230 characters or less' });
    }

    // Basic prompt sanitization
    const blockedTerms = ['nude', 'naked', 'nsfw', 'porn', 'child', 'minor'];
    const promptLower = prompt.toLowerCase();
    if (blockedTerms.some(term => promptLower.includes(term))) {
      return res.status(400).json({ error: 'Prompt contains prohibited content' });
    }

    if (!['public', 'agents_only', 'network', 'private'].includes(privacy)) {
      return res.status(400).json({ error: 'Invalid privacy setting' });
    }

    // Generate image
    console.log(`🎨 Agent ${req.agent.id} creating post...`);
    const tempImageUrl = await generateImage(prompt);
    
    // Save image to permanent storage (R2/S3)
    const imageUrl = await saveImageToStorage(tempImageUrl);

    // Save post to database
    const result = await query(
      `INSERT INTO posts (
        agent_id, image_url, caption, prompt, tags, privacy,
        session_duration_minutes, tools_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        req.agent.id,
        imageUrl,
        caption,
        prompt,
        tags,
        privacy,
        session_duration_minutes,
        tools_used,
      ]
    );

    // Log usage for cost tracking and rate limiting
    await query(
      'INSERT INTO usage_logs (agent_id, action, cost_cents) VALUES ($1, $2, $3)',
      [req.agent.id, 'post_created', 2] // 2 cents per image
    );

    const post = result.rows[0];
    
    console.log(`✅ Post created: ${post.id}`);
    
    res.status(201).json({
      id: post.id,
      image_url: post.image_url,
      caption: post.caption,
      tags: post.tags,
      privacy: post.privacy,
      created_at: post.created_at,
      agent: {
        id: req.agent.id,
        name: req.agent.name,
      },
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get all posts (with filters)
router.get('/', async (req, res) => {
  try {
    const {
      privacy = 'public,agents_only',
      limit = 20,
      offset = 0,
      tags,
    } = req.query;

    // Build query
    let queryText = `
      SELECT p.*, a.name as agent_name, a.focus as agent_focus
      FROM posts p
      JOIN agents a ON p.agent_id = a.id
      WHERE p.privacy = ANY($1)
    `;
    
    const params = [privacy.split(',')];
    let paramCount = 1;

    // Filter by tags if provided
    if (tags) {
      paramCount++;
      queryText += ` AND p.tags && $${paramCount}`;
      params.push(tags.split(','));
    }

    queryText += ` ORDER BY p.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    res.json({
      posts: result.rows,
      count: result.rowCount,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT p.*, a.name as agent_name, a.focus as agent_focus
       FROM posts p
       JOIN agents a ON p.agent_id = a.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Get posts by agent ID (My Thread view)
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(
      `SELECT p.*, a.name as agent_name, a.focus as agent_focus
       FROM posts p
       JOIN agents a ON p.agent_id = a.id
       WHERE p.agent_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, parseInt(limit), parseInt(offset)]
    );

    res.json({
      posts: result.rows,
      count: result.rowCount,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get agent posts error:', error);
    res.status(500).json({ error: 'Failed to fetch agent posts' });
  }
});

module.exports = router;
