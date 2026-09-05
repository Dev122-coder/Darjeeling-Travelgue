/**
 * Postcard & Memory Card Export Utility
 * 
 * Uses an offscreen HTML5 Canvas to render a high-resolution,
 * vintage Darjeeling Himalayan Railway souvenir postcard without
 * requiring bulky third-party PDF or rasterizer libraries.
 */

const PostcardExporter = {
  /**
   * Helper to wrap text cleanly within a canvas bounding box
   */
  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(/\s+/);
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  },

  /**
   * Draw rounded rectangle path
   */
  drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  },

  /**
   * Render and download the travelogue as a souvenir postcard PNG
   * 
   * @param {Object} cardData
   * @param {string} cardData.title
   * @param {string} cardData.travelogue
   * @param {string} cardData.caption
   * @param {string[]} cardData.hashtags
   * @param {string} cardData.imageDataUrl - Data URL of primary photo
   */
  async exportToImage(cardData) {
    return new Promise((resolve, reject) => {
      try {
        const width = 1200;
        const height = 1600;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // 1. Vintage Cream Parchment Background
        ctx.fillStyle = '#FBF8F1';
        ctx.fillRect(0, 0, width, height);

        // Subtle gradient vignette
        const bgGradient = ctx.createRadialGradient(width / 2, height / 2, 200, width / 2, height / 2, 900);
        bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        bgGradient.addColorStop(1, 'rgba(225, 214, 195, 0.55)');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // 2. Vintage Double Postal Border
        ctx.strokeStyle = '#1B3B2B'; // DHR Green
        ctx.lineWidth = 6;
        ctx.strokeRect(36, 36, width - 72, height - 72);

        ctx.strokeStyle = '#C25E34'; // Terracotta Accent
        ctx.lineWidth = 1.5;
        ctx.strokeRect(46, 46, width - 92, height - 92);

        // 3. Top Banner & Postmark
        ctx.fillStyle = '#1B3B2B';
        ctx.font = 'bold 24px "Georgia", serif';
        ctx.letterSpacing = '3px';
        ctx.fillText('DARJEELING HIMALAYAN RAILWAY', 80, 95);

        ctx.fillStyle = '#6E7A6E';
        ctx.font = 'italic 16px "Georgia", serif';
        ctx.fillText('UNESCO World Heritage Site • Code for Communities Edition', 80, 125);

        // Draw Vintage Postal Stamp in top right
        const stampX = width - 240;
        const stampY = 60;
        const stampW = 150;
        const stampH = 110;

        ctx.strokeStyle = '#C25E34';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(stampX, stampY, stampW, stampH);
        ctx.setLineDash([]);

        ctx.fillStyle = '#FAF0E4';
        ctx.fillRect(stampX + 2, stampY + 2, stampW - 4, stampH - 4);

        ctx.fillStyle = '#1B3B2B';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GHUM 2258M', stampX + (stampW / 2), stampY + 35);
        ctx.font = '24px sans-serif';
        ctx.fillText('🚂', stampX + (stampW / 2), stampY + 68);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#C25E34';
        ctx.fillText('ESTD 1881', stampX + (stampW / 2), stampY + 92);
        ctx.textAlign = 'left';

        // 4. Render Photo
        const photoY = 190;
        const photoW = width - 160;
        const photoH = 580;

        const drawContentAfterPhoto = () => {
          let textY = photoY + photoH + 70;

          // Title
          ctx.fillStyle = '#1B3B2B';
          ctx.font = 'bold 42px "Georgia", serif';
          textY = this.wrapText(ctx, cardData.title || 'Misty Tracks of Darjeeling', 80, textY, width - 160, 52);

          // Decorative separator line
          ctx.strokeStyle = '#D4AF37'; // Brass / Gold
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(80, textY + 10);
          ctx.lineTo(260, textY + 10);
          ctx.stroke();

          textY += 45;

          // Travelogue Text
          ctx.fillStyle = '#2D3748';
          ctx.font = '22px "Georgia", serif';
          const travelogueBody = cardData.travelogue || '';
          textY = this.wrapText(ctx, travelogueBody, 80, textY, width - 160, 36);

          textY += 30;

          // Memorable Caption Quote Box
          if (cardData.caption) {
            ctx.fillStyle = '#F0EAD6';
            this.drawRoundRect(ctx, 80, textY, width - 160, 90, 8);
            ctx.fill();

            ctx.strokeStyle = '#C25E34';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#C25E34';
            ctx.font = 'italic bold 22px "Georgia", serif';
            ctx.textAlign = 'center';
            const captionText = `“${cardData.caption.replace(/["']/g, '')}”`;
            ctx.fillText(captionText, width / 2, textY + 54);
            ctx.textAlign = 'left';

            textY += 125;
          }

          // Hashtags
          if (cardData.hashtags && cardData.hashtags.length > 0) {
            ctx.fillStyle = '#1B3B2B';
            ctx.font = '600 18px sans-serif';
            ctx.fillText(cardData.hashtags.join('   '), 80, textY + 10);
          }

          // Footer info
          const footerY = height - 60;
          ctx.fillStyle = '#718096';
          ctx.font = '14px sans-serif';
          ctx.fillText(`Recorded on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} • On-Device AI with Gemma 4`, 80, footerY);

          // Trigger download
          const link = document.createElement('a');
          const cleanTitle = (cardData.title || 'darjeeling-memory')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .substring(0, 30);
          link.download = `darjeeling-travelogue-${cleanTitle}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          resolve(true);
        };

        // Load image onto canvas
        if (cardData.imageDataUrl) {
          const img = new Image();
          img.onload = () => {
            // Draw photo frame background
            ctx.fillStyle = '#EBE3D5';
            this.drawRoundRect(ctx, 75, photoY - 5, photoW + 10, photoH + 10, 12);
            ctx.fill();

            // Clip photo with rounded corners
            ctx.save();
            this.drawRoundRect(ctx, 80, photoY, photoW, photoH, 8);
            ctx.clip();

            // Cover fit image
            const hRatio = photoW / img.width;
            const vRatio = photoH / img.height;
            const ratio = Math.max(hRatio, vRatio);
            const centerShiftX = (photoW - img.width * ratio) / 2;
            const centerShiftY = (photoH - img.height * ratio) / 2;

            ctx.drawImage(
              img,
              0, 0, img.width, img.height,
              80 + centerShiftX, photoY + centerShiftY, img.width * ratio, img.height * ratio
            );
            ctx.restore();

            drawContentAfterPhoto();
          };

          img.onerror = () => {
            // If image fails to load, render placeholder
            ctx.fillStyle = '#2E5339';
            this.drawRoundRect(ctx, 80, photoY, photoW, photoH, 8);
            ctx.fill();
            drawContentAfterPhoto();
          };

          img.src = cardData.imageDataUrl;
        } else {
          // No image provided
          drawContentAfterPhoto();
        }

      } catch (err) {
        reject(err);
      }
    });
  }
};

if (typeof window !== 'undefined') {
  window.PostcardExporter = PostcardExporter;
}
