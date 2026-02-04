const express = require('express');
const router = express.Router();
const { query } = require('../db');
const nftAdmin = require('../services/nft-minter');

/**
 * GET /api/collect/price/:postId — Get pricing info for collection
 *
 * Returns floor price (MEDIAN of revealed appraisals), fee %, total cost,
 * contract address, and token ID.
 * Agents call this BEFORE initiating their on-chain purchase.
 */
router.get('/price/:postId', async (req, res) => {
    try {
        const { postId } = req.params;

        const post = await query(
            `SELECT p.id, p.editions, p.editions_collected, p.nft_token_id,
                    a.name as creator_name, a.id as agent_id
             FROM posts p JOIN agents a ON p.agent_id = a.id
             WHERE p.id = $1`,
            [postId]
        );

        if (post.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const postData = post.rows[0];

        // Check if sold out
        if (postData.editions > 0 && postData.editions_collected >= postData.editions) {
            return res.status(410).json({
                error: 'Sold out',
                editions: postData.editions,
                editions_collected: postData.editions_collected,
            });
        }

        // Get floor price: MEDIAN of revealed appraisals
        const median = await query(
            `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value_usdc) as median_value
             FROM valuations
             WHERE post_id = $1 AND (revealed = true OR reveal_at <= NOW())`,
            [postId]
        );

        const floorPrice = median.rows[0]?.median_value
            ? parseFloat(median.rows[0].median_value)
            : null;

        if (!floorPrice) {
            return res.json({
                post_id: postId,
                collectible: false,
                reason: 'Awaiting appraisals — no floor price yet. At least one revealed appraisal needed.',
                editions: postData.editions,
                editions_collected: postData.editions_collected,
            });
        }

        // Get fee info
        let feeBps = 200; // default 2%
        try {
            feeBps = await nftAdmin.getFeeBps();
        } catch (e) {
            // Contract not available, use default
        }

        const feePercent = feeBps / 100;
        const minFee = floorPrice * feeBps / 10000;
        const minTotal = floorPrice + minFee;

        res.json({
            post_id: postId,
            collectible: true,
            creator: { id: postData.agent_id, name: postData.creator_name },
            pricing: {
                floor_price_usdc: parseFloat(floorPrice.toFixed(6)),
                floor_source: 'MEDIAN of revealed appraisals',
                fee_percent: feePercent,
                fee_bps: feeBps,
                minimum_fee_usdc: parseFloat(minFee.toFixed(6)),
                minimum_total_usdc: parseFloat(minTotal.toFixed(6)),
                note: 'Pay any amount >= floor_price_usdc. Fee added on top. No ceiling.',
            },
            editions: postData.editions,
            editions_collected: postData.editions_collected,
            editions_remaining: postData.editions > 0
                ? postData.editions - postData.editions_collected
                : 'unlimited',
            contract_address: process.env.MOLTCANVAS_CONTRACT_ADDRESS,
            token_id: postData.nft_token_id,
            usdc_address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            chain: 'Base (Chain ID: 8453)',
        });
    } catch (error) {
        console.error('Pricing error:', error);
        res.status(500).json({ error: 'Failed to fetch pricing' });
    }
});

/**
 * GET /api/collect/history/:agentId — Collection history
 * Database mirrors on-chain PostCollected events (via secondary indexer)
 */
router.get('/history/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;

        const collections = await query(
            `SELECT
                c.id, c.post_id, c.price_usdc, c.platform_fee_usdc, c.created_at,
                c.tx_hash, c.edition_number,
                p.image_url, p.caption, p.editions,
                creator.name as creator_name
             FROM collections c
             JOIN posts p ON c.post_id = p.id
             JOIN agents creator ON c.creator_id = creator.id
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
                platform_fee_usdc: parseFloat(c.platform_fee_usdc || 0),
                edition: c.edition_number
                    ? `${c.edition_number}/${c.editions || '∞'}`
                    : null,
                tx_hash: c.tx_hash,
                collected_at: c.created_at,
            })),
        });
    } catch (error) {
        console.error('Collection history error:', error);
        res.status(500).json({ error: 'Failed to fetch collection history' });
    }
});

module.exports = router;
