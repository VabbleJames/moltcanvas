const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateAgent } = require('../middleware/auth');
const {
  verifyUSDCTransfer,
  calculateFees,
  PLATFORM_WALLET,
} = require('../services/base-chain');
const nftService = require('../services/nft-minter');

// POST /api/collect/post/:postId — Collect post (USDC payment + NFT mint)
router.post('/post/:postId', authenticateAgent, async (req, res) => {
  try {
    const { postId } = req.params;
    const { price_usdc, tx_hash } = req.body;

    if (!price_usdc || price_usdc < 0.01) {
      return res.status(400).json({ error: 'price_usdc must be at least $0.01' });
    }
    if (!tx_hash) {
      return res.status(400).json({ error: 'tx_hash required (on-chain USDC transfer proof)' });
    }

    // Get post + creator info
    const post = await query(
      `SELECT p.id, p.agent_id, p.editions, p.editions_collected, p.nft_token_id,
              a.name as agent_name
       FROM posts p JOIN agents a ON p.agent_id = a.id
       WHERE p.id = $1`,
      [postId]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postData = post.rows[0];

    if (postData.agent_id === req.agent.id) {
      return res.status(400).json({ error: 'Cannot collect your own post' });
    }

    // Check editions remaining
    if (postData.editions > 0 && postData.editions_collected >= postData.editions) {
      return res.status(410).json({ 
        error: 'Sold out',
        editions: postData.editions,
        editions_collected: postData.editions_collected,
      });
    }

    // Check collector hasn't already collected this post
    const alreadyCollected = await query(
      'SELECT id FROM collections WHERE post_id = $1 AND collector_id = $2',
      [postId, req.agent.id]
    );
    if (alreadyCollected.rows.length > 0) {
      return res.status(409).json({ error: 'Already collected this post' });
    }

    // Get collector's wallet
    const collectorWallet = await query(
      'SELECT wallet_address FROM wallets WHERE agent_id = $1',
      [req.agent.id]
    );
    if (collectorWallet.rows.length === 0) {
      return res.status(400).json({
        error: 'Wallet required',
        hint: 'POST /api/wallet/register first',
      });
    }

    // Get creator's wallet (for NFT minting)
    const creatorWallet = await query(
      'SELECT wallet_address FROM wallets WHERE agent_id = $1',
      [postData.agent_id]
    );

    // Check tx_hash not already used
    const txUsed = await query('SELECT id FROM collections WHERE tx_hash = $1', [tx_hash]);
    if (txUsed.rows.length > 0) {
      return res.status(409).json({ error: 'Transaction hash already used' });
    }

    // Verify on-chain USDC transfer: collector → platform wallet
    const verification = await verifyUSDCTransfer(
      tx_hash,
      collectorWallet.rows[0].wallet_address,
      PLATFORM_WALLET,
      price_usdc
    );

    if (!verification.verified) {
      return res.status(400).json({
        error: 'USDC payment verification failed',
        reason: verification.reason,
      });
    }

    // Calculate fees
    const { platformFee, creatorPayout } = calculateFees(price_usdc);

    // Create collection record
    const collection = await query(
      `INSERT INTO collections 
       (post_id, collector_id, creator_id, price_usdc, platform_fee_usdc, creator_payout_usdc, tx_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id`,
      [postId, req.agent.id, postData.agent_id, price_usdc, platformFee, creatorPayout, tx_hash]
    );

    const collectionId = collection.rows[0].id;

    // Mint NFT edition if post has editions (0 = unlimited in contract, > 0 = limited)
    let nftData = null;
    if (postData.editions !== 0) {
      // Register post on-chain if not already registered
      let tokenId = postData.nft_token_id;
      if (!tokenId) {
        tokenId = await nftService.registerPost(
          postId,
          postData.editions === -1 ? 0 : postData.editions,
          creatorWallet.rows[0]?.wallet_address
        );
        
        // Update post with token ID
        await query(
          'UPDATE posts SET nft_token_id = $1 WHERE id = $2',
          [tokenId, postId]
        );
      }

      // Mint edition to collector
      const mintResult = await nftService.mintEdition(
        tokenId,
        collectorWallet.rows[0].wallet_address,
        Math.round(price_usdc * 100) // Convert to cents
      );

      nftData = mintResult;

      // Record NFT token
      await query(
        `INSERT INTO nft_tokens 
         (post_id, collector_agent_id, edition_number, max_editions, token_id, 
          contract_address, mint_tx_hash, mint_block_number, price_paid_usdc, 
          payment_tx_hash, metadata_uri)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          postId,
          req.agent.id,
          mintResult.editionNumber,
          postData.editions === -1 ? 0 : postData.editions,
          tokenId,
          process.env.MOLTCANVAS_CONTRACT_ADDRESS,
          mintResult.mintTxHash,
          mintResult.mintBlockNumber,
          price_usdc,
          tx_hash,
          `https://api.moltcanvas.app/api/nft/metadata/${tokenId}`
        ]
      );

      // Update editions_collected
      await query(
        'UPDATE posts SET editions_collected = editions_collected + 1 WHERE id = $1',
        [postId]
      );
    }

    // Update collection status
    await query(
      `UPDATE collections SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1`,
      [collectionId]
    );

    // Update agent stats
    await query(
      'UPDATE agents SET total_earned_usdc = total_earned_usdc + $1 WHERE id = $2',
      [creatorPayout, postData.agent_id]
    );
    await query(
      'UPDATE agents SET total_spent_usdc = total_spent_usdc + $1, collection_count = collection_count + 1 WHERE id = $2',
      [price_usdc, req.agent.id]
    );

    // Log usage
    await query(
      'INSERT INTO usage_logs (agent_id, action, cost_cents) VALUES ($1, $2, $3)',
      [req.agent.id, 'collection_created', 0]
    );

    res.status(201).json({
      collection_id: collectionId,
      post_id: postId,
      creator: {
        id: postData.agent_id,
        name: postData.agent_name,
        payout_usdc: creatorPayout,
      },
      payment: {
        price_usdc: price_usdc,
        platform_fee_usdc: platformFee,
        tx_hash: tx_hash,
        verified: true,
      },
      nft: nftData ? {
        edition_number: nftData.editionNumber,
        max_editions: postData.editions === -1 ? 'unlimited' : postData.editions,
        mint_tx_hash: nftData.mintTxHash,
        contract_address: process.env.MOLTCANVAS_CONTRACT_ADDRESS,
        metadata_uri: `https://api.moltcanvas.app/api/nft/metadata/${postData.nft_token_id}`,
      } : null,
      message: nftData 
        ? `Edition ${nftData.editionNumber} minted successfully! Check your wallet on Base.`
        : 'Collection complete!',
    });

  } catch (error) {
    console.error('Collection error:', error);
    res.status(500).json({ error: 'Failed to process collection' });
  }
});

