/**
 * Image Utilities for Darjeeling Travelogue
 * Handles client-side resizing, compression (WebP/JPEG),
 * Base64 conversion, memory cleanup, and validation.
 * Optimized for ~8GB RAM laptops.
 */

const ImageUtils = {
  MAX_DIMENSION: 1024,   // Max width or height
  COMPRESSION_QUALITY: 0.82, // High visual fidelity, low memory footprint
  MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15MB input limit
  MAX_IMAGES_FOR_AI: 3,  // Maximum photos sent to Gemma model

  /**
   * Validates an uploaded file
   * @param {File} file
   * @returns {{ valid: boolean, error?: string }}
   */
  validateFile(file) {
    if (!file) return { valid: false, error: 'No file provided' };
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type.toLowerCase()) && !file.type.startsWith('image/')) {
      return { 
        valid: false, 
        error: `"${file.name}" is not a supported image format. Please use JPEG, PNG, or WebP.` 
      };
    }

    // Check size
    if (file.size > this.MAX_FILE_SIZE_BYTES) {
      return { 
        valid: false, 
        error: `"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max size is 15MB.` 
      };
    }

    return { valid: true };
  },

  /**
   * Resizes and compresses an image file using an offscreen HTML5 canvas
   * @param {File|Blob} file 
   * @returns {Promise<{ base64: string, dataUrl: string, width: number, height: number, sizeBytes: number }>}
   */
  async processImage(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          // Calculate scaled dimensions
          let { width, height } = img;
          if (width > this.MAX_DIMENSION || height > this.MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * this.MAX_DIMENSION) / width);
              width = this.MAX_DIMENSION;
            } else {
              width = Math.round((width * this.MAX_DIMENSION) / height);
              height = this.MAX_DIMENSION;
            }
          }

          // Render onto canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          // High quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Test for WebP support, fallback to JPEG
          let mimeType = 'image/webp';
          let dataUrl = canvas.toDataURL(mimeType, this.COMPRESSION_QUALITY);
          if (!dataUrl.startsWith('data:image/webp')) {
            mimeType = 'image/jpeg';
            dataUrl = canvas.toDataURL(mimeType, this.COMPRESSION_QUALITY);
          }

          // Clean up canvas & image references
          canvas.width = 0;
          canvas.height = 0;
          URL.revokeObjectURL(objectUrl);

          // Extract pure base64 (without header) for model payload
          const base64 = dataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

          resolve({
            dataUrl,
            base64,
            width,
            height,
            mimeType,
            sizeBytes: Math.round((base64.length * 3) / 4)
          });
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to decode image "${file.name || 'uploaded photo'}".`));
      };

      img.src = objectUrl;
    });
  },

  /**
   * Safely revokes a generated object URL
   */
  revokeUrl(url) {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    }
  }
};

if (typeof window !== 'undefined') {
  window.ImageUtils = ImageUtils;
}
