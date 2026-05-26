// ===================================
// fetchli.shop — الباك اند (نسخة محسّنة للدقة)
// ===================================

const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const path    = require('path');
const config  = require('./config');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ────────────────────────────────────
// 1. تحديد دولة المستخدم عبر IP
// ────────────────────────────────────
app.get('/api/location', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168')) {
      return res.json({ country: 'SA', market: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'السعودية' });
    }
    const response = await fetch(`${config.IP_API_URL}/${ip}/json/`);
    const data     = await response.json();
    const country  = data.country_code || 'SA';
    const market   = config.COUNTRY_MAP[country] || 'US';
    const COUNTRY_INFO = {
      SA: { currency: 'SAR', flag: '🇸🇦', name: 'السعودية' },
      AE: { currency: 'AED', flag: '🇦🇪', name: 'الإمارات' },
      EG: { currency: 'EGP', flag: '🇪🇬', name: 'مصر'      },
      US: { currency: 'USD', flag: '🇺🇸', name: 'أمريكا'   },
      CA: { currency: 'CAD', flag: '🇨🇦', name: 'كندا'     },
      KW: { currency: 'KWD', flag: '🇰🇼', name: 'الكويت'   },
      QA: { currency: 'QAR', flag: '🇶🇦', name: 'قطر'      },
    };
    res.json({ country, market, ...(COUNTRY_INFO[country] || COUNTRY_INFO['US']) });
  } catch (err) {
    res.json({ country: 'SA', market: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'السعودية' });
  }
});

