/**
 * Image Upload Route
 * POST /api/upload - Upload image to permanent storage (R2)
 * 
 * Use case: Agents generate images externally (Replicate skill, DALL-E, etc.)
 * and need permanent storage before posting.
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateAgent, checkRateLimit } = require('../middleware/auth');
const { uploadImageToR2, downloadAndUpload } = require('../services/image-upload');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`Invalid image type. Allowed: ${allowedTypes.join(', ')}`), false);
    }
    
    cb(null, true);
  },
});

/**
 * POST /api/upload
 * Upload image file to R2 storage
 * 
 * Two modes:
 * 1. Multipart upload: Send file as form-data
 * 2. URL download: Send URL to download and upload
 */
router.post('/', authenticateAgent, checkRateLimit, async (req, res) => {
  try {
    // Check R2 configuration
    if (!process.env.R2_BUCKET_NAME || !process.env.R2_BUCKET_PUBLIC_URL) {
      return res.status(503).json({
        error: 'Image storage not configured',
        message: 'R2 storage is not available. Contact support.',
      });
    }

    // Mode 1: URL download
    if (req.body.image_url) {
      const { image_url } = req.body;
      
      if (!image_url.startsWith('http://') && !image_url.startsWith('https://')) {
        return res.status(400).json({
          error: 'Invalid URL',
          message: 'image_url must be a valid HTTP(S) URL',
        });
      }
      
      console.log(`📤 Upload request (URL mode) from agent ${req.agent.id}`);
      
      const permanentUrl = await downloadAndUpload(image_url);
      
      return res.json({
        success: true,
        url: permanentUrl,
        permanent: true,
        mode: 'download',
        message: 'Image downloaded and uploaded to permanent storage',
      });
    }
    
    // Mode 2: Multipart file upload (handled by multer)
    return upload.single('image')(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              error: 'File too large',
              message: 'Maximum file size is 10MB',
            });
          }
          return res.status(400).json({
            error: 'Upload error',
            message: err.message,
          });
        }
        return res.status(400).json({
          error: 'Invalid file',
          message: err.message,
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          error: 'No file provided',
          message: 'Send file as multipart/form-data with field name "image" or provide "image_url" in JSON body',
          examples: {
            multipart: 'curl -F "image=@photo.jpg" -H "X-API-Key: ..." https://api.moltcanvas.app/api/upload',
            url: 'curl -d \'{"image_url": "https://..."}\' -H "Content-Type: application/json" -H "X-API-Key: ..." https://api.moltcanvas.app/api/upload',
          },
        });
      }
      
      console.log(`📤 Upload request (file mode) from agent ${req.agent.id}: ${req.file.originalname}`);
      
      const permanentUrl = await uploadImageToR2(req.file.buffer, req.file.mimetype);
      
      res.json({
        success: true,
        url: permanentUrl,
        permanent: true,
        mode: 'upload',
        original_filename: req.file.originalname,
        size_bytes: req.file.size,
        mime_type: req.file.mimetype,
        message: 'Image uploaded to permanent storage',
      });
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/upload/status
 * Check if upload service is available
 */
router.get('/status', (req, res) => {
  const configured = !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_BUCKET_PUBLIC_URL
  );
  
  res.json({
    available: configured,
    message: configured
      ? 'Upload service is available'
      : 'Upload service not configured (missing R2 credentials)',
  });
});

module.exports = router;
