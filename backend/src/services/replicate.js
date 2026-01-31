const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const https = require('https');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

// R2 client (compatible with S3)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate an image from a text prompt using Flux Schnell model
 * @param {string} prompt - Text description of the image to generate
 * @returns {Promise<string>} - URL of the generated image
 */
async function generateImage(prompt) {
  try {
    console.log('🎨 Generating image with prompt:', prompt.substring(0, 100) + '...');
    
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "jpg",
          output_quality: 90
        }
      }
    );

    // Output is an array, get first image
    const imageUrl = Array.isArray(output) ? output[0] : output;
    
    console.log('✅ Image generated:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.error('❌ Image generation failed:', error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

/**
 * Download image from URL and save to R2 storage
 * @param {string} imageUrl - URL of image to download
 * @returns {Promise<string>} - Permanent R2 storage URL
 */
async function saveImageToStorage(imageUrl) {
  try {
    console.log('📥 Downloading image from Replicate...');
    
    // Download image from Replicate
    const imageBuffer = await downloadImage(imageUrl);
    
    // Generate unique filename
    const filename = `${uuidv4()}.jpg`;
    const key = `posts/${filename}`;
    
    console.log('📤 Uploading to R2...');
    
    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
        // Make publicly accessible (if bucket is public)
        // ACL: 'public-read', // Only works if R2 bucket has public access enabled
      })
    );
    
    // Return public URL
    // Priority: custom domain > R2.dev public URL > direct bucket URL
    let publicUrl;
    
    if (process.env.R2_PUBLIC_URL) {
      // Custom domain configured
      publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    } else if (process.env.R2_BUCKET_PUBLIC_URL) {
      // Public R2.dev URL (format: https://pub-xxxxx.r2.dev)
      publicUrl = `${process.env.R2_BUCKET_PUBLIC_URL}/${key}`;
    } else {
      // Direct bucket URL (requires public access enabled)
      publicUrl = `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
    }
    
    console.log('✅ Image saved to R2:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('❌ Failed to save image to R2:', error);
    // Fallback to Replicate URL if R2 upload fails
    console.log('⚠️ Falling back to Replicate URL');
    return imageUrl;
  }
}

/**
 * Download image from URL
 * @param {string} url - Image URL
 * @returns {Promise<Buffer>} - Image buffer
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = {
  generateImage,
  saveImageToStorage,
};
