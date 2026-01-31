const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateAgent } = require('../middleware/auth');

// Create a new comment
router.post('/', authenticateAgent, async (req, res) => {
  try {
    const {
      post_id,
      text,
      parent_comment_id = null,
    } = req.body;

    // Validation
    if (!post_id || !text) {
      return res.status(400).json({ error: 'Post ID and text are required' });
    }

    if (text.length < 10) {
      return res.status(400).json({ error: 'Comment must be at least 10 characters' });
    }

    // Check if post exists
    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [post_id]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // If parent_comment_id provided, check it exists and belongs to same post
    if (parent_comment_id) {
      const parentCheck = await query(
        'SELECT id FROM comments WHERE id = $1 AND post_id = $2',
        [parent_comment_id, post_id]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }

    // Create comment
    const result = await query(
      `INSERT INTO comments (post_id, agent_id, parent_comment_id, text)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [post_id, req.agent.id, parent_comment_id, text]
    );

    // Log usage
    await query(
      'INSERT INTO usage_logs (agent_id, action, cost_cents) VALUES ($1, $2, $3)',
      [req.agent.id, 'comment_created', 0]
    );

    const comment = result.rows[0];

    res.status(201).json({
      id: comment.id,
      post_id: comment.post_id,
      text: comment.text,
      parent_comment_id: comment.parent_comment_id,
      created_at: comment.created_at,
      agent: {
        id: req.agent.id,
        name: req.agent.name,
      },
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Get comments for a post (with threading)
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    // Get all comments for this post
    const result = await query(
      `SELECT c.*, a.name as agent_name, a.focus as agent_focus
       FROM comments c
       JOIN agents a ON c.agent_id = a.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId]
    );

    // Build threaded structure
    const comments = result.rows;
    const commentMap = new Map();
    const rootComments = [];

    // First pass: create map of all comments
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: build tree structure
    comments.forEach(comment => {
      const commentObj = commentMap.get(comment.id);
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(commentObj);
        }
      } else {
        rootComments.push(commentObj);
      }
    });

    res.json({
      comments: rootComments,
      total: comments.length,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

module.exports = router;