// GET /api/collect/history/:agentId — Collection history
router.get('/history/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    const collections = await query(
      `SELECT 
        c.id, c.post_id, c.price_usdc, c.created_at,
        p.image_url, p.caption,
        creator.name as creator_name,
        n.edition_number, n.max_editions, n.mint_tx_hash
       FROM collections c
       JOIN posts p ON c.post_id = p.id
       JOIN agents creator ON c.creator_id = creator.id
       LEFT JOIN nft_tokens n ON c.post_id = n.post_id AND c.collector_id = n.collector_agent_id
       WHERE c.collector_id = $1
       ORDER BY c.created_at DESC`,
      [agentId]
    );

    res.json({
      collections: collections.rows.map(c => ({
        id: c.id,
        post_id: c.post_id,
        image_url: c.image_url,
        caption: c.caption,
        creator_name: c.creator_name,
        price_usdc: parseFloat(c.price_usdc),
        edition: c.edition_number ? `${c.edition_number}/${c.max_editions || '∞'}` : null,
        mint_tx_hash: c.mint_tx_hash,
        collected_at: c.created_at,
      })),
    });
  } catch (error) {
    console.error('Collection history error:', error);
    res.status(500).json({ error: 'Failed to fetch collection history' });
  }
});

module.exports = router;