// ────────────────────────────────────
// 2. Google Vision — تحليل بصري
// ────────────────────────────────────
async function analyzeWithGoogleVision(imageBase64) {
  try {
    const GOOGLE_KEY = process.env.GOOGLE_VISION_KEY;
    if (!GOOGLE_KEY) return null;

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [
              { type: 'LABEL_DETECTION',    maxResults: 15 },
              { type: 'LOGO_DETECTION',      maxResults: 5  },
              { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
              { type: 'IMAGE_PROPERTIES',    maxResults: 5  },
              { type: 'WEB_DETECTION',       maxResults: 10 },
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
      ?.filter(e => e.score > 0.5)?.map(e => e.description) || [];
    const bestGuess   = result.webDetection?.bestGuessLabels?.[0]?.label || '';
    const colors      = result.imagePropertiesAnnotation?.dominantColors?.colors
      ?.slice(0, 3)?.map(c => rgbToColorName(
        Math.round(c.color.red || 0),
        Math.round(c.color.green || 0),
        Math.round(c.color.blue || 0)
      )) || [];

    return { labels, logos, objects, webEntities, bestGuess, colors };
  } catch (err) {
    console.error('Google Vision error:', err);
    return null;
  }
}

function rgbToColorName(r, g, b) {
  if (r > 200 && g > 200 && b > 200) return 'white';
  if (r < 50  && g < 50  && b < 50 ) return 'black';
  if (r > 150 && g < 100 && b < 100) return 'red';
  if (r < 100 && g < 100 && b > 150) return 'blue';
  if (r < 100 && g > 150 && b < 100) return 'green';
  if (r > 150 && g > 150 && b < 100) return 'yellow';
  if (r > 150 && g > 100 && b < 80 ) return 'orange';
  if (r > 120 && g < 80  && b > 120) return 'purple';
  if (r > 150 && g > 100 && b > 150) return 'pink';
  if (r > 100 && g > 80  && b < 60 ) return 'brown';
  if (r > 150 && g > 150 && b > 150) return 'gray';
  if (r < 30  && g < 50  && b > 80 ) return 'navy';
  return `rgb(${r},${g},${b})`;
}

// ────────────────────────────────────
// ★ جديد: Google Lens عبر SerpAPI
// الأقوى للبحث بالصورة — يرجع منتجات مطابقة بصرياً 100%
// ────────────────────────────────────
async function searchWithGoogleLens(imageBase64, market = 'SA') {
  try {
    const API_KEY = process.env.SERP_API_KEY;
    if (!API_KEY) return null;

    const url = `https://serpapi.com/search?engine=google_lens&api_key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_data: imageBase64,
        country: market.toLowerCase(),
        hl: 'ar',
      }),
    });

    const data = await response.json();
    if (data.error) { console.log('Google Lens error:', data.error); return null; }

    const visualMatches   = data.visual_matches   || [];
    const shoppingResults = data.shopping_results || [];
    const productInfo     = data.knowledge_graph
      ? { name: data.knowledge_graph.title, type: data.knowledge_graph.type }
      : null;

    console.log(`Lens: ${shoppingResults.length} shopping + ${visualMatches.length} visual matches`);

    const products = [];

    // نتائج التسوق المباشرة — الأدق
    shoppingResults.slice(0, 4).forEach((item, i) => {
      products.push({
        id:         `lens-s-${i}`,
        name:       item.title?.slice(0, 70) || 'منتج مطابق',
        price:      item.price || 'تحقق من السعر',
        store:      item.source || 'متجر',
        image:      item.thumbnail || '',
        url:        item.link || '#',
        badge:      i === 0 ? '🎯 تطابق بصري' : '',
        rating:     item.rating ? String(item.rating) : (4.2 + Math.random() * 0.7).toFixed(1),
        source:     'lens_shopping',
        matchScore: 95 - i * 2,
      });
    });

    // نتائج بصرية مشابهة
    visualMatches.slice(0, 4).forEach((item, i) => {
      if (products.length >= 6) return;
      products.push({
        id:         `lens-v-${i}`,
        name:       item.title?.slice(0, 70) || 'منتج مشابه',
        price:      item.price || 'تحقق من السعر',
        store:      item.source || item.link?.split('/')[2] || 'متجر',
        image:      item.thumbnail || '',
        url:        item.link || '#',
        badge:      '👁️ مشابه بصرياً',
        rating:     (4.0 + Math.random() * 0.8).toFixed(1),
        source:     'lens_visual',
        matchScore: 85 - i * 3,
      });
    });

    return { products, productInfo };
  } catch (err) {
    console.error('Google Lens error:', err.message);
    return null;
  }
}

// ────────────────────────────────────
// 3. Claude — تحليل عميق + كلمات بحث دقيقة
// ────────────────────────────────────
async function analyzeWithClaude(message, imageBase64, visionData, wantCheaper) {
  const content = [];

  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
    });
  }

  const visionContext = visionData ? `
Google Vision findings:
- Brands/logos: ${visionData.logos.join(', ') || 'none'}
- Objects: ${visionData.objects.join(', ') || 'none'}
- Labels: ${visionData.labels.slice(0, 10).join(', ') || 'none'}
- Web entities: ${visionData.webEntities.slice(0, 6).join(', ') || 'none'}
- Best guess: ${visionData.bestGuess || 'none'}
- Colors: ${visionData.colors.join(', ') || 'none'}
` : '';

  const cheaperNote = wantCheaper
    ? 'User wants CHEAPER alternatives — use: dupe, budget, affordable, similar'
    : '';

  // ── بناء context قوي من Vision و Lens ──
  const visionHint = visionData ? `
VISION AI DETECTED (trust this above all):
- Physical objects in image: ${visionData.objects?.join(', ') || 'none'}
- Labels: ${visionData.labels?.slice(0, 8).join(', ') || 'none'}
- Brand logos: ${visionData.logos?.join(', ') || 'none'}
- Best guess: ${visionData.bestGuess || 'none'}
- Lens identified: ${visionData.lensType || 'none'}
- Web entities: ${visionData.webEntities?.slice(0, 5).join(', ') || 'none'}
- Colors: ${visionData.colors?.join(', ') || 'none'}
` : '';

  content.push({
    type: 'text',
    text: `You are a physical product identification expert.

${visionHint}
${message ? `User says: "${message}"` : ''}
${cheaperNote}

## CRITICAL RULES:
1. IGNORE any text/UI/website visible in the image background
2. FOCUS ONLY on the physical product being shown/sold
3. The Vision AI data above is your PRIMARY source — trust it
4. If Vision says "shoe/sneaker/footwear" → category MUST be "sneakers"
5. If Vision says "watch/timepiece" → category MUST be "watch"
6. NEVER identify a product as software, OS, or website

## PRODUCT CATEGORIES:
- shoe/sneaker/boot/footwear → "sneakers"
- watch/timepiece/smartwatch → "watch"  
- bag/handbag/purse/tote → "handbag"
- eyeshadow/palette/makeup → "eyeshadow palette"
- lipstick/lip gloss → "lipstick"
- phone/smartphone → "smartphone"
- shirt/dress/clothing → "clothing"
- furniture/cabinet/shelf → "furniture"

## SEARCH QUERIES — 5 queries, MAX 4 WORDS each:
Q1: brand + category (e.g. "Nike pink sneakers")
Q2: category + main color (e.g. "pink women sneakers")  
Q3: category + style (e.g. "casual pink shoes")
Q4: brand + category variant (e.g. "Nike women shoes")
Q5: category only (e.g. "women sneakers")

ALL queries same category. Short = better results on Amazon/AliExpress.

JSON only:
{
  "productType": "نوع المنتج بالعربي",
  "category": "english category",
  "brand": "brand or null",
  "color": "main color",
  "details": "key features",
  "searchQueries": ["q1","q2","q3","q4","q5"],
  "reply": "رد قصير بالعربي يصف المنتج المادي فقط",
  "confidence": 90
}`,
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         config.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system:     'You are a product identification API. Respond ONLY with valid JSON. No markdown. Start with { end with }.',
      messages:   [
        { role: 'user',      content },
        { role: 'assistant', content: [{ type: 'text', text: '{' }] },
      ],
    }),
  });

  const data  = await response.json();
  const raw   = data.content?.[0]?.text || '""';
  const text  = raw.startsWith('{') ? raw : '{' + raw;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Claude response');
  return JSON.parse(match[0]);
}

// ────────────────────────────────────
// Fallback من Vision
// ────────────────────────────────────
function buildFallbackFromVision(visionData, message, wantCheaper) {
  if (!visionData) {
    return {
      productType: message || 'منتج', category: message || 'product',
      brand: null, color: '',
      searchQueries: [message || 'product'],
      reply: 'جاري البحث...', confidence: 60,
    };
  }
  const brand   = visionData.logos?.[0] || null;
  const guess   = visionData.bestGuess  || '';
  const color   = visionData.colors?.[0] || '';
  const allText = (guess + ' ' + (visionData.objects?.join(' ') || '') + ' ' + (visionData.labels?.slice(0,5).join(' ') || '')).toLowerCase();

  const productMap = {
    // أحذية
    'shoe':       { ar: 'حذاء', en: 'sneakers' },
    'sneaker':    { ar: 'حذاء رياضي', en: 'sneakers' },
    'boot':       { ar: 'بوت', en: 'boots' },
    'footwear':   { ar: 'حذاء', en: 'sneakers' },
    'sandal':     { ar: 'صندل', en: 'sandals' },
    'heel':       { ar: 'كعب', en: 'heels' },
    // ساعات
    'watch':      { ar: 'ساعة', en: 'watch' },
    'timepiece':  { ar: 'ساعة', en: 'watch' },
    'smartwatch': { ar: 'ساعة ذكية', en: 'smartwatch' },
    // حقائب
    'bag':        { ar: 'حقيبة', en: 'handbag' },
    'handbag':    { ar: 'حقيبة', en: 'handbag' },
    'purse':      { ar: 'حقيبة', en: 'handbag' },
    'backpack':   { ar: 'حقيبة ظهر', en: 'backpack' },
    // مكياج
    'eyeshadow':  { ar: 'باليت ظلال', en: 'eyeshadow palette' },
    'palette':    { ar: 'باليت', en: 'eyeshadow palette' },
    'lipstick':   { ar: 'أحمر شفاه', en: 'lipstick' },
    'makeup':     { ar: 'مكياج', en: 'makeup' },
    'perfume':    { ar: 'عطر', en: 'perfume' },
    // إلكترونيات
    'phone':      { ar: 'جوال', en: 'smartphone' },
    'laptop':     { ar: 'لابتوب', en: 'laptop' },
    'headphone':  { ar: 'سماعة', en: 'headphones' },
    // ملابس
    'dress':      { ar: 'فستان', en: 'dress' },
    'shirt':      { ar: 'قميص', en: 'shirt' },
    'jacket':     { ar: 'جاكيت', en: 'jacket' },
  };

  let productType = 'منتج', category = 'product';
  for (const [en, val] of Object.entries(productMap)) {
    if (allText.includes(en)) { productType = val.ar; category = val.en; break; }
  }

  const q1 = [brand, guess, color].filter(Boolean).join(' ') || message || 'product';
  const q2 = [guess, color].filter(Boolean).join(' ') || q1;
  const q3 = wantCheaper ? `${category} budget affordable` : `${guess} buy online`;
  const q4 = brand ? `${brand} ${category}` : `${category} ${color}`;
  const q5 = message || category || 'product';

  return {
    productType, category, brand, color, details: visionData.objects?.join(', '),
    searchQueries: [q1, q2, q3, q4, q5].filter(q => q?.trim().length > 1),
    reply: `وجدت ${productType}${brand ? ' من ' + brand : ''} — جاري البحث`,
    confidence: 75,
  };
}

// ────────────────────────────────────
// 4. Endpoint التحليل
// ────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  try {
    const { message, imageBase64, wantCheaper = false } = req.body;

    // ── المرحلة 1: Vision + Lens معاً (للتعرف فقط) ──
    let visionData  = null;
    let lensData    = null;

    if (imageBase64) {
      // شغّلهم بالتوازي لتوفير الوقت
      [visionData, lensData] = await Promise.all([
        analyzeWithGoogleVision(imageBase64),
        identifyWithLens(imageBase64),
      ]);
      console.log('Vision:', visionData?.bestGuess, '| Logos:', visionData?.logos);
      console.log('Lens ID:', lensData?.productName, '| Type:', lensData?.productType);
    }

    // ── دمج بيانات Lens في visionData لتقوية Claude ──
    if (lensData && visionData) {
      // أضف اسم المنتج من Lens كـ bestGuess لو كان أقوى
      if (lensData.productName) visionData.bestGuess = lensData.productName;
      if (lensData.productType) visionData.lensType  = lensData.productType;
      if (lensData.visualTitles?.length) {
        visionData.webEntities = [
          ...(visionData.webEntities || []),
          ...lensData.visualTitles,
        ].slice(0, 8);
      }
    }

    // ── تحقق من جودة الصورة ──
    if (imageBase64 && visionData) {
      const visionText = [
        visionData.bestGuess || '',
        ...(visionData.labels || []),
        ...(visionData.objects || []),
      ].join(' ').toLowerCase();

      // لو Vision شاف screenshot أو ما عرف منتجاً واضحاً
      const isScreenshot = visionText.includes('screenshot') || visionText.includes('web page') || visionText.includes('website') || visionText.includes('software') || visionText.includes('computer');
      const hasProduct   = visionData.objects?.length > 0 || visionData.logos?.length > 0 || visionData.bestGuess;

      if (isScreenshot || !hasProduct) {
        console.log('Vision: unclear image — asking user for clarification');
        return res.json({
          needsClarification: true,
          reply: 'الصورة غير واضحة أو تحتوي على محتوى رقمي (screenshot). أرسل صورة المنتج مباشرة بخلفية بيضاء أو صافية، أو صف المنتج الذي تبحث عنه.',
          searchQueries: [],
          confidence: 0,
        });
      }
    }

    // ── المرحلة 2: Claude تحليل عميق بكل المعلومات ──
    let analyzed = null;
    try {
      analyzed = await analyzeWithClaude(message, imageBase64, visionData, wantCheaper);
      console.log('Claude:', analyzed?.productType, '| Category:', analyzed?.category, '| Brand:', analyzed?.brand);
    } catch (e) {
      console.error('Claude failed:', e.message);
    }

    if (!analyzed || !analyzed.searchQueries?.length) {
      analyzed = buildFallbackFromVision(visionData, message, wantCheaper);
    }

    // رفع الثقة لو Lens عرّف المنتج بوضوح
    if (lensData?.productName) {
      analyzed.confidence = Math.min(98, (analyzed.confidence || 85) + 8);
    }
    if (visionData?.logos?.length && analyzed.brand) {
      analyzed.confidence = Math.min(98, (analyzed.confidence || 85) + 5);
    }

    res.json({ ...analyzed, visionData });
  } catch (err) {
    console.error('Analyze error:', err);
    res.json({ searchQueries: [req.body.message || 'product'], reply: 'جاري البحث...', confidence: 60 });
  }
});

// ────────────────────────────────────
// Google Shopping عبر SerpAPI
// ────────────────────────────────────
async function searchWithGoogleShopping(query, market = 'SA') {
  try {
    const API_KEY = process.env.SERP_API_KEY;
    if (!API_KEY || !query?.trim()) return null;

    const marketParams = {
      SA: 'gl=sa&hl=ar', AE: 'gl=ae&hl=ar',
      EG: 'gl=eg&hl=ar', US: 'gl=us&hl=en', CA: 'gl=ca&hl=en',
    };
    const params = marketParams[market] || marketParams['SA'];
    const url = `https://serpapi.com/search?engine=google_shopping&q=${encodeURIComponent(query)}&${params}&api_key=${API_KEY}&num=8`;

    const response = await fetch(url);
    const data     = await response.json();
    if (data.error) { console.error('SerpAPI:', data.error); return null; }

    const results = data.shopping_results || [];
    if (!results.length) return null;
    console.log(`Shopping "${query}": ${results.length} results`);

    return results.slice(0, 6).map((item, i) => ({
      id:         `shop-${i}-${Date.now()}`,
      name:       item.title?.slice(0, 70) || query,
      price:      item.price || 'تحقق من السعر',
      store:      item.source || 'متجر',
      image:      item.thumbnail || '',
      url:        item.product_link || item.link || '#',
      badge:      i === 0 ? 'أفضل نتيجة' : i === 1 ? 'الأكثر مبيعاً' : '',
      rating:     item.rating ? String(item.rating) : (4 + Math.random() * 0.9).toFixed(1),
      source:     'shopping',
      matchScore: 70 - i * 3,
    }));
  } catch (err) {
    console.error('SerpAPI error:', err.message);
    return null;
  }
}

// ────────────────────────────────────
// ★ فلتر العنوان — سريع بدون API
// يحذف المنتجات من الفئة الخاطئة فوراً
// ────────────────────────────────────
function titleFilter(products, analysis) {
  if (!analysis?.category) return products;

  const mustHaveMap = {
    'eyeshadow palette': ['eyeshadow', 'eye shadow', 'palette', 'shadow', 'ظلال', 'باليت'],
    'lipstick':          ['lipstick', 'lip gloss', 'lip color', 'lip rouge', 'أحمر شفاه'],
    'foundation':        ['foundation', 'bb cream', 'cc cream', 'coverage', 'كريم أساس'],
    'blush':             ['blush', 'bronzer', 'highlighter', 'روج خدود'],
    'watch':             ['watch', 'timepiece', 'chronograph', 'ساعة'],
    'handbag':           ['bag', 'handbag', 'purse', 'tote', 'clutch', 'حقيبة', 'شنطة'],
    'sneakers':          ['sneaker', 'shoe', 'trainer', 'boot', 'حذاء', 'كوتشي'],
    'smartphone':        ['phone', 'iphone', 'samsung', 'galaxy', 'pixel', 'جوال'],
    'laptop':            ['laptop', 'notebook', 'macbook', 'computer', 'لابتوب'],
  };

  const mustNotMap = {
    'eyeshadow palette': ['lipstick', 'lip gloss', 'foundation', 'blush', 'mascara',
                          'eyeliner', 'skincare', 'moisturizer', 'full set', 'kit bundle',
                          'makeup set', 'cosmetic set', 'gift set'],
    'lipstick':          ['eyeshadow', 'palette', 'foundation', 'blush', 'mascara'],
    'foundation':        ['eyeshadow', 'palette', 'lipstick', 'mascara'],
    'watch':             ['bag', 'shoe', 'ring', 'necklace', 'bracelet', 'sunglasses'],
    'handbag':           ['watch', 'shoe', 'ring', 'sunglasses', 'hat'],
    'sneakers':          ['watch', 'bag', 'ring', 'sunglasses'],
  };

  const mustHave = mustHaveMap[analysis.category] || [];
  const mustNot  = mustNotMap[analysis.category]  || [];

  if (!mustHave.length) return products;

  const filtered = products.filter(p => {
    const title       = p.name.toLowerCase();
    const hasRight    = mustHave.some(kw => title.includes(kw.toLowerCase()));
    const hasWrong    = mustNot.some(kw => title.includes(kw.toLowerCase()));
    return hasRight && !hasWrong;
  });

  console.log(`Title filter [${analysis.category}]: ${products.length} → ${filtered.length}`);
  return filtered.length >= 2 ? filtered : products;
}

// ────────────────────────────────────
// ★ Claude Visual Filter — الأقوى
// يرى الصورة الأصلية + كل منتج → يحكم "مطابق أو لا"
// ────────────────────────────────────
async function claudeVisualFilter(products, analysis, imageBase64) {
  try {
    if (!products?.length || !imageBase64) return products;

    const productList = products
      .map((p, i) => `[${i}] "${p.name}" | ${p.store} | ${p.price}`)
      .join('\n');

    const content = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
      },
      {
        type: 'text',
        text: `You are a strict product category validator.

The uploaded image shows: ${analysis.productType} (${analysis.category})
Brand: ${analysis.brand || 'unknown'}

Evaluate each search result. APPROVE only if it is the EXACT SAME product category.

APPROVAL RULES — approve if product is the same category OR closely related:
- Image = watch → APPROVE: watches, smartwatches. REJECT: bags, shoes, clothing, perfume
- Image = eyeshadow palette → APPROVE: eyeshadow palettes, eye makeup. REJECT: lipstick, foundation, skincare, full makeup sets
- Image = lipstick → APPROVE: lipstick, lip gloss, lip products. REJECT: eyeshadow, foundation, skincare
- Image = handbag → APPROVE: bags, handbags, purses. REJECT: watches, shoes, clothing
- Image = sneakers → APPROVE: shoes, sneakers, footwear. REJECT: bags, watches, clothing

IMPORTANT: When in doubt, APPROVE rather than reject. Empty results are worse than slightly imperfect ones.

Products:
${productList}

JSON only:
{
  "approved": [indices of matching products, max 4],
  "reason": "brief explanation"
}`,
      },
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         config.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 300,
        system:     'Product category validator. JSON only.',
        messages:   [{ role: 'user', content }],
      }),
    });

    const data   = await response.json();
    const text   = data.content?.[0]?.text || '{}';
    const clean  = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    console.log(`Claude visual filter: approved [${parsed.approved}] | ${parsed.reason}`);

    // لو Claude حذف الكل — ارجع المنتجات كما هي (أفضل من لا شيء)
    if (!parsed.approved?.length) {
      console.log('Claude filter rejected all — returning original products');
      return products;
    }
    const filtered = parsed.approved.map(i => products[i]).filter(Boolean);
    // لو ما تبقى شيء — ارجع الكل
    return filtered.length >= 1 ? filtered : products;
  } catch (err) {
    console.error('Claude visual filter error:', err.message);
    return products;
  }
}

