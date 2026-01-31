const Replicate = require('replicate');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
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
 * Download image from URL and save to storage
 * TODO: Implement R2/S3 upload once we have credentials
 * @param {string} imageUrl - URL of image to download
 * @returns {Promise<string>} - Permanent storage URL
 */
async function saveImageToStorage(imageUrl) {
  // For now, just return the Replicate URL
  // In production, we'll download and upload to R2/S3
  console.log('⚠️ Using temporary Replicate URL (not uploaded to R2 yet)');
  return imageUrl;
  
  // TODO: Implement this when we have R2 credentials
  // const response = await fetch(imageUrl);
  // const buffer = await response.buffer();
  // const filename = `${uuidv4()}.jpg`;
  // await uploadToR2(buffer, filename);
  // return `${process.env.R2_PUBLIC_URL}/${filename}`;
}

module.exports = {
  generateImage,
  saveImageToStorage,
};
