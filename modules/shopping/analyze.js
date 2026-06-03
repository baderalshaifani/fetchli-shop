// ===================================
// fetchli.shop — تحليل المنتج (تسوق)
// ===================================
// Claude يفهم المنتج ويولّد كلمات بحث دقيقة
// + fallback ذكي من بيانات Vision لو Claude فشل

const { callClaudeJSON } = require('../../shared/claude');

// ────────────────────────────────────
// خريطة أنواع المنتجات (إنجليزي → عربي)
// ────────────────────────────────────
const PRODUCT_TYPE_MAP = {
  'watch':     'ساعة',  'clock':    'ساعة',  'timepiece': 'ساعة',
  'bag':       'حقيبة', 'handbag':  'حقيبة', 'purse':     'حقيبة',
  'shoe':      'حذاء',  'sneaker':  'حذاء',  'boot':      'حذاء',
  'shirt':     'قميص',  'dress':    'فستان', 'jacket':    'جاكيت',
  'phone':     'جوال',  'laptop':   'لابتوب','headphone': 'سماعة',
};

// ────────────────────────────────────
// Claude — تحليل عميق + كلمات بحث
// ────────────────────────────────────
/**
 * @param {string|null}  message
 * @param {string|null}  imageBase64
 * @param {object|null}  visionData   — نتيجة Google Vision
 * @param {boolean}      wantCheaper
 * @returns {object} { productType, brand, color, material, details, searchQueries, reply, confidence }
 */
async function analyzeWithClaude(message, imageBase64, visionData, wantCheaper) {
  const content = [];

  // أضف الصورة إن وُجدت
  if (imageBase64) {
    content.push({
      type:   'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
    });
  }

  // سياق Vision كمرجع إضافي
  const visionContext = visionData ? `
بيانات من Google Vision API (استخدمها كمرجع إضافي):
- الماركات المكتشفة: ${visionData.logos.join(', ') || 'لا يوجد'}
- الكائنات: ${visionData.objects.join(', ') || 'لا يوجد'}
- التسميات: ${visionData.labels.slice(0, 8).join(', ') || 'لا يوجد'}
- الكيانات من الويب: ${visionData.webEntities.slice(0, 5).join(', ') || 'لا يوجد'}
- أفضل تخمين: ${visionData.bestGuess || 'لا يوجد'}
- الألوان السائدة: ${visionData.colors.join(', ') || 'لا يوجد'}
` : '';

  const cheaperNote = wantCheaper
    ? 'المستخدم يريد بدائل أرخص — ركز على كلمات: alternative, dupe, budget, affordable, similar'
    : '';

  content.push({
    type: 'text',
    text: `You are a professional shopping expert with deep knowledge of products, brands, and fashion.
${imageBase64 ? 'IMPORTANT: Carefully analyze the image. Identify EXACTLY what product is shown - watch, bag, shoe, etc.' : ''}
${visionContext}
${message ? `User request: "${message}"` : ''}
${cheaperNote}

CRITICAL RULES:
- If the image shows a WATCH, productType must be "ساعة" and search for watches only
- If the image shows a BAG, productType must be "حقيبة" and search for bags only
- If the image shows SHOES, productType must be "حذاء" and search for shoes only
- Never confuse different product categories
- The Google Vision data above is a strong hint - use it

Extract precisely:
1. Product type (what exactly is shown)
2. Brand/Logo (from image or Vision data)
3. Main color and secondary colors
4. Material/texture
5. Distinctive features (style, closure, strap type, etc.)

Create 5 different English search queries:
- Query 1: Very specific (brand + type + color + material + key feature)
- Query 2: Without brand (type + color + material + style)
- Query 3: ${wantCheaper ? 'budget dupe alternative similar' : 'by category and use case'}
- Query 4: ${wantCheaper ? 'affordable similar style cheap' : 'by shape and design details'}
- Query 5: ${wantCheaper ? 'cheap similar product low price' : 'general category search'}

Respond ONLY with valid JSON:
{
  "productType": "نوع المنتج بالعربي",
  "brand": "brand name or null",
  "color": "main color",
  "material": "material/texture",
  "details": "distinctive features",
  "searchQueries": ["q1","q2","q3","q4","q5"],
  "priceRange": "${wantCheaper ? 'budget' : 'any'}",
  "reply": "رد ودي قصير بالعربي يصف ما وجدته",
  "confidence": 92
}`,
  });

  return await callClaudeJSON({
    system:      'You are a product analysis API. Respond with valid JSON only. No markdown, no explanation.',
    userContent: content,
    maxTokens:   1000,
  });
}

// ────────────────────────────────────
// Fallback — من Vision مباشرة لو Claude فشل
// ────────────────────────────────────
/**
 * @param {object|null} visionData
 * @param {string}      message
 * @param {boolean}     wantCheaper
 */
function buildFallbackFromVision(visionData, message, wantCheaper) {
  if (!visionData) {
    return {
      productType:   message || 'منتج',
      brand:         null,
      color:         '',
      searchQueries: [message || 'product'],
      reply:         'جاري البحث عن المنتج...',
      confidence:    60,
    };
  }

  const brand   = visionData.logos?.[0] || null;
  const guess   = visionData.bestGuess  || '';
  const objects = visionData.objects?.join(' ') || '';
  const labels  = visionData.labels?.slice(0, 5).join(' ') || '';
  const color   = visionData.colors?.[0] || '';

  // حدد نوع المنتج من Vision
  let productType = 'منتج';
  const allText   = (guess + ' ' + objects + ' ' + labels).toLowerCase();
  for (const [en, ar] of Object.entries(PRODUCT_TYPE_MAP)) {
    if (allText.includes(en)) { productType = ar; break; }
  }

  const cheaper = wantCheaper ? 'budget affordable' : '';
  const q1 = [brand, guess, color].filter(Boolean).join(' ').trim() || message || 'product';
  const q2 = [guess, color].filter(Boolean).join(' ').trim() || q1;
  const q3 = cheaper ? `${q1} ${cheaper}` : `${guess} buy online`;
  const q4 = [brand, productType === 'ساعة' ? 'watch' : productType === 'حقيبة' ? 'bag' : guess].filter(Boolean).join(' ');
  const q5 = message || brand || guess || 'product';

  const queries = [q1, q2, q3, q4, q5].filter(q => q && q.trim().length > 1);
  console.log('Fallback queries:', queries);

  return {
    productType,
    brand,
    color,
    details:       objects,
    searchQueries: queries.length > 0 ? queries : [message || brand || 'product'],
    reply:         `وجدت ${productType}${brand ? ' من ' + brand : ''} — جاري البحث عن أفضل الأسعار`,
    confidence:    82,
  };
}

module.exports = { analyzeWithClaude, buildFallbackFromVision };
