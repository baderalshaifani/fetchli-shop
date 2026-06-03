// ===================================
// fetchli.shop — Google Vision (تسوق)
// ===================================
// تحليل بصري أولي للصورة لاكتشاف المنتج

const fetch               = require('node-fetch');
const { rgbToColorName }  = require('../../shared/helpers');

/**
 * يحلل الصورة بـ Google Vision API
 * @param {string} imageBase64
 * @returns {object|null} { labels, logos, objects, webEntities, bestGuess, colors }
 */
async function analyzeWithGoogleVision(imageBase64) {
  try {
    const GOOGLE_KEY = process.env.GOOGLE_VISION_KEY;
    if (!GOOGLE_KEY) {
      console.warn('GOOGLE_VISION_KEY not set — skipping Vision analysis');
      return null;
    }

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [
              { type: 'LABEL_DETECTION',     maxResults: 15 },
              { type: 'LOGO_DETECTION',       maxResults: 5  },
              { type: 'OBJECT_LOCALIZATION',  maxResults: 10 },
              { type: 'IMAGE_PROPERTIES',     maxResults: 5  },
              { type: 'WEB_DETECTION',        maxResults: 10 },
            ],
          }],
        }),
      }
    );

    const data   = await response.json();
    const result = data.responses?.[0];
    if (!result) return null;

    const labels      = result.labelAnnotations?.map(l => l.description) || [];
    const logos       = result.logoAnnotations?.map(l => l.description)  || [];
    const objects     = result.localizedObjectAnnotations?.map(o => o.name) || [];
    const webEntities = result.webDetection?.webEntities
      ?.filter(e => e.score > 0.5)
      ?.map(e => e.description) || [];
    const bestGuess   = result.webDetection?.bestGuessLabels?.[0]?.label || '';

    const colors = result.imagePropertiesAnnotation?.dominantColors?.colors
      ?.slice(0, 3)
      ?.map(c => {
        const r = Math.round(c.color.red   || 0);
        const g = Math.round(c.color.green || 0);
        const b = Math.round(c.color.blue  || 0);
        return rgbToColorName(r, g, b);
      }) || [];

    console.log('Vision result:', bestGuess, '| logos:', logos);
    return { labels, logos, objects, webEntities, bestGuess, colors };

  } catch (err) {
    console.error('Google Vision error:', err.message);
    return null;
  }
}

module.exports = { analyzeWithGoogleVision };
