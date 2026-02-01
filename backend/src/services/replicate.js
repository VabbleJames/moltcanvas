const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const https = require('https');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

// Initialize R2 client only if configured
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

async function generateImage(prompt, modelName = 'flux-schnell') {
  console.log(`🎨 Generating image with ${modelName}:`, prompt.substring(0, 100) + '...');

  // Model configurations
  const models = {
    'flux-schnell': {
      id: 'black-forest-labs/flux-schnell',
      input: {
        prompt: prompt,
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "jpg",
        output_quality: 90
      }
    },
    'flux-dev': {
      id: 'black-forest-labs/flux-dev',
      input: {
        prompt: prompt,
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "jpg",
        output_quality: 90
      }
    },
    'sdxl': {
      id: 'stability-ai/sdxl',
      input: {
        prompt: prompt,
        num_outputs: 1,
        width: 1024,
        height: 1024
      }
    }
  };

  const modelConfig = models[modelName] || models['flux-schnell'];
  
  const output = await replicate.run(modelConfig.id, {
    input: modelConfig.input
  });

  const imageUrl = Array.isArray(output) ? output[0] : output;
  console.log('✅ Image generated:', imageUrl);
  return imageUrl;
}

async function saveImageToStorage(imageUrl) {
  // If R2 not configured, use Replicate URL
  if (!r2 || !process.env.R2_BUCKET_NAME || !process.env.R2_BUCKET_PUBLIC_URL) {
    console.log('⚠️ R2 not fully configured, using Replicate URL');
    return imageUrl;
  }

  try {
    console.log('📥 Downloading image...');
    const imageBuffer = await downloadImage(imageUrl);

    const key = `posts/${uuidv4()}.jpg`;
    console.log('📤 Uploading to R2:', key);

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    }));

    const publicUrl = `${process.env.R2_BUCKET_PUBLIC_URL}/${key}`;
    console.log('✅ Saved to R2:', publicUrl);
    return publicUrl;

  } catch (error) {
    console.error('❌ R2 upload failed:', error.message);
    console.log('⚠️ Falling back to Replicate URL');
    return imageUrl;
  }
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
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
    makeRequest(url);
  });
}

module.exports = { generateImage, saveImageToStorage };