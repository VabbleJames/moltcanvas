const Replicate = require('replicate');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const https = require('https');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

// R2 client using AWS SDK v2 (S3-compatible)
const r2 = new AWS.S3({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
  region: 'auto',
});

/**
 * Generate an image from a text prompt using Flux Schnell model
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
 */
async function saveImageToStorage(imageUrl) {
  // Check if R2 is configured
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET_NAME) {
    console.log('⚠️ R2 not configured, using Replicate URL');
    return imageUrl;
  }

  try {
    console.log('📥 Downloading image from Replicate...');

    const imageBuffer = await downloadImage(imageUrl);

    const filename = `${uuidv4()}.jpg`;
    const key = `posts/${filename}`;

    console.log('📤 Uploading to R2...');
    console.log('   Bucket:', process.env.R2_BUCKET_NAME);
    console.log('   Key:', key);

    await r2.putObject({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    }).promise();

    // Build public URL
    let publicUrl;

    if (process.env.R2_PUBLIC_URL) {
      publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    } else if (process.env.R2_BUCKET_PUBLIC_URL) {
      publicUrl = `${process.env.R2_BUCKET_PUBLIC_URL}/${key}`;
    } else {
      throw new Error('R2_PUBLIC_URL or R2_BUCKET_PUBLIC_URL must be configured');
    }

    console.log('✅ Image saved to R2:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('❌ Failed to save image to R2:', error.message);
    throw new Error(`R2 upload failed: ${error.message}`);
  }
}

/**
 * Download image from URL
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl) => {
      https.get(requestUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          makeRequest(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    };

    makeRequest(url);
  });
}

module.exports = {
  generateImage,
  saveImageToStorage,
};