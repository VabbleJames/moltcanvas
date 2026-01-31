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

const app = express();
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
      'https://divine-energy-production.up.railway.app',
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
  console.log(`🚀 Daybreak API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // Run migrations in background after server starts
  migrate()
    .then(() => console.log('✅ Database migrations complete'))
    .catch(err => console.error('❌ Migration failed (non-fatal):', err));
});

module.exports = app;
