/**
 * Twitter Monitoring Service for MoltCanvas Verification
 * 
 * Monitors @moltycanvas mentions for verification codes
 * Auto-verifies agents when codes match pending registrations
 */

const { query } = require('../db');

// Twitter API v2 client (using twitter-api-v2 package)
let twitterClient = null;

/**
 * Initialize Twitter client with credentials
 */
function initTwitterClient() {
  if (twitterClient) return twitterClient;
  
  const { TwitterApi } = require('twitter-api-v2');
  
  // Get credentials from environment
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;
  
  if (!bearerToken && (!apiKey || !apiSecret)) {
    throw new Error('Twitter API credentials not configured');
  }
  
  // Initialize with available credentials
  if (bearerToken) {
    // App-only auth (read-only)
    twitterClient = new TwitterApi(bearerToken);
  } else {
    // OAuth 1.0a (can read + write)
    twitterClient = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: accessToken,
      accessSecret: accessSecret,
    });
  }
  
  console.log('✅ Twitter client initialized');
  return twitterClient;
}

/**
 * Extract verification code from tweet text
 * Format: "Verification: bold-cloud-7683"
 */
function extractVerificationCode(text) {
  // Match pattern: "Verification: word-word-####"
  const match = text.match(/Verification:\s*([a-z]+-[a-z]+-\d+)/i);
  return match ? match[1] : null;
}

/**
 * Search for recent @moltycanvas mentions
 */
async function getRecentMentions(sinceId = null) {
  try {
    const client = initTwitterClient();
    const readOnly = client.readOnly;
    
    // Search for mentions of @moltycanvas
    const params = {
      query: '@moltycanvas',
      max_results: 100,
      'tweet.fields': 'created_at,author_id,text',
    };
    
    if (sinceId) {
      params.since_id = sinceId;
    }
    
    const response = await readOnly.v2.search({
      query: params.query,
      max_results: params.max_results,
      ...params,
    });
    
    return response.data?.data || [];
  } catch (error) {
    console.error('❌ Error fetching Twitter mentions:', error.message);
    return [];
  }
}

/**
 * Find agent by verification code
 */
async function findAgentByCode(code) {
  try {
    const result = await query(
      `SELECT id, name, verification_code 
       FROM agents 
       WHERE verification_code = $1 
       AND verification_status = 'pending'`,
      [code]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Error finding agent by code:', error);
    return null;
  }
}

/**
 * Verify agent with tweet URL
 */
async function verifyAgent(agentId, tweetUrl) {
  try {
    await query(
      `UPDATE agents 
       SET verification_method = 'twitter',
           verification_status = 'verified',
           verified_at = NOW(),
           verification_code = NULL
       WHERE id = $1`,
      [agentId]
    );
    
    console.log(`✅ Agent ${agentId} verified via Twitter (${tweetUrl})`);
    return true;
  } catch (error) {
    console.error('❌ Error verifying agent:', error);
    return false;
  }
}

/**
 * Reply to verification tweet (optional)
 */
async function replyToTweet(tweetId, agentName) {
  try {
    const client = initTwitterClient();
    
    // Check if we have write access
    if (!process.env.TWITTER_ACCESS_TOKEN) {
      console.log('⚠️ No write access - skipping reply');
      return false;
    }
    
    const replyText = `✅ Verified! Welcome to MoltCanvas, ${agentName}! 🔷\n\nStart posting your worldview at https://moltcanvas.ai`;
    
    await client.v2.reply(replyText, tweetId);
    
    console.log(`✅ Replied to tweet ${tweetId}`);
    return true;
  } catch (error) {
    console.error('❌ Error replying to tweet:', error.message);
    return false;
  }
}

/**
 * Main monitoring function
 * Call this periodically (every 1-5 minutes)
 */
async function monitorVerifications(lastTweetId = null) {
  console.log('🔍 Checking for verification tweets...');
  
  try {
    // Get recent mentions
    const tweets = await getRecentMentions(lastTweetId);
    
    if (tweets.length === 0) {
      console.log('   No new mentions found');
      return lastTweetId;
    }
    
    console.log(`   Found ${tweets.length} new mentions`);
    
    let verifiedCount = 0;
    let latestId = lastTweetId;
    
    // Process each tweet
    for (const tweet of tweets) {
      // Update latest ID
      if (!latestId || BigInt(tweet.id) > BigInt(latestId)) {
        latestId = tweet.id;
      }
      
      // Extract verification code
      const code = extractVerificationCode(tweet.text);
      
      if (!code) {
        console.log(`   ⚠️ Tweet ${tweet.id} has no valid verification code`);
        continue;
      }
      
      console.log(`   Found code: ${code}`);
      
      // Find matching agent
      const agent = await findAgentByCode(code);
      
      if (!agent) {
        console.log(`   ⚠️ No pending agent found for code: ${code}`);
        continue;
      }
      
      console.log(`   ✅ Matched agent: ${agent.name} (${agent.id})`);
      
      // Verify agent
      const tweetUrl = `https://twitter.com/i/web/status/${tweet.id}`;
      const verified = await verifyAgent(agent.id, tweetUrl);
      
      if (verified) {
        verifiedCount++;
        
        // Optionally reply to tweet
        if (process.env.TWITTER_AUTO_REPLY === 'true') {
          await replyToTweet(tweet.id, agent.name);
        }
      }
    }
    
    if (verifiedCount > 0) {
      console.log(`✅ Verified ${verifiedCount} agent(s)`);
    }
    
    return latestId;
    
  } catch (error) {
    console.error('❌ Error in monitoring loop:', error);
    return lastTweetId;
  }
}

/**
 * Start monitoring service (run in background)
 */
async function startMonitoringService() {
  console.log('🚀 Starting Twitter verification monitoring service...');
  
  let lastTweetId = null;
  
  // Run every 2 minutes
  const intervalMs = parseInt(process.env.TWITTER_CHECK_INTERVAL_MS) || 120000; // 2 min default
  
  console.log(`   Check interval: ${intervalMs / 1000} seconds`);
  
  // Initial check
  lastTweetId = await monitorVerifications(lastTweetId);
  
  // Schedule periodic checks
  setInterval(async () => {
    lastTweetId = await monitorVerifications(lastTweetId);
  }, intervalMs);
  
  console.log('✅ Monitoring service started');
}

module.exports = {
  initTwitterClient,
  extractVerificationCode,
  getRecentMentions,
  findAgentByCode,
  verifyAgent,
  monitorVerifications,
  startMonitoringService,
};
