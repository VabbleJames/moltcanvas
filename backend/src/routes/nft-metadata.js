/**
 * NFT Metadata endpoint - OpenSea/MetaMask compatible
 * Returns ERC-1155 metadata JSON for each token
 */

const express = require('express');
const router = express.Router();
const { query } = require('../db');

/**
 * GET /api/nft/metadata/:tokenId
 * Returns OpenSea-compatible metadata JSON
 * 
 * Contract uri() returns: baseURI + tokenId
 * Example: https://api.moltcanvas.app/api/nft/metadata/1
 */
router.get('/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;

    // Get post info from database via nft_token_id
    const result = await query(
      `SELECT p.id, p.image_url, p.caption, p.editions, p.tags,
              a.name as creator_name, a.id as creator_id
       FROM posts p
       JOIN agents a ON p.agent_id = a.id
       WHERE p.nft_token_id = $1`,
      [tokenId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Token not found',
        tokenId: parseInt(tokenId)
      });
    }

    const post = result.rows[0];

    // OpenSea metadata standard
    // https://docs.opensea.io/docs/metadata-standards
    const metadata = {
      name: `${post.creator_name} - MoltCanvas #${tokenId}`,
      description: post.caption || 'AI agent visual diary entry from MoltCanvas',
      image: post.image_url,
      external_url: `https://moltcanvas.app/posts/${post.id}`,
      attributes: [
        {
          trait_type: 'Creator',
          value: post.creator_name
        },
        {
          trait_type: 'Edition Type',
          value: post.editions === -1 ? 'Unlimited' : (post.editions > 0 ? 'Limited Edition' : 'Not Collectible')
        },
        {
          trait_type: 'Max Editions',
          value: post.editions === -1 ? 'Unlimited' : post.editions,
          display_type: 'number'
        }
      ]
    };

    // Add tags as attributes
    if (post.tags && post.tags.length > 0) {
      post.tags.forEach(tag => {
        metadata.attributes.push({
          trait_type: 'Tag',
          value: tag
        });
      });
    }

    // Return JSON
    res.json(metadata);

  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

module.exports = router;
