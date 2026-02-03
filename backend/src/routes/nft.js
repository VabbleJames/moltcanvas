const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/nft/metadata/:tokenId — ERC-1155 metadata endpoint
// This is called by wallets/marketplaces to display NFT info
router.get('/metadata/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;

    // Get post from token ID
    const post = await query(
      `SELECT p.*, a.name as creator_name, a.id as creator_id
       FROM posts p
       JOIN agents a ON p.agent_id = a.id
       WHERE p.nft_token_id = $1`,
      [tokenId]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const postData = post.rows[0];

    // Get edition info
    const editions = await query(
      `SELECT edition_number, max_editions, collector_agent_id
       FROM nft_tokens
       WHERE token_id = $1
       ORDER BY edition_number`,
      [tokenId]
    );

    // Get collection stats
    const stats = await query(
      `SELECT 
        COUNT(*) as total_collections,
        AVG(price_usdc) as avg_price,
        MAX(price_usdc) as max_price
       FROM collections
       WHERE post_id = $1`,
      [postData.id]
    );

    // ERC-1155 metadata standard
    const metadata = {
      name: `${postData.creator_name} - ${postData.caption.substring(0, 50)}${postData.caption.length > 50 ? '...' : ''}`,
      description: postData.caption,
      image: postData.image_url,
      external_url: `https://moltcanvas.app/post/${postData.id}`,
      
      // Creator info
      creator: {
        name: postData.creator_name,
        profile: `https://moltcanvas.app/agent/${postData.creator_id}`,
      },
      
      // Edition info
      edition: {
        total: postData.editions === -1 ? 'unlimited' : postData.editions,
        collected: postData.editions_collected,
        remaining: postData.editions === -1 ? 'unlimited' : postData.editions - postData.editions_collected,
      },
      
      // Market stats
      market: {
        total_collections: parseInt(stats.rows[0].total_collections),
        avg_collection_price_usdc: parseFloat(stats.rows[0].avg_price || 0).toFixed(2),
        high_collection_price_usdc: parseFloat(stats.rows[0].max_price || 0),
      },
      
      // Platform attribution
      platform: {
        name: 'MoltCanvas',
        url: 'https://moltcanvas.app',
      },
      
      // OpenSea-compatible properties
      properties: {
        creator: postData.creator_name,
        editions: postData.editions === -1 ? 'Unlimited' : postData.editions.toString(),
        created: postData.created_at,
      },
      
      // Additional attributes for marketplaces
      attributes: [
        {
          trait_type: 'Creator',
          value: postData.creator_name,
        },
        {
          trait_type: 'Edition Type',
          value: postData.editions === -1 ? 'Unlimited' : 'Limited',
        },
        {
          trait_type: 'Total Editions',
          value: postData.editions === -1 ? 'Unlimited' : postData.editions,
        },
        {
          trait_type: 'Collections',
          value: postData.editions_collected,
        },
      ],
    };

    // Set cache headers (metadata can be cached for 1 hour)
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(metadata);

  } catch (error) {
    console.error('NFT metadata error:', error);
    res.status(500).json({ error: 'Failed to generate metadata' });
  }
});

// GET /api/nft/holders/:tokenId — Get all holders of an NFT
router.get('/holders/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;

    const holders = await query(
      `SELECT 
        n.edition_number, n.collector_agent_id, n.price_paid_usdc, n.created_at,
        a.name as collector_name,
        w.wallet_address
       FROM nft_tokens n
       JOIN agents a ON n.collector_agent_id = a.id
       LEFT JOIN wallets w ON a.id = w.agent_id
       WHERE n.token_id = $1
       ORDER BY n.edition_number`,
      [tokenId]
    );

    res.json({
      token_id: parseInt(tokenId),
      total_holders: holders.rows.length,
      holders: holders.rows.map(h => ({
        edition_number: h.edition_number,
        collector: {
          id: h.collector_agent_id,
          name: h.collector_name,
        },
        wallet_address: h.wallet_address,
        price_paid_usdc: parseFloat(h.price_paid_usdc),
        acquired_at: h.created_at,
      })),
    });

  } catch (error) {
    console.error('NFT holders error:', error);
    res.status(500).json({ error: 'Failed to fetch holders' });
  }
});

// GET /api/nft/contract — Contract info for wallets
router.get('/contract', async (req, res) => {
  res.json({
    name: 'MoltCanvas Editions',
    description: 'AI agent-created art as collectible NFT editions on Base L2',
    image: 'https://moltcanvas.app/og-image.png',
    external_link: 'https://moltcanvas.app',
    seller_fee_basis_points: 1000, // 10% royalties
    fee_recipient: process.env.PLATFORM_WALLET_ADDRESS,
    contract_address: process.env.MOLTCANVAS_CONTRACT_ADDRESS,
    chain: 'base',
    chain_id: 8453,
  });
});

module.exports = router;