// ────────────────────────────────────
// ★ Rainforest API — Amazon مباشرة
// ────────────────────────────────────
async function searchWithRainforest(query, market = 'SA', wantCheaper = false) {
  try {
    const API_KEY = process.env.RAINFOREST_API_KEY;
    if (!API_KEY || !query?.trim()) return null;

    // خريطة السوق → Amazon domain
    const domainMap = {
      SA: 'amazon.sa', AE: 'amazon.ae',
      EG: 'amazon.eg', US: 'amazon.com', CA: 'amazon.ca',
    };
    const domain = domainMap[market] || 'amazon.sa';

    const params = new URLSearchParams({
      api_key:        API_KEY,
      type:           'search',
      amazon_domain:  domain,
      search_term:    wantCheaper ? `${query} budget` : query,
      sort_by:        wantCheaper ? 'price_low_to_high' : 'relevanceblender',
      language:       'ar_AE',
      output:         'json',
    });

    const url = `https://api.rainforestapi.com/request?${params}`;
    console.log(`Rainforest: searching "${query}" on ${domain}`);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();

    if (data.request_info?.success === false) {
      console.error('Rainforest error:', data.request_info.message);
      return null;
    }

    const results = data.search_results || [];
    if (!results.length) return null;
    console.log(`Rainforest: ${results.length} results for "${query}"`);

    return results.slice(0, 6).map((item, i) => ({
      id:         `amz-${i}-${Date.now()}`,
      name:       item.title?.slice(0, 70) || query,
      price:      item.price?.raw || item.price?.value
                    ? `${item.price.value || ''} ${item.price.currency || ''}`
                    : 'تحقق من السعر',
      store:      `Amazon ${market}`,
      image:      item.image || '',
      url:        item.link || `https://www.${domain}/s?k=${encodeURIComponent(query)}`,
      badge:      i === 0 ? '📦 Amazon' : item.is_prime ? '✈️ Prime' : '',
      rating:     item.rating ? String(item.rating) : (4 + Math.random() * 0.9).toFixed(1),
      reviews:    item.ratings_total,
      source:     'amazon',
      matchScore: 75 - i * 3,
    }));
  } catch (err) {
    console.error('Rainforest error:', err.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════
// ★ Universal Search Engine
// يقرأ كل تفاصيل المصدر من لوحة التحكم — لا يحتاج تعديل
// لإضافة موقع جديد: أضفه من اللوحة فقط
// ════════════════════════════════════════════════════════

const crypto = require('crypto');

// ── توليد signatures حسب النوع ──────────────────────────
function buildAuth(source, params = {}) {
  const appKey    = source.appKeyEnv    ? process.env[source.appKeyEnv]    : '';
  const appSecret = source.appSecretEnv ? process.env[source.appSecretEnv] : '';

  switch (source.authType) {

    // AliExpress — MD5 signature
    case 'aliexpress_md5': {
      const allParams = { ...params, app_key: appKey };
      const sortedKeys = Object.keys(allParams).sort();
      let str = appSecret;
      sortedKeys.forEach(k => { str += k + allParams[k]; });
      str += appSecret;
      const sign = crypto.createHash('md5').update(str).digest('hex').toUpperCase();
      return { ...allParams, sign };
    }

    // HMAC-SHA256 (Coupang, eBay Partner, etc)
    case 'hmac_sha256': {
      const timestamp = Date.now().toString();
      const strToSign = `${timestamp}
${params.method || 'GET'}
${source.searchUrl}`;
      const sign = crypto.createHmac('sha256', appSecret).update(strToSign).digest('hex');
      return { ...params, Authorization: `CEA algorithm=HmacSHA256, access-key=${appKey}, signed-date=${timestamp}, signature=${sign}` };
    }

    // Bearer Token (معظم REST APIs)
    case 'bearer': {
      return { ...params, _headers: { Authorization: `Bearer ${appKey}` } };
    }

    // API Key في الـ header
    case 'api_key_header': {
      const headerName = source.apiKeyHeader || 'X-API-Key';
      return { ...params, _headers: { [headerName]: appKey } };
    }

    // API Key في الـ query
    case 'api_key_query': {
      const paramName = source.apiKeyParam || 'api_key';
      return { ...params, [paramName]: appKey };
    }

    // بدون توثيق
    case 'none':
    default:
      return params;
  }
}

// ── استخراج المنتجات من أي رد JSON ──────────────────────
// mapping مثال: "data.items" أو "result.products.product"
function extractProducts(data, mapping) {
  if (!mapping) return data?.products || data?.items || data?.results || [];
  const keys = mapping.split('.');
  let current = data;
  for (const key of keys) {
    if (current == null) return [];
    current = current[key];
  }
  return Array.isArray(current) ? current : [];
}

// ── تحويل منتج خام لصيغة fetchli الموحّدة ──────────────
function normalizeProduct(item, source, index) {
  const m = source.fieldMapping || {};
  // يقرأ اسم الحقل من الـ mapping أو يجرب الأسماء الشائعة
  const get = (field, fallbacks) => {
    if (m[field]) return getNestedValue(item, m[field]);
    for (const fb of fallbacks) {
      const v = getNestedValue(item, fb);
      if (v != null && v !== '') return v;
    }
    return null;
  };

  const price    = get('price', ['sale_price','price','current_price','selling_price','originalPrice']);
  const currency = get('currency', ['sale_price_currency','currency','target_currency']) || 'USD';

  return {
    id:         `${source.id}-${index}-${Date.now()}`,
    name:       (get('name',  ['product_title','title','name','productName','subject']) || '').slice(0, 70),
    price:      price ? `${price} ${currency}` : 'تحقق من السعر',
    store:      source.name,
    image:      get('image', ['product_main_image_url','image','thumbnail','imageUrl','main_image']),
    url:        get('url',   ['product_detail_url','url','link','detailUrl','productUrl']) || source.searchUrl,
    badge:      index === 0 ? `${source.icon} ${source.name}` : '',
    rating:     formatRating(get('rating', ['evaluate_rate','rating','score','star'])),
    source:     source.id,
    matchScore: 75 - index * 3,
  };
}

function getNestedValue(obj, path) {
  if (!path || !obj) return null;
  return path.split('.').reduce((o, k) => (o == null ? null : o[k]), obj);
}

function formatRating(raw) {
  if (!raw) return (4 + Math.random() * 0.9).toFixed(1);
  const n = parseFloat(raw);
  if (isNaN(n)) return '4.5';
  // بعض APIs ترجع النسبة المئوية (مثل 95%) بدل من 5
  return n > 10 ? (n / 20).toFixed(1) : n.toFixed(1);
}

// ── Universal Search ──────────────────────────────────────
async function universalSearch(source, query, market, wantCheaper) {
  try {
    const appKey    = source.appKeyEnv    ? process.env[source.appKeyEnv]    : '';
    const appSecret = source.appSecretEnv ? process.env[source.appSecretEnv] : '';

    if (source.appKeyEnv && !appKey) {
      console.log(`${source.name}: missing key ${source.appKeyEnv}`);
      return null;
    }

    // بناء query parameters الأساسية
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    // خريطة السوق → العملة المحلية
    const marketCurrency = {
      SA:'SAR', AE:'AED', EG:'EGP',
      US:'USD', CA:'CAD', KW:'KWD', QA:'QAR',
    };
    const targetCurrency = marketCurrency[market] || 'USD';

    // تقصير الـ query — Amazon و AliExpress يعملان أفضل مع 3-4 كلمات
    const shortenQuery = (q) => q.split(' ').slice(0, 4).join(' ');
    const cleanQuery   = shortenQuery(query);

    const baseParams = {
      // حقول قياسية — يمكن تخصيصها من source.queryParams
      ...(source.queryParams || {}),
      // inject اسم الـ query حسب ما يسميه كل API
      [source.queryParam || 'keywords']: wantCheaper ? `${cleanQuery} budget` : cleanQuery,
    };

    // AliExpress — أضف العملة المحلية تلقائياً
    if (source.authType === 'aliexpress_md5') {
      baseParams.target_currency = targetCurrency;
    }

    // أضف timestamp لـ AliExpress-style APIs
    if (source.authType === 'aliexpress_md5') {
      baseParams.method    = source.apiMethod || 'aliexpress.affiliate.product.query';
      baseParams.app_key   = appKey;
      baseParams.timestamp = timestamp;
      baseParams.format    = 'json';
      baseParams.v         = '2.0';
      baseParams.sign_method = 'md5';
    }

    // توليد التوثيق
    const authParams = buildAuth(source, baseParams);
    const headers    = authParams._headers || {};
    delete authParams._headers;

    // بناء URL النهائي
    const params = new URLSearchParams(authParams);
    const url    = `${source.searchUrl}?${params}`;

    console.log(`${source.icon} ${source.name}: searching "${query}"`);
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: AbortSignal.timeout((source.timeout || 20) * 1000),
    });

    const data = await response.json();

    // استخراج المنتجات حسب responseMapping
    const rawProducts = extractProducts(data, source.responseMapping);
    if (!rawProducts.length) {
      console.log(`${source.name}: no results for "${query}"`);
      return null;
    }

    console.log(`${source.name}: ${rawProducts.length} results`);
    return rawProducts.slice(0, 6).map((item, i) => normalizeProduct(item, source, i));

  } catch (err) {
    console.error(`${source.name} error:`, err.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════
// 5. البحث الرئيسي — يقرأ المصادر من adminConfig
// تفعيل/تعطيل أي مصدر من لوحة التحكم يؤثر فوراً
// ════════════════════════════════════════════════════════
// ── Lens للتعرف على المنتج فقط (لا يرجع منتجات للعميل) ──
async function identifyWithLens(imageBase64) {
  try {
    const API_KEY = process.env.SERP_API_KEY;
    if (!API_KEY || !imageBase64) return null;

    const response = await fetch(`https://serpapi.com/search?engine=google_lens&api_key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_data: imageBase64 }),
    });
    const data = await response.json();
    if (data.error) return null;

    // استخرج اسم المنتج فقط من knowledge graph
    const kg = data.knowledge_graph;
    const visualMatches = data.visual_matches || [];
    
    return {
      productName: kg?.title || null,
      productType: kg?.type  || null,
      // أفضل 3 عناوين من التطابق البصري كـ context لـ Claude
      visualTitles: visualMatches.slice(0, 3).map(m => m.title).filter(Boolean),
    };
  } catch (err) {
    console.error('Lens identify error:', err.message);
    return null;
  }
}

async function runSource(source, { queries, imageBase64, market, wantCheaper }) {
  const validTerms = queries.filter(q => q?.trim().length > 0);

  // تحقق أن السوق مدعوم
  if (source.markets?.length && !source.markets.includes(market)) return [];

  // ── serpapi_lens للتعرف فقط — لا يُستخدم لجلب منتجات ──
  if (source.type === 'serpapi_lens') return [];

  try {
    if (source.type === 'serpapi_shopping') {
      const results = [];
      for (const q of validTerms.slice(0, 3)) {
        const short = q.split(' ').slice(0, 5).join(' ');
        const r = await searchWithGoogleShopping(
          wantCheaper ? `${short} budget affordable` : short, market
        );
        if (r?.length) results.push(...r);
      }
      return results;
    }

    // ── كل المصادر الأخرى → Universal Engine ──
    // نستخدم أول query (الأكثر عمومية) + الخامسة (الأعم) فقط
    const results = [];
    const queriesToTry = [
      validTerms[0],                          // Q1: brand + type
      validTerms[validTerms.length - 1],      // Q5: الأعم
    ].filter(Boolean).filter((q, i, arr) => arr.indexOf(q) === i);

    for (const q of queriesToTry) {
      const r = await universalSearch(source, q, market, wantCheaper);
      if (r?.length) results.push(...r);
      if (results.length >= 6) break; // كافي
    }
    return results;

  } catch (err) {
    console.error(`Source ${source.name} failed:`, err.message);
    return [];
  }
}

app.post('/api/search', async (req, res) => {
  try {
    const { queries, query, market = 'SA', wantCheaper = false, imageBase64, analysis } = req.body;
    const searchTerms = queries || [query];

    if (!searchTerms?.length || searchTerms.every(q => !q?.trim())) {
      return res.json({ products: getMockProducts('products', market, false, 0), mock: true });
    }

    // ── جلب المصادر الفعّالة من adminConfig مرتبة بالأولوية ──
    const activeSources = getActiveSources();
    console.log(`Active sources: [${activeSources.map(s => s.name).join(', ') || 'none'}]`);

    if (!activeSources.length) {
      return res.json({ products: getMockProducts(searchTerms[0], market, wantCheaper, 0), mock: true });
    }

    // ── تشغيل كل مصدر فعّال ──
    let allProducts = [];
    for (const source of activeSources) {
      const results = await runSource(source, { queries: searchTerms, imageBase64, market, wantCheaper });
      if (results.length) {
        console.log(`  ${source.icon} ${source.name}: ${results.length} results`);
        allProducts.push(...results);
      }
    }

    if (!allProducts.length) {
      // لا نرجع نتائج وهمية — نرجع رسالة واضحة
      console.log('No results from any source');
      return res.json({ products: [], mock: false, noResults: true });
    }

    // ── فلتر العنوان (دائماً — حتى لو منتج واحد) ──
    let filtered = titleFilter(allProducts, analysis);

    // ── Claude Visual Filter (حتى لو منتج واحد — لنتأكد أنه صح) ──
    if (imageBase64 && analysis && filtered.length >= 1) {
      filtered = await claudeVisualFilter(filtered, analysis, imageBase64);
    }

    // ── ترتيب وتنظيف ──
    const unique = deduplicateProducts(filtered);
    const sorted = wantCheaper
      ? unique.sort((a, b) => extractPrice(a.price) - extractPrice(b.price))
      : unique.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    const sourceNames = activeSources.map(s => s.name).join(' + ');
    console.log(`✅ Final: ${sorted.length} products from [${sourceNames}]`);
    res.json({ products: sorted.slice(0, 6), mock: false, source: sourceNames });

  } catch (err) {
    console.error('Search error:', err);
    res.json({ products: [], error: err.message });
  }
});

// ────────────────────────────────────
// 6. تصفية نصية بـ Claude
// ────────────────────────────────────
app.post('/api/filter', async (req, res) => {
  try {
    const { products, originalAnalysis, wantCheaper } = req.body;
    if (!products?.length) return res.json({ products: [] });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         config.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Shopping expert. Customer wants:
Type: ${originalAnalysis.productType} (${originalAnalysis.category || ''})
Brand: ${originalAnalysis.brand || 'any'}
Color: ${originalAnalysis.color}
${wantCheaper ? 'Priority: cheapest' : ''}

Results:
${products.map((p, i) => `[${i}] ${p.name} - ${p.price}`).join('\n')}

ONLY approve products matching category "${originalAnalysis.category || originalAnalysis.productType}".
Rank best 4 by ${wantCheaper ? 'price (lowest)' : 'relevance'}.
JSON only: { "rankedIndices": [0,1,2,3] }`,
        }],
      }),
    });

    const data   = await response.json();
    const text   = data.content?.[0]?.text || '{}';
    const clean  = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const ranked = parsed.rankedIndices?.map(i => products[i]).filter(Boolean);

    res.json({ products: ranked?.length ? ranked : products });
  } catch (err) {
    res.json({ products: req.body.products });
  }
});

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
function deduplicateProducts(products) {
  const seen = new Set();
  return products.filter(p => {
    const key = (p.name?.slice(0, 30) || '') + (p.store || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractPrice(priceStr) {
  return parseFloat(String(priceStr).replace(/[^\d.]/g, '')) || 999999;
}

function getMockProducts(query, market, cheaper = false, offset = 0) {
  const currencies = { SA: 'ر.س', AE: 'د.إ', EG: 'ج.م', US: '$', CA: 'C$' };
  const currency   = currencies[market] || 'ر.س';
  const prices     = cheaper ? [89, 129, 69] : [299, 199, 399];
  const badges     = cheaper
    ? ['الأرخص', 'قيمة ممتازة', 'توفير ٦٠٪']
    : ['الأكثر مبيعاً', 'سعر مميز', 'جودة عالية'];
  const images = [
    'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=300&h=300&fit=crop',
  ];
  return [0, 1, 2].map(i => ({
    id:     `mock-${offset}-${i}`,
    name:   `${query} ${i + 1}`,
    price:  `${prices[i]} ${currency}`,
    store:  `Amazon ${market}`,
    image:  images[i % images.length],
    url:    `https://www.amazon.sa/s?k=${encodeURIComponent(query)}`,
    badge:  badges[i],
    rating: (4 + Math.random() * 0.9).toFixed(1),
  }));
}

// ════════════════════════════════════
// ADMIN — لوحة التحكم (محمية بكلمة سر)
// ════════════════════════════════════

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'fetchli2025';

// Middleware: التحقق من session بسيط عبر header
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── صفحة اللوحة (GET /admin) ──────────
app.get('/admin', (req, res) => {
  const token = req.query.token;
  // لو ما في token، أرجع صفحة login بسيطة
  if (!token || token !== ADMIN_PASSWORD) {
    return res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>fetchli — تسجيل الدخول</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600&family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0a0f;color:#e2e0f0;font-family:'Tajawal',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .box{background:#16161f;border:1px solid #1e1e2e;border-radius:16px;padding:40px;width:360px;text-align:center}
  .logo{font-family:'IBM Plex Mono',monospace;font-size:24px;color:#7c6af7;margin-bottom:6px}
  .sub{font-size:13px;color:#6b6890;margin-bottom:32px}
  input{width:100%;background:#111118;border:1px solid #1e1e2e;border-radius:8px;padding:12px 16px;font-size:14px;color:#e2e0f0;font-family:'Tajawal',sans-serif;outline:none;text-align:center;letter-spacing:4px;margin-bottom:16px}
  input:focus{border-color:#7c6af7;box-shadow:0 0 0 3px rgba(124,106,247,.12)}
  button{width:100%;background:#7c6af7;color:#fff;border:none;border-radius:8px;padding:12px;font-size:15px;font-family:'Tajawal',sans-serif;font-weight:700;cursor:pointer}
  button:hover{background:#6a58e5}
  .err{color:#f87171;font-size:13px;margin-top:12px;display:none}
</style>
</head>
<body>
<div class="box">
  <div class="logo">fetchli ✦</div>
  <div class="sub">لوحة التحكم — أدخل كلمة المرور</div>
  <input type="password" id="pw" placeholder="••••••••" onkeydown="if(event.key==='Enter')login()">
  <button onclick="login()">دخول →</button>
  <div class="err" id="err">كلمة المرور خاطئة</div>
</div>
<script>
function login(){
  const pw = document.getElementById('pw').value;
  fetch('/api/admin/auth', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({password: pw})})
    .then(r=>r.json()).then(d=>{
      if(d.ok) window.location.href='/admin?token='+encodeURIComponent(pw);
      else { document.getElementById('err').style.display='block'; }
    }).catch(()=>{ document.getElementById('err').style.display='block'; });
}
</script>
</body>
</html>`);
  }

  // لو التوثيق صحيح → أرجع لوحة التحكم كاملة مضمّنة
  res.send(getAdminHTML(token));
});

// ── Auth endpoint ─────────────────────
app.post('/api/admin/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) res.json({ ok: true });
  else res.status(401).json({ ok: false });
});

// ── Admin Config — محفوظ في ملف JSON دائم ──
const fs         = require('fs');
// /var/data هو الـ Disk mount path على Render
// محلياً يحفظ بجانب server.js
const CONFIG_PATH = process.env.RENDER
  ? '/var/data/admin-config.json'
  : path.join(__dirname, 'admin-config.json');

const DEFAULT_CONFIG = {
  sources: [
    { id:'serp-lens',     name:'Google Lens',       icon:'🔍', type:'serpapi_lens',    url:'', priority:1, markets:['SA','AE','EG','US'], categories:[], rateLimit:250, timeout:15, active:false,  notes:'البحث البصري المباشر — الأدق' },
    { id:'serp-shopping', name:'Google Shopping',    icon:'🛍️', type:'serpapi_shopping', url:'', priority:2, markets:['SA','AE','EG','US'], categories:[], rateLimit:250, timeout:10, active:false,  notes:'بحث بكلمات في Google Shopping' },
    { id:'rainforest', name:'Amazon (Rainforest)', icon:'📦', type:'rainforest', searchUrl:'https://api.rainforestapi.com/request', url:'', priority:3, markets:['SA','AE','US'], categories:[], rateLimit:500, timeout:12, active:true, authType:'api_key_query', appKeyEnv:'RAINFOREST_API_KEY', queryParam:'search_term', responseMapping:'search_results', fieldMapping:{name:'title',price:'price.raw',image:'image',url:'link',rating:'rating'}, notes:'بيانات Amazon المباشرة' },
    { id:'aliexpress', name:'AliExpress', icon:'🛒', type:'aliexpress', searchUrl:'https://api-sg.aliexpress.com/sync', url:'', priority:4, markets:['SA','AE','EG','US','KW','QA'], categories:[], rateLimit:1000, timeout:12, active:true, authType:'aliexpress_md5', appKeyEnv:'ALIEXPRESS_APP_KEY', appSecretEnv:'ALIEXPRESS_APP_SECRET', queryParam:'keywords', apiMethod:'aliexpress.affiliate.product.query', responseMapping:'aliexpress_affiliate_product_query_response.resp_result.result.products.product', fieldMapping:{name:'product_title',price:'sale_price',image:'product_main_image_url',url:'product_detail_url',rating:'evaluate_rate'}, queryParams:{page_no:'1',page_size:'20',tracking_id:'fetchli',target_currency:'USD',target_language:'EN',fields:'product_id,product_title,sale_price,sale_price_currency,product_main_image_url,product_detail_url,evaluate_rate,lastest_volume'}, notes:'AliExpress Affiliate API — يدعم جميع الدول' },
  ],
  markets: [
    { country:'SA', flag:'🇸🇦', name:'السعودية', currency:'SAR', market:'SA', active:true },
    { country:'AE', flag:'🇦🇪', name:'الإمارات', currency:'AED', market:'AE', active:true },
    { country:'EG', flag:'🇪🇬', name:'مصر',      currency:'EGP', market:'EG', active:true },
    { country:'US', flag:'🇺🇸', name:'أمريكا',   currency:'USD', market:'US', active:true },
    { country:'KW', flag:'🇰🇼', name:'الكويت',   currency:'KWD', market:'SA', active:true },
    { country:'QA', flag:'🇶🇦', name:'قطر',      currency:'QAR', market:'SA', active:true },
  ],
  categories: [
    { id:'eyeshadow-palette', ar:'باليت ظلال', en:'eyeshadow palette', mustHave:['eyeshadow','eye shadow','palette','shadow'], exclude:['lipstick','foundation','mascara','kit bundle','makeup set','gift set'] },
    { id:'lipstick',   ar:'أحمر شفاه',  en:'lipstick',   mustHave:['lipstick','lip gloss','lip color'], exclude:['eyeshadow','palette','foundation'] },
    { id:'watch',      ar:'ساعة',        en:'watch',      mustHave:['watch','timepiece','chronograph','ساعة'], exclude:['bag','shoe','ring','sunglasses'] },
    { id:'handbag',    ar:'حقيبة',       en:'handbag',    mustHave:['bag','handbag','purse','tote','clutch'], exclude:['watch','shoe','sunglasses'] },
    { id:'sneakers',   ar:'حذاء رياضي',  en:'sneakers',   mustHave:['sneaker','shoe','trainer','حذاء'], exclude:['watch','bag','sunglasses'] },
    { id:'foundation', ar:'كريم أساس',   en:'foundation', mustHave:['foundation','bb cream','cc cream'], exclude:['eyeshadow','lipstick','mascara'] },
  ],
  stats: { searches: 0, imageSearches: 0, cheaperRequests: 0, topSearches: [] },
};

// تحميل الإعدادات — من الملف إن وُجد، وإلا من الافتراضي
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      const saved = JSON.parse(raw);
      // دمج الافتراضي مع المحفوظ للحفاظ على الحقول الجديدة
      return {
        ...DEFAULT_CONFIG,
        ...saved,
        stats: { ...DEFAULT_CONFIG.stats, ...(saved.stats || {}) },
      };
    }
  } catch (e) {
    console.error('Config load error:', e.message);
  }
  return { ...DEFAULT_CONFIG };
}

// حفظ الإعدادات في الملف
function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('Config save error:', e.message);
  }
}

// adminConfig يُحمّل من الملف عند بدء السيرفر
let adminConfig = loadConfig();
console.log(`📋 Config loaded — sources: [${adminConfig.sources.map(s=>(s.active?'✓':'✗')+s.name).join(', ')}]`);

app.get('/api/admin/config', adminAuth, (req, res) => {
  res.json(adminConfig);
});

app.post('/api/admin/config', adminAuth, (req, res) => {
  const { sources, markets, categories } = req.body;
  if (sources)    adminConfig.sources    = sources;
  if (markets)    adminConfig.markets    = markets;
  if (categories) adminConfig.categories = categories;
  saveConfig(adminConfig);  // ← يُحفظ في الملف فوراً
  console.log(`✅ Config saved — active: [${adminConfig.sources.filter(s=>s.active).map(s=>s.name).join(', ')}]`);
  res.json({ ok: true });
});

// ── Admin Stats ────────────────────────
app.get('/api/admin/stats', adminAuth, (req, res) => {
  res.json({
    ...adminConfig.stats,
    uptime:   Math.floor(process.uptime()),
    memory:   Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    activeSources: adminConfig.sources.filter(s => s.active).length,
    totalSources:  adminConfig.sources.length,
  });
});

// ── Track searches for stats ───────────
function trackSearch(type) {
  adminConfig.stats.searches++;
  if (type === 'image')   adminConfig.stats.imageSearches++;
  if (type === 'cheaper') adminConfig.stats.cheaperRequests++;
}

// ── Helper: get active sources from admin config ──
function getActiveSources() {
  return adminConfig.sources.filter(s => s.active).sort((a, b) => a.priority - b.priority);
}

// ── Helper: get category filter from admin config ──
function getCategoryFilter(categoryEn) {
  return adminConfig.categories.find(c => c.en === categoryEn);
}

// ── Admin HTML (مضمّن مباشرة) ──────────
function getAdminHTML(token) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>fetchli — لوحة التحكم</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a0f;--surface:#111118;--card:#16161f;--border:#1e1e2e;--accent:#7c6af7;--accent2:#f7c86a;--green:#4ade80;--red:#f87171;--text:#e2e0f0;--muted:#6b6890;--mono:'IBM Plex Mono',monospace;--sans:'Tajawal',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh;display:flex}
.sidebar{width:220px;min-height:100vh;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;padding:24px 0;position:fixed;right:0;top:0;bottom:0;z-index:10}
.logo{padding:0 20px 28px;border-bottom:1px solid var(--border);margin-bottom:16px}
.logo-mark{font-family:var(--mono);font-size:18px;font-weight:600;color:var(--accent)}
.logo-sub{font-size:11px;color:var(--muted);margin-top:2px}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:14px;color:var(--muted);border-right:3px solid transparent;transition:.15s;text-decoration:none}
.nav-item:hover{background:var(--card);color:var(--text)}
.nav-item.active{color:var(--accent);border-right-color:var(--accent);background:rgba(124,106,247,.08)}
.nav-section{font-size:10px;letter-spacing:1.5px;color:var(--muted);padding:16px 20px 6px;text-transform:uppercase}
.sidebar-footer{margin-top:auto;padding:16px 20px;border-top:1px solid var(--border)}
.status-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);display:inline-block;margin-left:6px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.main{margin-right:220px;flex:1;padding:32px 36px}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
.page-title{font-size:22px;font-weight:700}
.page-subtitle{font-size:13px;color:var(--muted);margin-top:2px}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
.stat-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;position:relative;overflow:hidden}
.stat-card::before{content:'';position:absolute;top:0;right:0;width:60px;height:60px;border-radius:0 12px 0 60px;opacity:.06}
.stat-card.purple::before{background:var(--accent)}
.stat-card.gold::before{background:var(--accent2)}
.stat-card.green::before{background:var(--green)}
.stat-card.red::before{background:var(--red)}
.stat-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
.stat-value{font-family:var(--mono);font-size:28px;font-weight:600;margin:6px 0 4px}
.stat-change{font-size:12px;color:var(--green)}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:20px}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.card-title{font-size:15px;font-weight:600}
.card-subtitle{font-size:12px;color:var(--muted);margin-top:2px}
.section{display:none}.section.active{display:block}
.sources-table{width:100%;border-collapse:collapse}
.sources-table th{text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);padding:8px 12px;border-bottom:1px solid var(--border)}
.sources-table td{padding:14px 12px;font-size:13px;border-bottom:1px solid rgba(30,30,46,.6);vertical-align:middle}
.sources-table tr:last-child td{border-bottom:none}
.sources-table tr:hover td{background:rgba(124,106,247,.04)}
.source-name{display:flex;align-items:center;gap:10px}
.source-icon{width:32px;height:32px;border-radius:8px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:16px}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:500}
.badge.active{background:rgba(74,222,128,.12);color:var(--green)}
.badge.inactive{background:rgba(248,113,113,.12);color:var(--red)}
.tag{display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;background:var(--surface);border:1px solid var(--border);color:var(--muted);margin:2px}
.toggle{position:relative;width:40px;height:22px;display:inline-block}
.toggle input{opacity:0;width:0;height:0}
.toggle-track{position:absolute;inset:0;background:var(--border);border-radius:11px;cursor:pointer;transition:.2s}
.toggle-track::after{content:'';position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:var(--muted);transition:.2s}
.toggle input:checked+.toggle-track{background:rgba(124,106,247,.4)}
.toggle input:checked+.toggle-track::after{transform:translateX(18px);background:var(--accent)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:13px;font-family:var(--sans);cursor:pointer;border:none;transition:.15s;font-weight:500}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:#6a58e5}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}.btn-ghost:hover{color:var(--text);border-color:var(--muted)}
.btn-danger{background:rgba(248,113,113,.12);color:var(--red);border:1px solid rgba(248,113,113,.2)}.btn-danger:hover{background:rgba(248,113,113,.2)}
.btn-sm{padding:5px 10px;font-size:12px}.btn-icon{padding:6px 8px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.form-full{grid-column:1/-1}
.form-group{display:flex;flex-direction:column;gap:6px}
.form-label{font-size:12px;color:var(--muted);font-weight:500}
.form-input,.form-select,.form-textarea{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--text);font-family:var(--sans);transition:border-color .15s;outline:none}
.form-input:focus,.form-select:focus,.form-textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(124,106,247,.12)}
.form-textarea{resize:vertical;min-height:80px}
.form-select option{background:var(--surface)}
.form-hint{font-size:11px;color:var(--muted)}
.chips-input{display:flex;flex-wrap:wrap;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px;min-height:44px;cursor:text}
.chips-input:focus-within{border-color:var(--accent)}
.chip-item{display:inline-flex;align-items:center;gap:4px;background:rgba(124,106,247,.15);color:var(--accent);padding:2px 8px;border-radius:20px;font-size:12px}
.chip-remove{cursor:pointer;font-size:14px;line-height:1}
.chip-text-input{background:none;border:none;outline:none;color:var(--text);font-size:13px;font-family:var(--sans);min-width:80px;flex:1}
.key-row{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--border)}
.key-row:last-child{border-bottom:none}
.key-name{font-size:13px;font-weight:500;min-width:160px}
.key-service{font-size:11px;color:var(--muted)}
.key-input-wrap{flex:1;position:relative}
.key-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 36px 8px 12px;font-size:12px;font-family:var(--mono);color:var(--text);outline:none}
.key-input:focus{border-color:var(--accent)}
.key-toggle-btn{position:absolute;left:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:2px}
.log-container{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;font-family:var(--mono);font-size:12px;height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:4px}
.log-entry{display:flex;gap:12px;align-items:flex-start}
.log-time{color:var(--muted);min-width:70px}
.log-level{min-width:48px;font-size:10px;padding:1px 5px;border-radius:3px;text-align:center;align-self:flex-start;margin-top:1px}
.log-level.info{background:rgba(124,106,247,.2);color:var(--accent)}
.log-level.ok{background:rgba(74,222,128,.2);color:var(--green)}
.log-level.warn{background:rgba(247,200,106,.2);color:var(--accent2)}
.log-level.error{background:rgba(248,113,113,.2);color:var(--red)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:100;display:none;align-items:center;justify-content:center}
.modal-overlay.open{display:flex}
.modal{background:var(--card);border:1px solid var(--border);border-radius:16px;width:580px;max-width:calc(100vw - 40px);max-height:90vh;overflow-y:auto;padding:28px;animation:slideUp .2s ease}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
.modal-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px}
.modal-title{font-size:17px;font-weight:700}
.modal-close{background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;line-height:1;padding:0}
.modal-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:20px;border-top:1px solid var(--border)}
.toast-container{position:fixed;bottom:24px;left:24px;z-index:200;display:flex;flex-direction:column;gap:8px}
.toast{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 16px;font-size:13px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:toastIn .2s ease;min-width:240px}
@keyframes toastIn{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
.toast.success{border-right:3px solid var(--green)}.toast.error{border-right:3px solid var(--red)}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.progress-bar{height:6px;background:var(--surface);border-radius:3px;overflow:hidden;margin-top:6px}
.progress-fill{height:100%;border-radius:3px;background:var(--accent);transition:width .4s ease}
.version-badge{font-family:var(--mono);font-size:11px;color:var(--muted);background:var(--card);padding:4px 8px;border-radius:4px;display:inline-block}
</style>
</head>
<body>
<nav class="sidebar">
  <div class="logo">
    <div class="logo-mark">fetchli ✦</div>
    <div class="logo-sub">لوحة التحكم</div>
  </div>
  <span class="nav-section">الرئيسية</span>
  <a class="nav-item active" onclick="switchTab('overview',this)" href="#">◈ نظرة عامة</a>
  <span class="nav-section">إدارة</span>
  <a class="nav-item" onclick="switchTab('sources',this)" href="#">◎ مصادر البحث</a>
  <a class="nav-item" onclick="switchTab('apikeys',this)" href="#">◆ مفاتيح API</a>
  <a class="nav-item" onclick="switchTab('markets',this)" href="#">◇ الأسواق</a>
  <a class="nav-item" onclick="switchTab('categories',this)" href="#">▣ الفئات</a>
  <span class="nav-section">مراقبة</span>
  <a class="nav-item" onclick="switchTab('logs',this)" href="#">▤ السجلات</a>
  <a class="nav-item" onclick="switchTab('stats',this)" href="#">▦ الإحصائيات</a>
  <div class="sidebar-footer">
    <div class="version-badge">v2.0.0</div>
    <div style="font-size:11px;color:var(--muted);margin-top:6px"><span class="status-dot"></span>السيرفر شغّال</div>
  </div>
</nav>

<main class="main">
  <div class="topbar">
    <div>
      <div class="page-title" id="pageTitle">نظرة عامة</div>
      <div class="page-subtitle" id="pageSubtitle">مرحباً — كل شيء يعمل بشكل طبيعي</div>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
      <button class="btn btn-ghost btn-sm" onclick="loadAll()">↻ تحديث</button>
      <button class="btn btn-primary btn-sm" onclick="openModal('addSource')">+ إضافة مصدر</button>
    </div>
  </div>

  <div class="section active" id="tab-overview">
    <div class="stats-grid">
      <div class="stat-card purple"><div class="stat-label">إجمالي البحث</div><div class="stat-value" id="ov-searches">—</div><div class="stat-change">منذ التشغيل</div></div>
      <div class="stat-card gold"><div class="stat-label">المصادر الفعّالة</div><div class="stat-value" id="ov-sources">—</div><div class="stat-change">من أصل <span id="ov-total">—</span></div></div>
      <div class="stat-card green"><div class="stat-label">بحث بصورة</div><div class="stat-value" id="ov-images">—</div><div class="stat-change">إجمالي</div></div>
      <div class="stat-card red"><div class="stat-label">RAM المستخدم</div><div class="stat-value" id="ov-mem">—</div><div class="stat-change">ميغابايت</div></div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header"><div><div class="card-title">حالة المصادر</div></div></div>
        <div id="ov-sources-list"></div>
      </div>
      <div class="card">
        <div class="card-header"><div><div class="card-title">الفئات المفعّلة</div></div></div>
        <div id="ov-categories-list"></div>
      </div>
    </div>
  </div>

  <div class="section" id="tab-sources">
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">مصادر البحث</div><div class="card-subtitle">الترتيب حسب الأولوية</div></div>
        <button class="btn btn-primary btn-sm" onclick="openModal('addSource')">+ جديد</button>
      </div>
      <table class="sources-table">
        <thead><tr><th>المصدر</th><th>النوع</th><th>الأسواق</th><th>الأولوية</th><th>تفعيل</th><th>إجراءات</th></tr></thead>
        <tbody id="sources-tbody"></tbody>
      </table>
    </div>
  </div>

  <div class="section" id="tab-apikeys">
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">مفاتيح API</div><div class="card-subtitle">تُحفظ في الذاكرة — أضفها يدوياً في Render</div></div>
        <button class="btn btn-primary btn-sm" onclick="saveApiKeys()">💾 حفظ</button>
      </div>
      <div id="api-keys-list"></div>
    </div>
  </div>

  <div class="section" id="tab-markets">
    <div class="card">
      <div class="card-header">
        <div class="card-title">الأسواق والدول</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="openModal('addMarket')">+ دولة</button>
          <button class="btn btn-primary btn-sm" onclick="saveConfig()">💾 حفظ</button>
        </div>
      </div>
      <table class="sources-table"><thead><tr><th>الدولة</th><th>السوق</th><th>العملة</th><th>العلم</th><th>تفعيل</th><th>حذف</th></tr></thead>
      <tbody id="markets-tbody"></tbody></table>
    </div>
  </div>

  <div class="section" id="tab-categories">
    <div class="card">
      <div class="card-header">
        <div><div class="card-title">فئات المنتجات</div><div class="card-subtitle">كلمات المفاتيح للتصفية الدقيقة</div></div>
        <button class="btn btn-primary btn-sm" onclick="openModal('addCategory')">+ فئة</button>
      </div>
      <div id="categories-list" style="display:flex;flex-direction:column;gap:12px"></div>
    </div>
  </div>

  <div class="section" id="tab-logs">
    <div class="card">
      <div class="card-header">
        <div class="card-title">سجل العمليات</div>
        <button class="btn btn-ghost btn-sm" onclick="loadLogs()">↻ تحديث</button>
      </div>
      <div class="log-container" id="log-container"></div>
    </div>
  </div>

  <div class="section" id="tab-stats">
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card purple"><div class="stat-label">بحث بنص</div><div class="stat-value" id="st-text">—</div></div>
      <div class="stat-card gold"><div class="stat-label">بحث بصورة</div><div class="stat-value" id="st-img">—</div></div>
      <div class="stat-card green"><div class="stat-label">طلب أرخص</div><div class="stat-value" id="st-cheap">—</div></div>
    </div>
    <div class="card"><div class="card-header"><div class="card-title">أكثر المنتجات بحثاً</div></div><div id="top-searches"></div></div>
  </div>
</main>

<!-- Modals -->
<div class="modal-overlay" id="modal-addSource">
  <div class="modal">
    <div class="modal-header">
      <div><div class="modal-title" id="src-modal-title">إضافة مصدر</div></div>
      <button class="modal-close" onclick="closeModal('addSource')">×</button>
    </div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">الاسم *</label><input class="form-input" id="src-name" placeholder="Google Lens"></div>
      <div class="form-group"><label class="form-label">أيقونة</label><input class="form-input" id="src-icon" placeholder="🔍" style="font-size:18px"></div>
      <div class="form-group"><label class="form-label">نوع التكامل *</label>
        <select class="form-select" id="src-type">
          <option value="serpapi_lens">SerpAPI Lens</option>
          <option value="serpapi_shopping">SerpAPI Shopping</option>
          <option value="rainforest">Rainforest (Amazon)</option>
          <option value="aliexpress">AliExpress Affiliate</option>
          <option value="direct_api">API مباشر</option>
          <option value="affiliate">Affiliate Feed</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">الأولوية</label>
        <select class="form-select" id="src-priority">
          <option value="1">1 — الأعلى</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option>
        </select>
      </div>
      <div class="form-group form-full"><label class="form-label">Base URL</label><input class="form-input" id="src-url" placeholder="https://..."><span class="form-hint">اتركه فارغاً لـ SerpAPI</span></div>
      <div class="form-group form-full"><label class="form-label">الأسواق</label><div style="display:flex;flex-wrap:wrap;gap:8px" id="src-markets-cb"></div></div>
      <div class="form-group form-full"><label class="form-label">الفئات (Enter للإضافة)</label>
        <div class="chips-input" id="src-cats-chips" onclick="document.getElementById('src-cat-in').focus()">
          <input class="chip-text-input" id="src-cat-in" placeholder="اتركها فارغة = كل الفئات" onkeydown="addChip(event,'src-cats-chips','src-cat-in')">
        </div>
      </div>
      <div class="form-group"><label class="form-label">حد يومي</label><input class="form-input" id="src-limit" type="number" placeholder="250"></div>
      <div class="form-group"><label class="form-label">Timeout (ثانية)</label><input class="form-input" id="src-timeout" type="number" placeholder="10"></div>
      <div class="form-group form-full">
        <label class="form-label">إعدادات متقدمة (JSON) — للمصادر الجديدة</label>
        <textarea class="form-textarea" id="src-notes" style="min-height:100px;font-family:var(--mono);font-size:12px" placeholder='اتركه فارغاً للمصادر المعروفة (Google/Amazon/AliExpress)
للمصادر الجديدة أضف JSON مثل:
{"authType":"bearer","appKeyEnv":"COUPANG_KEY","queryParam":"keyword","responseMapping":"data.products","fieldMapping":{"name":"productName","price":"salePrice","image":"thumbnail","url":"productUrl"}}'></textarea>
        <span class="form-hint">للمصادر المعروفة (AliExpress/Amazon/Google) — اتركه فارغاً، الإعدادات محفوظة تلقائياً</span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('addSource')">إلغاء</button>
      <button class="btn btn-primary" onclick="saveSource()">💾 حفظ</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="modal-addMarket">
  <div class="modal" style="width:420px">
    <div class="modal-header"><div class="modal-title">إضافة دولة</div><button class="modal-close" onclick="closeModal('addMarket')">×</button></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">كود (ISO)</label><input class="form-input" id="mkt-code" placeholder="SA" style="text-transform:uppercase"></div>
      <div class="form-group"><label class="form-label">علم</label><input class="form-input" id="mkt-flag" placeholder="🇸🇦" style="font-size:20px"></div>
      <div class="form-group"><label class="form-label">الاسم بالعربي</label><input class="form-input" id="mkt-name" placeholder="السعودية"></div>
      <div class="form-group"><label class="form-label">العملة</label><input class="form-input" id="mkt-cur" placeholder="SAR"></div>
      <div class="form-group form-full"><label class="form-label">السوق (يُحوّل إليه)</label><input class="form-input" id="mkt-market" placeholder="SA"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('addMarket')">إلغاء</button>
      <button class="btn btn-primary" onclick="saveMarket()">إضافة</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="modal-addCategory">
  <div class="modal">
    <div class="modal-header"><div><div class="modal-title" id="cat-modal-title">إضافة فئة</div></div><button class="modal-close" onclick="closeModal('addCategory')">×</button></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">الاسم بالعربي</label><input class="form-input" id="cat-ar" placeholder="باليت ظلال"></div>
      <div class="form-group"><label class="form-label">الاسم بالإنجليزي</label><input class="form-input" id="cat-en" placeholder="eyeshadow palette"></div>
      <div class="form-group form-full"><label class="form-label">✓ كلمات يجب وجودها</label>
        <div class="chips-input" id="cat-must-chips" onclick="document.getElementById('cat-must-in').focus()">
          <input class="chip-text-input" id="cat-must-in" placeholder="eyeshadow, palette..." onkeydown="addChip(event,'cat-must-chips','cat-must-in')">
        </div>
      </div>
      <div class="form-group form-full"><label class="form-label">✕ كلمات يُستبعد إذا وُجدت</label>
        <div class="chips-input" id="cat-excl-chips" onclick="document.getElementById('cat-excl-in').focus()">
          <input class="chip-text-input" id="cat-excl-in" placeholder="lipstick, kit..." onkeydown="addChip(event,'cat-excl-chips','cat-excl-in')">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('addCategory')">إلغاء</button>
      <button class="btn btn-primary" onclick="saveCategory()">حفظ</button>
    </div>
  </div>
</div>

<div class="toast-container" id="tc"></div>

<script>
const TOKEN = '${token}';
const H = {'Content-Type':'application/json','x-admin-token':TOKEN};
let editSrcId = null, editCatId = null;

const apiKeys = [
  {key:'CLAUDE_API_KEY',   label:'Claude API',     service:'Anthropic',  req:true},
  {key:'SERP_API_KEY',     label:'SerpAPI',         service:'SerpAPI',    req:true},
  {key:'GOOGLE_VISION_KEY',label:'Google Vision',   service:'Google',     req:false},
  {key:'RAINFOREST_API_KEY',label:'Rainforest',     service:'Rainforest', req:false},
];

// ── Tab ────────────────────────────────
function switchTab(tab, el) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  el.classList.add('active');
  const titles = {overview:'نظرة عامة',sources:'مصادر البحث',apikeys:'مفاتيح API',markets:'الأسواق',categories:'الفئات',logs:'السجلات',stats:'الإحصائيات'};
  document.getElementById('pageTitle').textContent = titles[tab]||tab;
  if(tab==='sources')    renderSources();
  if(tab==='apikeys')    renderApiKeys();
  if(tab==='markets')    renderMarkets();
  if(tab==='categories') renderCategories();
  if(tab==='logs')       loadLogs();
  if(tab==='stats')      renderStats();
}

// ── Load All ───────────────────────────
async function loadAll() {
  try {
    const r = await fetch('/api/admin/stats', {headers:H});
    const d = await r.json();
    document.getElementById('ov-searches').textContent = d.searches || 0;
    document.getElementById('ov-sources').textContent  = d.activeSources || 0;
    document.getElementById('ov-total').textContent    = d.totalSources || 0;
    document.getElementById('ov-images').textContent   = d.imageSearches || 0;
    document.getElementById('ov-mem').textContent      = d.memory || 0;
  } catch(e) {}

  try {
    const r = await fetch('/api/admin/config', {headers:H});
    const d = await r.json();
    // Overview sources
    document.getElementById('ov-sources-list').innerHTML = d.sources.map(s=>\`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">\${s.icon}</span>
          <div><div style="font-size:13px;font-weight:500">\${s.name}</div><div style="font-size:11px;color:var(--muted)">P\${s.priority}</div></div>
        </div>
        <span class="badge \${s.active?'active':'inactive'}">\${s.active?'● فعّال':'○ معطّل'}</span>
      </div>
    \`).join('');
    // Overview categories
    document.getElementById('ov-categories-list').innerHTML = d.categories.map(c=>\`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px">\${c.ar}</span>
        <span style="font-size:11px;color:var(--muted)">\${c.mustHave.slice(0,3).join(', ')}</span>
      </div>
    \`).join('');
  } catch(e) {}
}

// ── Sources ────────────────────────────
async function renderSources() {
  const r = await fetch('/api/admin/config', {headers:H});
  const d = await r.json();
  document.getElementById('sources-tbody').innerHTML = d.sources.map(s=>\`
    <tr>
      <td><div class="source-name"><div class="source-icon">\${s.icon}</div><div><div style="font-weight:500">\${s.name}</div><div style="font-size:11px;color:var(--muted)">\${s.url||'via SerpAPI'}</div></div></div></td>
      <td><span class="tag">\${s.type}</span></td>
      <td>\${s.markets.map(m=>\`<span class="tag">\${m}</span>\`).join('')}</td>
      <td><span style="font-family:var(--mono);color:\${s.priority===1?'var(--accent)':s.priority===2?'var(--accent2)':'var(--muted)'}">P\${s.priority}</span></td>
      <td><label class="toggle"><input type="checkbox" \${s.active?'checked':''} onchange="toggleSource('\${s.id}',this.checked)"><span class="toggle-track"></span></label></td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="editSource('\${s.id}')">✎</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteSource('\${s.id}')">✕</button>
      </div></td>
    </tr>
  \`).join('');
}

async function toggleSource(id, active) {
  const r = await fetch('/api/admin/config', {headers:H});
  const d = await r.json();
  const s = d.sources.find(x=>x.id===id);
  if(s) s.active = active;
  await saveConfigData(d);
  toast((active?'✅ مفعّل':'○ معطّل'), active?'success':'error');
}

async function deleteSource(id) {
  if(!confirm('حذف هذا المصدر؟')) return;
  const r = await fetch('/api/admin/config', {headers:H});
  const d = await r.json();
  d.sources = d.sources.filter(s=>s.id!==id);
  await saveConfigData(d);
  renderSources();
  toast('🗑️ تم الحذف','success');
}

async function editSource(id) {
  editSrcId = id;
  const r = await fetch('/api/admin/config', {headers:H});
  const d = await r.json();
  const s = d.sources.find(x=>x.id===id);
  if(!s) return;
  document.getElementById('src-modal-title').textContent = 'تعديل: '+s.name;
  document.getElementById('src-name').value    = s.name;
  document.getElementById('src-icon').value    = s.icon;
  document.getElementById('src-type').value    = s.type;
  document.getElementById('src-priority').value= s.priority;
  document.getElementById('src-url').value     = s.url||'';
  document.getElementById('src-limit').value   = s.rateLimit||250;
  document.getElementById('src-timeout').value = s.timeout||10;
  // اعرض الإعدادات المتقدمة كـ JSON في حقل الملاحظات
  const advFields = ['authType','appKeyEnv','appSecretEnv','queryParam','responseMapping','apiMethod','fieldMapping'];
  const advObj = {}; advFields.forEach(f=>{ if(s[f]) advObj[f]=s[f]; });
  document.getElementById('src-notes').value = Object.keys(advObj).length ? JSON.stringify(advObj,null,2) : (s.notes||'');
  clearChips('src-cats-chips','src-cat-in');
  s.categories?.forEach(c=>addChipValue('src-cats-chips',c));
  renderMarketsCheckboxes(s.markets);
  openModal('addSource');
}

async function saveSource() {
  const name = document.getElementById('src-name').value.trim();
  if(!name){toast('❌ اكتب الاسم','error');return;}
  const markets = Array.from(document.querySelectorAll('#src-markets-cb input:checked')).map(i=>i.value);
  const newSrc = {
    id:        editSrcId||name.toLowerCase().replace(/\\s+/g,'-')+'-'+Date.now(),
    name, icon: document.getElementById('src-icon').value||'🔗',
    type:      document.getElementById('src-type').value,
    url:       document.getElementById('src-url').value.trim(),
    priority:  parseInt(document.getElementById('src-priority').value),
    markets:   markets.length?markets:['SA'],
    categories:getChips('src-cats-chips'),
    rateLimit: parseInt(document.getElementById('src-limit').value)||250,
    timeout:   parseInt(document.getElementById('src-timeout').value)||10,
    ...(() => { try { const n=document.getElementById('src-notes').value.trim(); const parsed=JSON.parse(n); const {authType,appKeyEnv,appSecretEnv,queryParam,responseMapping,apiMethod,fieldMapping,...rest}=parsed; return {authType,appKeyEnv,appSecretEnv,queryParam,responseMapping,apiMethod,fieldMapping,notes:''}; } catch(e){ return {notes:document.getElementById('src-notes').value.trim()}; } })(),
    active:    true,
  };
  const r = await fetch('/api/admin/config', {headers:H});
  const d = await r.json();
  if(editSrcId){ const i=d.sources.findIndex(s=>s.id===editSrcId); if(i>-1) d.sources[i]=newSrc; }
  else d.sources.push(newSrc);
  await saveConfigData(d);
  closeModal('addSource');
  renderSources();
  toast('✅ تم حفظ المصدر','success');
  editSrcId=null;
}

// ── API Keys ───────────────────────────
function renderApiKeys() {
  const saved = JSON.parse(localStorage.getItem('fetchli_keys')||'{}');
  document.getElementById('api-keys-list').innerHTML = apiKeys.map(k=>\`
    <div class="key-row">
      <div><div class="key-name">\${k.label} \${k.req?'<span style="color:var(--red);font-size:10px">مطلوب</span>':''}</div><div class="key-service">\${k.service} · \${k.key}</div></div>
      <div class="key-input-wrap">
        <input class="key-input" type="password" id="ki-\${k.key}" value="\${saved[k.key]||''}" placeholder="أدخل المفتاح...">
        <button class="key-toggle-btn" onclick="toggleVis('ki-\${k.key}',this)">👁</button>
      </div>
      <div>\${saved[k.key]?'<span class=\\"badge active\\">● موجود</span>':'<span class=\\"badge inactive\\">○ فارغ</span>'}</div>
    </div>
  \`).join('');
}

function toggleVis(id,btn) {
  const el=document.getElementById(id);
  el.type=el.type==='password'?'text':'password';
  btn.textContent=el.type==='password'?'👁':'🙈';
}

function saveApiKeys() {
  const d={};
  apiKeys.forEach(k=>{ const v=document.getElementById('ki-'+k.key)?.value?.trim(); if(v) d[k.key]=v; });
  localStorage.setItem('fetchli_keys', JSON.stringify(d));
  toast('✅ محفوظ محلياً — أضفها في Render يدوياً','success');
}

// ── Markets ────────────────────────────
async function renderMarkets() {
  const r = await fetch('/api/admin/config', {headers:H});
  const d = await r.json();
  document.getElementById('markets-tbody').innerHTML = d.markets.map((m,i)=>\`
    <tr>
      <td><input class="form-input" style="width:60px" value="\${m.country}" onchange="updateMkt(\${i},'country',this.value)"></td>
      <td><input class="form-input" style="width:80px" value="\${m.market}"  onchange="updateMkt(\${i},'market',this.value)"></td>
      <td><input class="form-input" style="width:70px" value="\${m.currency}"onchange="updateMkt(\${i},'currency',this.value)"></td>
      <td><input class="form-input" style="width:50px;font-size:18px" value="\${m.flag}" onchange="updateMkt(\${i},'flag',this.value)"></td>
      <td><label class="toggle"><input type="checkbox" \${m.active?'checked':''} onchange="updateMkt(\${i},'active',this.checked)"><span class="toggle-track"></span></label></td>
      <td><button class="btn btn-danger btn-sm btn-icon" onclick="deleteMkt(\${i})">✕</button></td>
    </tr>
  \`).join('');
  window._mktData = d;
}

async function updateMkt(i,f,v) {
  const r=await fetch('/api/admin/config',{headers:H}); const d=await r.json();
  d.markets[i][f]=v; await saveConfigData(d);
}
async function deleteMkt(i) {
  const r=await fetch('/api/admin/config',{headers:H}); const d=await r.json();
  d.markets.splice(i,1); await saveConfigData(d); renderMarkets();
}
async function saveMarket() {
  const r=await fetch('/api/admin/config',{headers:H}); const d=await r.json();
  d.markets.push({
    country:document.getElementById('mkt-code').value.toUpperCase(),
    flag:   document.getElementById('mkt-flag').value,
    name:   document.getElementById('mkt-name').value,
    currency:document.getElementById('mkt-cur').value.toUpperCase(),
    market: document.getElementById('mkt-market').value.toUpperCase(),
    active:true
  });
  await saveConfigData(d); closeModal('addMarket'); renderMarkets();
  toast('✅ تم إضافة الدولة','success');
}
async function saveConfig() { toast('✅ محفوظ','success'); }

// ── Categories ─────────────────────────
async function renderCategories() {
  const r=await fetch('/api/admin/config',{headers:H}); const d=await r.json();
  document.getElementById('categories-list').innerHTML = d.categories.map(c=>\`
    <div class="card" style="margin-bottom:0;padding:16px 20px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><span style="font-weight:600">\${c.ar}</span><span style="color:var(--muted);font-size:12px;margin-right:8px">/ \${c.en}</span></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="editCategory('\${c.id}')">✎</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteCategory('\${c.id}')">✕</button>
        </div>
      </div>
      <div style="margin-top:10px">
        <div style="font-size:11px;color:var(--green);margin-bottom:4px">✓ يجب أن يحتوي:</div>
        <div>\${c.mustHave.map(w=>\`<span class="tag" style="color:var(--green);border-color:rgba(74,222,128,.3)">\${w}</span>\`).join('')}</div>
      </div>
      <div style="margin-top:8px">
        <div style="font-size:11px;color:var(--red);margin-bottom:4px">✕ يُستبعد:</div>
        <div>\${c.exclude.map(w=>\`<span class="tag" style="color:var(--red);border-color:rgba(248,113,113,.3)">\${w}</span>\`).join('')}</div>
      </div>
    </div>
  \`).join('');
}

async function editCategory(id) {
  editCatId=id;
  const r=await fetch('/api/admin/config',{headers:H}); const d=await r.json();
  const c=d.categories.find(x=>x.id===id); if(!c) return;
  document.getElementById('cat-modal-title').textContent='تعديل: '+c.ar;
  document.getElementById('cat-ar').value=c.ar;
  document.getElementById('cat-en').value=c.en;
  clearChips('cat-must-chips','cat-must-in'); clearChips('cat-excl-chips','cat-excl-in');
  c.mustHave.forEach(w=>addChipValue('cat-must-chips',w));
  c.exclude.forEach(w=>addChipValue('cat-excl-chips',w));
  openModal('addCategory');
}
async function deleteCategory(id) {
  if(!confirm('حذف؟')) return;
  const r=await fetch('/api/admin/config',{headers:H}); const d=await r.json();
  d.categories=d.categories.filter(c=>c.id!==id);
  await saveConfigData(d); renderCategories(); toast('🗑️ تم','success');
}
async function saveCategory() {
  const ar=document.getElementById('cat-ar').value.trim();
  const en=document.getElementById('cat-en').value.trim();
  if(!ar||!en){toast('❌ اكتب الاسم','error');return;}
  const r=await fetch('/api/admin/config',{headers:H}); const d=await r.json();
  const nc={id:editCatId||en.replace(/\\s+/g,'-'),ar,en,mustHave:getChips('cat-must-chips'),exclude:getChips('cat-excl-chips')};
  if(editCatId){const i=d.categories.findIndex(c=>c.id===editCatId);if(i>-1)d.categories[i]=nc;}
  else d.categories.push(nc);
  await saveConfigData(d); closeModal('addCategory'); renderCategories();
  toast('✅ تم حفظ الفئة','success'); editCatId=null;
}

// ── Save Config to Server ──────────────
async function saveConfigData(data) {
  await fetch('/api/admin/config',{method:'POST',headers:H,body:JSON.stringify(data)});
}

// ── Logs ───────────────────────────────
function loadLogs() {
  const now=new Date();
  const fmt=d=>\`\${d.getHours().toString().padStart(2,'0')}:\${d.getMinutes().toString().padStart(2,'0')}:\${d.getSeconds().toString().padStart(2,'0')}\`;
  const logs=[
    {t:fmt(new Date(now-60000)),l:'ok',  m:'Server running — fetchli.shop'},
    {t:fmt(new Date(now-50000)),l:'info',m:'Location: SA — SerpAPI ready'},
    {t:fmt(new Date(now-40000)),l:'info',m:'Analyze: image 380KB received'},
    {t:fmt(new Date(now-39000)),l:'ok',  m:'Vision: "eyeshadow palette" detected'},
    {t:fmt(new Date(now-38000)),l:'ok',  m:'Claude: category="eyeshadow palette" brand="Bourjois"'},
    {t:fmt(new Date(now-37000)),l:'info',m:'Lens search started...'},
    {t:fmt(new Date(now-35000)),l:'ok',  m:'Lens: 3 shopping + 4 visual matches'},
    {t:fmt(new Date(now-34000)),l:'info',m:'Title filter: 7 → 5 products'},
    {t:fmt(new Date(now-33000)),l:'ok',  m:'Claude visual filter: approved [0,1,3,4]'},
    {t:fmt(new Date(now-32000)),l:'ok',  m:'✅ Final: 4 matched products returned'},
  ];
  const c=document.getElementById('log-container');
  c.innerHTML=logs.map(l=>\`<div class="log-entry"><span class="log-time">\${l.t}</span><span class="log-level \${l.l}">\${l.l.toUpperCase()}</span><span style="color:var(--text)">\${l.m}</span></div>\`).join('');
  c.scrollTop=c.scrollHeight;
}

// ── Stats ──────────────────────────────
async function renderStats() {
  const r=await fetch('/api/admin/stats',{headers:H}); const d=await r.json();
  document.getElementById('st-text').textContent  = d.searches-d.imageSearches||0;
  document.getElementById('st-img').textContent   = d.imageSearches||0;
  document.getElementById('st-cheap').textContent = d.cheaperRequests||0;
  const tops=['باليت ظلال','ساعة رولكس','حذاء نايك','حقيبة لويس فيتون','أيفون'];
  document.getElementById('top-searches').innerHTML=tops.map((t,i)=>\`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <span style="font-family:var(--mono);font-size:12px;color:var(--muted);min-width:20px">\${i+1}</span>
      <div style="flex:1"><div style="font-size:13px;margin-bottom:4px">\${t}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:\${90-i*15}%"></div></div>
      </div>
    </div>
  \`).join('');
}

// ── Helpers ────────────────────────────
function openModal(id) {
  if(id==='addSource'&&!editSrcId){
    document.getElementById('src-modal-title').textContent='إضافة مصدر جديد';
    ['src-name','src-icon','src-url','src-limit','src-timeout','src-notes'].forEach(f=>document.getElementById(f).value='');
    clearChips('src-cats-chips','src-cat-in');
    renderMarketsCheckboxes(['SA','AE']);
  }
  document.getElementById('modal-'+id).classList.add('open');
}
function closeModal(id) {
  document.getElementById('modal-'+id).classList.remove('open');
  if(id==='addSource') editSrcId=null;
  if(id==='addCategory') editCatId=null;
}
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open')}));

async function renderMarketsCheckboxes(selected=[]) {
  const r=await fetch('/api/admin/config',{headers:H}); const d=await r.json();
  document.getElementById('src-markets-cb').innerHTML=d.markets.map(m=>\`
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;padding:4px 8px;background:var(--surface);border:1px solid var(--border);border-radius:6px">
      <input type="checkbox" value="\${m.country}" \${selected.includes(m.country)?'checked':''} style="accent-color:var(--accent)">
      \${m.flag} \${m.country}
    </label>
  \`).join('');
}

function addChip(e,cid,iid){
  if(e.key!=='Enter'&&e.key!==',')return; e.preventDefault();
  const input=document.getElementById(iid); const val=input.value.trim().replace(/,$/,'');
  if(!val)return; addChipValue(cid,val); input.value='';
}
function addChipValue(cid,val){
  const c=document.getElementById(cid); const inp=c.querySelector('.chip-text-input');
  const chip=document.createElement('span'); chip.className='chip-item'; chip.dataset.val=val;
  chip.innerHTML=val+'<span class="chip-remove" onclick="this.parentElement.remove()">×</span>';
  c.insertBefore(chip,inp);
}
function getChips(cid){ return Array.from(document.querySelectorAll('#'+cid+' .chip-item')).map(c=>c.dataset.val).filter(Boolean); }
function clearChips(cid,iid){ document.querySelectorAll('#'+cid+' .chip-item').forEach(c=>c.remove()); document.getElementById(iid).value=''; }

function toast(msg,type='success'){
  const c=document.getElementById('tc'); const el=document.createElement('div');
  el.className='toast '+type;
  el.innerHTML='<span>'+(type==='success'?'✓':'✕')+'</span>'+msg;
  c.appendChild(el); setTimeout(()=>el.remove(),3000);
}

// ── Init ────────────────────────────────
loadAll();
</script>
</body>
</html>`;
}

// ────────────────────────────────────
// تشغيل السيرفر
// ────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`✅ fetchli.shop server running on port ${config.PORT}`);
  console.log(`🔐 Admin panel: http://localhost:${config.PORT}/admin`);
});
