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

  content.push({
    type: 'text',
    text: `You are an expert product identification AI.

${imageBase64 ? 'ANALYZE THE IMAGE with extreme precision. Identify EXACT product category, brand, model, visual attributes.' : ''}
${visionContext}
${message ? `User message: "${message}"` : ''}
${cheaperNote}

CATEGORY IDENTIFICATION RULES (be exact):
- Eye shadow palette/pan → category: "eyeshadow palette"
- Lipstick/lip gloss → category: "lipstick"
- Foundation/BB cream → category: "foundation"
- Blush/bronzer → category: "blush"
- Watch/timepiece → category: "watch"
- Handbag/purse/tote → category: "handbag"
- Sneakers/shoes → category: "sneakers"
- Smartphone → category: "smartphone"

SEARCH QUERY CONSTRUCTION (5 queries, all must be same category):
Q1 [Ultra specific]: brand + exact product name + color + key feature
   Example: "Bourjois Paris little round pot eyeshadow palette nude"
Q2 [Brand + type]: brand + category + finish/style
   Example: "Bourjois eyeshadow palette shimmer matte"
Q3 [Features only]: category + colors + finish + style
   Example: "eyeshadow palette brown nude tones shimmer matte"
Q4 [Buy intent]: "buy " + brand + category OR if cheaper: "affordable " + category + " dupe"
Q5 [Broad]: category + main color + finish

ALL 5 QUERIES must match the SAME product category. Never mix.

Extract from image:
- Exact brand (read any visible text/logo)
- Product line/model name if visible
- Color palette / shade names
- Finish: matte/shimmer/glitter/satin/mixed
- Packaging details

JSON only (no markdown):
{
  "productType": "نوع المنتج بالعربي الدقيق",
  "category": "exact English category",
  "brand": "brand name or null",
  "model": "model/line name or null",
  "color": "color description",
  "finish": "matte/shimmer/mixed/etc",
  "details": "key visual features",
  "searchQueries": ["q1","q2","q3","q4","q5"],
  "reply": "رد ودي قصير بالعربي يصف المنتج بدقة",
  "confidence": 95
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
    'eyeshadow': { ar: 'باليت ظلال', en: 'eyeshadow palette' },
    'palette':   { ar: 'باليت', en: 'palette' },
    'lipstick':  { ar: 'أحمر شفاه', en: 'lipstick' },
    'makeup':    { ar: 'مكياج', en: 'makeup' },
    'watch':     { ar: 'ساعة', en: 'watch' },
    'bag':       { ar: 'حقيبة', en: 'handbag' },
    'handbag':   { ar: 'حقيبة', en: 'handbag' },
    'shoe':      { ar: 'حذاء', en: 'sneakers' },
    'phone':     { ar: 'جوال', en: 'smartphone' },
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

    let visionData = null;
    if (imageBase64) {
      visionData = await analyzeWithGoogleVision(imageBase64);
      console.log('Vision:', visionData?.bestGuess, '| Logos:', visionData?.logos);
    }

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

REJECTION RULES (non-negotiable):
- Image = eyeshadow palette → REJECT: lipstick, foundation, mascara, skincare, makeup kits, eyeliner, bronzer, any bundle/set
- Image = lipstick → REJECT: eyeshadow, foundation, mascara, skincare
- Image = watch → REJECT: bags, shoes, jewelry, sunglasses
- Image = handbag → REJECT: watches, shoes, clothing
- Image = sneakers → REJECT: bags, watches, clothing

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

    if (!parsed.approved?.length) return products;
    const filtered = parsed.approved.map(i => products[i]).filter(Boolean);
    return filtered.length >= 2 ? filtered : products;
  } catch (err) {
    console.error('Claude visual filter error:', err.message);
    return products;
  }
}

// ────────────────────────────────────
// 5. البحث الرئيسي (محسّن)
// Pipeline: Lens → Shopping → Title Filter → Claude Visual Filter
// ────────────────────────────────────
app.post('/api/search', async (req, res) => {
  try {
    const { queries, query, market = 'SA', wantCheaper = false, imageBase64, analysis } = req.body;
    const searchTerms = queries || [query];

    if (!searchTerms?.length || searchTerms.every(q => !q?.trim())) {
      return res.json({ products: getMockProducts('products', market, false, 0), mock: true });
    }

    let allProducts  = [];
    let lensProducts = [];

    // ── المرحلة ١: Google Lens (الأدق بصرياً) ──
    if (imageBase64) {
      const lensResult = await searchWithGoogleLens(imageBase64, market);
      if (lensResult?.products?.length) {
        lensProducts = lensResult.products;
        if (lensResult.productInfo) {
          console.log('Lens product:', lensResult.productInfo.name);
        }
      }
    }

    // ── المرحلة ٢: Google Shopping بكلمات Claude الدقيقة ──
    const validTerms = searchTerms.filter(q => q?.trim().length > 0);
    for (const q of validTerms.slice(0, 3)) {
      const results = await searchWithGoogleShopping(
        wantCheaper ? `${q} budget affordable` : q,
        market
      );
      if (results?.length) allProducts.push(...results);
    }

    // ── دمج: Lens أولاً ثم Shopping ──
    const combined = [...lensProducts, ...allProducts];

    if (!combined.length) {
      return res.json({ products: getMockProducts(searchTerms[0], market, wantCheaper, 0), mock: true });
    }

    // ── المرحلة ٣: فلتر العنوان (سريع) ──
    let filtered = titleFilter(combined, analysis);

    // ── المرحلة ٤: Claude Visual Filter (الأقوى) ──
    if (imageBase64 && analysis && filtered.length > 2) {
      filtered = await claudeVisualFilter(filtered, analysis, imageBase64);
    }

    // ── ترتيب وتنظيف ──
    const unique = deduplicateProducts(filtered);
    const sorted = wantCheaper
      ? unique.sort((a, b) => extractPrice(a.price) - extractPrice(b.price))
      : unique.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    console.log(`✅ Final result: ${sorted.length} matched products`);
    res.json({ products: sorted.slice(0, 6), mock: false, source: 'lens+shopping+claude_filter' });

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

// ────────────────────────────────────
// تشغيل السيرفر
// ────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`✅ fetchli.shop server running on port ${config.PORT}`);
});
