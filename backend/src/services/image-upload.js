/**
 * Image Upload Service
 * Handles direct image uploads from agents to R2 storage.
 * Used when agents generate images externally and need permanent storage.
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

// Initialize R2 client
let r2 = null;
if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
  r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Upload image buffer to R2 storage
 * @param {Buffer} imageBuffer - Image data
 * @param {string} mimeType - MIME type (image/jpeg, image/png, image/webp)
 * @returns {Promise<string>} - Public URL of uploaded image
 */
async function uploadImageToR2(imageBuffer, mimeType) {
  if (!r2 || !process.env.R2_BUCKET_NAME || !process.env.R2_BUCKET_PUBLIC_URL) {
    throw new Error('R2 storage not configured. Cannot upload images.');
  }

  // Validate and optimize image
  const optimizedBuffer = await optimizeImage(imageBuffer, mimeType);
  
  // Generate unique filename
  const extension = mimeType.split('/')[1];
  const key = `uploads/${uuidv4()}.${extension}`;
  
  console.log('📤 Uploading to R2:', key, `(${(optimizedBuffer.length / 1024).toFixed(2)} KB)`);

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: optimizedBuffer,
    ContentType: mimeType,
  }));

  const publicUrl = `${process.env.R2_BUCKET_PUBLIC_URL}/${key}`;
  console.log('✅ Saved to R2:', publicUrl);
  
  return publicUrl;
}

/**
 * Optimize image for storage
 * - Resize if too large (max 2048x2048)
 * - Compress based on format
 * - Validate format
 */
async function optimizeImage(imageBuffer, mimeType) {
  let image = sharp(imageBuffer);
  
  // Get metadata
  const metadata = await image.metadata();
  console.log(`📊 Image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);
  
  // Validate format
  const allowedFormats = ['jpeg', 'jpg', 'png', 'webp'];
  if (!allowedFormats.includes(metadata.format)) {
    throw new Error(`Invalid image format: ${metadata.format}. Allowed: ${allowedFormats.join(', ')}`);
  }
  
  // Resize if too large (max 2048x2048, maintaining aspect ratio)
  if (metadata.width > 2048 || metadata.height > 2048) {
    console.log('🔧 Resizing image to fit 2048x2048...');
    image = image.resize(2048, 2048, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  
  // Compress based on format
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    image = image.jpeg({ quality: 85, progressive: true });
  } else if (mimeType === 'image/png') {
    image = image.png({ compressionLevel: 8 });
  } else if (mimeType === 'image/webp') {
    image = image.webp({ quality: 85 });
  }
  
  return await image.toBuffer();
}

/**
 * Download image from URL and upload to R2
 * Used when agent provides external URL (e.g., from Replicate)
 */
async function downloadAndUpload(imageUrl) {
  const https = require('https');
  
  console.log('📥 Downloading image from:', imageUrl);
  
  const imageBuffer = await new Promise((resolve, reject) => {
    const makeRequest = (requestUrl) => {
      https.get(requestUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          makeRequest(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode}`));
          return;
        }
        
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    };
    makeRequest(imageUrl);
  });
  
  // Detect MIME type from buffer
  const mimeType = detectMimeType(imageBuffer);
  
  return await uploadImageToR2(imageBuffer, mimeType);
}

/**
 * Detect MIME type from image buffer
 */
function detectMimeType(buffer) {
  // Check magic bytes
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }
  return 'image/jpeg'; // default fallback
}

module.exports = {
  uploadImageToR2,
  downloadAndUpload,
  optimizeImage,
};
