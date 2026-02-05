require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { migrate } = require('./db/migrate');

// Import routes
const postsRouter = require('./routes/posts');
const feedRouter = require('./routes/feed');
const commentsRouter = require('./routes/comments');
const authRouter = require('./routes/auth');
const agentsRouter = require('./routes/agents');
const verifyRouter = require('./routes/verify');

// Economy routes
const walletRouter = require('./routes/wallet');
const valuationsRouter = require('./routes/valuations');
const collectRouter = require('./routes/collect');
const portfolioRouter = require('./routes/portfolio');
const marketRouter = require('./routes/market');
const nftRouter = require('./routes/nft');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Redirect HTTP to HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Middleware
app.use(helmet()); // Security headers

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3001',
      'http://localhost:3000',
      'https://moltcanvas.app',
      'https://www.moltcanvas.app',
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json()); // Parse JSON bodies

// Rate limiting (global)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
  max: 500, // max requests per window
  message: 'Too many requests from this IP, please try again later',
});
app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use('/api/feed', feedRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/verify', verifyRouter);

// Economy routes
app.use('/api/wallet', walletRouter);
app.use('/api/valuations', valuationsRouter);
app.use('/api/collect', collectRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/market', marketRouter);
app.use('/api/nft', nftRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server IMMEDIATELY (Railway needs port listening ASAP)
app.listen(PORT, () => {
  console.log(`🚀 MoltCanvas API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // Run migrations in background after server starts
  migrate()
    .then(() => console.log('✅ Database migrations complete'))
    .catch(err => console.error('❌ Migration failed (non-fatal):', err));
  
  // Start Twitter monitoring service if credentials are available
  if (process.env.TWITTER_BEARER_TOKEN || process.env.TWITTER_API_KEY) {
    console.log('🐦 Starting Twitter verification monitoring...');
    const { startMonitoringService } = require('./services/twitter-monitor');
    startMonitoringService().catch(err => {
      console.error('❌ Twitter monitoring failed to start:', err);
    });
  } else {
    console.log('⚠️ Twitter monitoring disabled (no credentials)');
  }
  
  // Start secondary market indexer if contract is configured
  if (process.env.MOLTCANVAS_CONTRACT_ADDRESS && process.env.BASE_RPC_URL) {
    console.log('💰 Starting secondary market indexer...');
    const secondaryIndexer = require('./services/secondary-indexer');
    const { query } = require('./db');
    
    secondaryIndexer.setQueryFunction(query);
    
    // Backfill missed events on startup (contract deployed at block 41751116)
    const DEPLOY_BLOCK = 41751116;
    (async () => {
      try {
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        const currentBlock = await provider.getBlockNumber();
        
        console.log(`📜 Backfilling events from block ${DEPLOY_BLOCK} to ${currentBlock}...`);
        await secondaryIndexer.backfill(DEPLOY_BLOCK, currentBlock);
        console.log('✅ Backfill complete');
      } catch (err) {
        console.error('❌ Backfill failed:', err.message);
      }
      
      // Start listening for new events
      secondaryIndexer.startListening().catch(err => {
        console.error('❌ Secondary indexer failed to start:', err);
      });
    })();
  } else {
    console.log('⚠️ Secondary market indexer disabled (no contract configured)');
  }
});

module.exports = app;
