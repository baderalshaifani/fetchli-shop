// ===================================
// fetchli.shop — الباك اند
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
// 2. Google Vision — تحليل بصري أولي
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
              { type: 'LABEL_DETECTION',      maxResults: 15 },
              { type: 'LOGO_DETECTION',        maxResults: 5  },
              { type: 'OBJECT_LOCALIZATION',   maxResults: 10 },
              { type: 'IMAGE_PROPERTIES',      maxResults: 5  },
              { type: 'WEB_DETECTION',         maxResults: 10 },
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
    const colors      = result.imagePropertiesAnnotation?.dominantColors?.colors
      ?.slice(0, 3)
      ?.map(c => {
        const r = Math.round(c.color.red   || 0);
        const g = Math.round(c.color.green || 0);
        const b = Math.round(c.color.blue  || 0);
        return rgbToColorName(r, g, b);
      }) || [];

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
// 3. Claude — تحليل عميق + توليد كلمات بحث
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
بيانات من Google Vision API:
- الماركات: ${visionData.logos.join(', ') || 'لا يوجد'}
- الكائنات: ${visionData.objects.join(', ') || 'لا يوجد'}
- التسميات: ${visionData.labels.slice(0, 8).join(', ') || 'لا يوجد'}
- الكيانات: ${visionData.webEntities.slice(0, 5).join(', ') || 'لا يوجد'}
- أفضل تخمين: ${visionData.bestGuess || 'لا يوجد'}
- الألوان: ${visionData.colors.join(', ') || 'لا يوجد'}
` : '';

  const cheaperNote = wantCheaper
    ? 'المستخدم يريد بدائل أرخص — ركز على: alternative, dupe, budget, affordable, similar'
    : '';

  content.push({
    type: 'text',
    
    text: `You are a world-class Amazon product search specialist with expert knowledge of product models, SKUs, and specifications.

${imageBase64 ? `CRITICAL IMAGE ANALYSIS INSTRUCTIONS:
1. Read ANY visible text, numbers, logos, or model codes on the product
2. Identify the EXACT model name/number (e.g. "Submariner 116610LN" not just "Rolex watch")
3. Note precise color names (e.g. "rhodium dial" not just "silver")
4. Identify exact material (e.g. "904L stainless steel" not just "metal")
5. Spot any unique design details (bezel type, strap pattern, clasp style)` : ''}

${visionContext}
${message ? `User request: "${message}"` : ''}
${cheaperNote}

SEARCH QUERY RULES — each query must be highly specific for Amazon:
- Query 1: Brand + EXACT model number/name + color + material (most specific)
- Query 2: Brand + product type + key visual features (no generic words)
- Query 3: ${wantCheaper ? 'dupe alternative similar budget + product type' : 'product type + all distinctive details'}
- Query 4: ${wantCheaper ? 'affordable similar style cheap version' : 'exact model or close variant'}
- Query 5: Broader fallback with brand + category only

BAD query example: "rolex watch silver"
GOOD query example: "Rolex Submariner 116610LN 40mm black ceramic bezel stainless steel"

Respond ONLY with valid JSON:
{
  "productType": "نوع المنتج بالعربي",
  "brand": "brand name or null",
  "color": "main color",
  "material": "material/texture",
  "details": "distinctive features",
  "searchQueries": ["query1","query2","query3","query4","query5"],
  "reply": "رد ودي قصير بالعربي",
  "confidence": 92
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
      max_tokens: 1000,
      system:     'You are a product analysis API. Respond with valid JSON only. No markdown, no code blocks.',
      messages:   [
        { role: 'user',      content },
        { role: 'assistant', content: [{ type: 'text', text: '{' }] },
      ],
    }),
  });

  const data  = await response.json();
  const raw   = data.content?.[0]?.text || '""';
  const text  = raw.startsWith('{') ? raw : '{' + raw;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response');
  return JSON.parse(jsonMatch[0]);
}

// ────────────────────────────────────
// Fallback — بناء البحث من Vision
// ────────────────────────────────────
function buildFallbackFromVision(visionData, message, wantCheaper) {
  if (!visionData) {
    return {
      productType: message || 'منتج',
      brand: null,
      color: '',
      searchQueries: [message || 'product'],
      reply: 'جاري البحث...',
      confidence: 60,
    };
  }

  const brand   = visionData.logos?.[0] || null;
  const guess   = visionData.bestGuess  || '';
  const objects = visionData.objects?.join(' ') || '';
  const color   = visionData.colors?.[0] || '';

  const productMap = {
    'watch': 'ساعة', 'clock': 'ساعة',
    'bag': 'حقيبة', 'handbag': 'حقيبة', 'purse': 'حقيبة',
    'shoe': 'حذاء', 'sneaker': 'حذاء',
    'shirt': 'قميص', 'dress': 'فستان', 'jacket': 'جاكيت',
    'phone': 'جوال', 'laptop': 'لابتوب', 'headphone': 'سماعة',
  };

  let productType = 'منتج';
  const allText = (guess + ' ' + objects).toLowerCase();
  for (const [en, ar] of Object.entries(productMap)) {
    if (allText.includes(en)) { productType = ar; break; }
  }

  const cheaper = wantCheaper ? 'budget affordable' : '';
  const q1 = [brand, guess, color].filter(Boolean).join(' ').trim() || message || 'product';
  const q2 = [guess, color].filter(Boolean).join(' ').trim() || q1;
  const q3 = cheaper ? `${q1} ${cheaper}` : `${guess} buy online`;
  const q4 = [brand, guess].filter(Boolean).join(' ');
  const q5 = message || brand || guess || 'product';

  return {
    productType, brand, color, details: objects,
    searchQueries: [q1, q2, q3, q4, q5].filter(q => q?.trim().length > 1),
    reply: `وجدت ${productType}${brand ? ' من ' + brand : ''} — جاري البحث`,
    confidence: 82,
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
      console.log('Vision:', visionData?.bestGuess, visionData?.logos);
    }

    let analyzed = null;
    try {
      analyzed = await analyzeWithClaude(message, imageBase64, visionData, wantCheaper);
    } catch (e) {
      console.error('Claude failed:', e.message);
    }

    if (!analyzed || !analyzed.searchQueries?.length) {
      analyzed = buildFallbackFromVision(visionData, message, wantCheaper);
    }

    if (visionData?.logos?.length > 0 && analyzed.brand) {
      analyzed.confidence = Math.min(98, (analyzed.confidence || 85) + 5);
    }

    res.json({ ...analyzed, visionData });
  } catch (err) {
    console.error('Analyze error:', err);
    res.json({ searchQueries: [req.body.message || 'product'], reply: 'جاري البحث...', confidence: 60 });
  }
});

// ────────────────────────────────────
// Rainforest API — بحث مباشر في Amazon
// ────────────────────────────────────

// خريطة السوق → Amazon domain
const AMAZON_DOMAINS = {
  SA: 'amazon.sa',
  AE: 'amazon.ae',
  EG: 'amazon.eg',
  US: 'amazon.com',
  CA: 'amazon.ca',
  KW: 'amazon.sa',
  QA: 'amazon.sa',
};

// خريطة العملات
const CURRENCIES = {
  SA: 'ر.س', AE: 'د.إ', EG: 'ج.م', US: '$', CA: 'C$',
};

async function searchWithRainforest(query, market = 'SA', wantCheaper = false) {
  try {
    const API_KEY = process.env.RAINFOREST_API_KEY;
    if (!API_KEY) {
      console.log('Rainforest: no API key');
      return null;
    }

    if (!query || query.trim() === '') return null;

    const domain   = AMAZON_DOMAINS[market] || 'amazon.sa';
    const currency = CURRENCIES[market]     || 'ر.س';

    const searchQuery = wantCheaper ? `${query} budget` : query;

    const url = `https://api.rainforestapi.com/request?api_key=${API_KEY}&type=search&amazon_domain=${domain}&search_term=${encodeURIComponent(searchQuery)}&sort_by=${wantCheaper ? 'price_low_to_high' : 'relevance_rank'}&language=ar`;

    console.log(`Rainforest: searching "${searchQuery}" on ${domain}`);

    const response = await fetch(url);
    const data     = await response.json();

    if (data.request_info?.success === false) {
      console.error('Rainforest error:', data.request_info.message);
      return null;
    }

    const results = data.search_results || [];
    console.log(`Rainforest: ${results.length} results for "${query}"`);

    if (!results.length) return null;

    return results
      .filter(item => item.type === 'search_product' && item.asin)
      .slice(0, 6)
      .map((item, i) => {
        // بناء الرابط المباشر للمنتج
        const directUrl = `https://www.${domain}/dp/${item.asin}`;

        // السعر
        const price = item.price?.value
          ? `${item.price.value} ${currency}`
          : item.price?.raw || 'تحقق من السعر';

        // الصورة
        const image = item.image || item.images?.[0] ||
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop';

        // التقييم
        const rating = item.rating
          ? String(item.rating)
          : (4 + Math.random() * 0.9).toFixed(1);

        return {
          id:     `rf-${item.asin || i}`,
          name:   item.title?.slice(0, 70) || query,
          price,
          store:  `Amazon ${market}`,
          image,
          url:    directUrl,  // ✓ رابط مباشر للمنتج
          badge:  i === 0 ? 'الأفضل' : i === 1 ? 'الأكثر مبيعاً' : '',
          rating,
          asin:   item.asin,
          source: 'rainforest',
        };
      });

  } catch (err) {
    console.error('Rainforest error:', err.message);
    return null;
  }
}

// ────────────────────────────────────
// SerpAPI — احتياطي لو Rainforest فشل
// ────────────────────────────────────
async function searchWithSerp(query, market = 'SA') {
  try {
    const API_KEY = process.env.SERP_API_KEY;
    if (!API_KEY) return null;
    if (!query || query.trim() === '') return null;

    const marketParams = {
      SA: 'gl=sa&hl=ar', AE: 'gl=ae&hl=ar',
      EG: 'gl=eg&hl=ar', US: 'gl=us&hl=en', CA: 'gl=ca&hl=en',
    };
    const params = marketParams[market] || marketParams['SA'];
    const url = `https://serpapi.com/search?engine=google_shopping&q=${encodeURIComponent(query)}&${params}&api_key=${API_KEY}&num=6`;

    const response = await fetch(url);
    const data     = await response.json();

    if (data.error) { console.error('SerpAPI error:', data.error); return null; }

    const results = data.shopping_results || [];
    if (!results.length) return null;

    // بناء روابط مباشرة حسب المتجر
    return results.slice(0, 6).map((item, i) => {
      const store = (item.source || '').toLowerCase();
      const q     = encodeURIComponent(item.title || query);
      let directUrl = item.product_link || item.link || '#';

      // لو الرابط على Google Shopping — نبني رابطاً مباشراً
      if (directUrl.includes('google.com') || directUrl.includes('shopping/product')) {
        if (store.includes('amazon'))  directUrl = `https://www.amazon.sa/s?k=${q}`;
        else if (store.includes('noon'))   directUrl = `https://www.noon.com/saudi-en/search/?q=${q}`;
        else if (store.includes('jarir'))  directUrl = `https://www.jarir.com/sa-en/catalogsearch/result/?q=${q}`;
        else if (store.includes('extra'))  directUrl = `https://www.extra.com/en-sa/search?q=${q}`;
        else if (store.includes('namshi')) directUrl = `https://en-sa.namshi.com/search/?q=${q}`;
        else directUrl = `https://www.amazon.sa/s?k=${q}`;
      }

      return {
        id:     `s-${i}`,
        name:   item.title?.slice(0, 60) || query,
        price:  item.price || 'تحقق من السعر',
        store:  item.source || 'متجر',
        image:  item.thumbnail || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
        url:    directUrl,
        badge:  i === 0 ? 'أفضل نتيجة' : i === 1 ? 'الأكثر مبيعاً' : '',
        rating: item.rating ? String(item.rating) : (4 + Math.random() * 0.9).toFixed(1),
        source: 'serp',
      };
    });

  } catch (err) {
    console.error('SerpAPI error:', err.message);
    return null;
  }
}

// ────────────────────────────────────
// 5. البحث — Rainforest أولاً ثم SerpAPI
// ────────────────────────────────────
app.post('/api/search', async (req, res) => {
  try {
    const { queries, query, market = 'SA', wantCheaper = false } = req.body;
    const searchTerms = queries || [query];

    if (!searchTerms?.length || searchTerms.every(q => !q?.trim())) {
      return res.json({ products: getMockProducts('products', market, false, 0), mock: true });
    }

    const validTerms = searchTerms.filter(q => q?.trim().length > 0);
    console.log(`\n🔍 Searching: "${validTerms[0]}" | Market: ${market}`);

    let allProducts = [];

    // ── المرحلة ١: Rainforest (Amazon مباشر) ──
    for (const q of validTerms.slice(0, 2)) {
      const results = await searchWithRainforest(q, market, wantCheaper);
      if (results?.length) {
        allProducts.push(...results);
        console.log(`✅ Rainforest: ${results.length} products`);
        break; // نتائج Rainforest كافية
      }
    }

    // ── المرحلة ٢: SerpAPI احتياطي ──
    if (allProducts.length < 3) {
      console.log('Rainforest insufficient, trying SerpAPI...');
      for (const q of validTerms.slice(0, 3)) {
        const results = await searchWithSerp(
          wantCheaper ? `${q} budget` : q,
          market
        );
        if (results?.length) allProducts.push(...results);
      }
    }

    // ── عرض النتائج ──
    if (allProducts.length > 0) {
      const unique = deduplicateProducts(allProducts);
      const sorted = wantCheaper
        ? unique.sort((a, b) => extractPrice(a.price) - extractPrice(b.price))
        : unique;

      const source = allProducts[0]?.source || 'unknown';
      console.log(`📦 Returning ${sorted.slice(0,6).length} products (source: ${source})`);
      return res.json({ products: sorted.slice(0, 6), mock: false, source });
    }

    // ── Mock fallback ──
    console.log('All APIs failed, using mock data');
    const mockProducts = [];
    validTerms.slice(0, 3).forEach((q, i) => {
      mockProducts.push(...getMockProducts(q, market, wantCheaper, i));
    });
    const unique = deduplicateProducts(mockProducts);
    const sorted = wantCheaper
      ? unique.sort((a, b) => extractPrice(a.price) - extractPrice(b.price))
      : unique;
   if (sorted.length === 0) {
  return res.json({
    products: [],
    mock: false,
    error: 'عذراً، لم نجد نتائج الآن. حاول مرة أخرى أو جرب كلمة بحث مختلفة 🙏'
  });
}
res.json({ products: sorted.slice(0, 6), mock: true });

  } catch (err) {
    console.error('Search error:', err);
    res.json({ products: [], error: err.message });
  }
});

// ────────────────────────────────────
// 6. تصفية النتائج بـ Claude
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
          content: `خبير تسوق. العميل يبحث عن:
النوع: ${originalAnalysis.productType}
الماركة: ${originalAnalysis.brand || 'أي ماركة'}
اللون: ${originalAnalysis.color}
${wantCheaper ? 'يريد: الأرخص مع التشابه' : ''}

النتائج:
${products.map((p, i) => `${i}: ${p.name} - ${p.price}`).join('\n')}

رتّب أفضل 4 حسب ${wantCheaper ? 'السعر الأرخص' : 'الدقة'}.
JSON فقط: { "rankedIndices": [0,1,2,3] }`,
        }],
      }),
    });

    const data   = await response.json();
    const text   = data.content?.[0]?.text || '{}';
    const clean  = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const ranked = parsed.rankedIndices?.map(i => products[i]).filter(Boolean);

    res.json({ products: ranked || products });
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
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

function extractPrice(priceStr) {
  return parseFloat(String(priceStr).replace(/[^\d.]/g, '')) || 999999;
}

function getMockProducts(query, market, cheaper = false, offset = 0) {
  const currency = CURRENCIES[market] || 'ر.س';
  const prices   = cheaper ? [89, 129, 69] : [299, 199, 399];
  const badges   = cheaper
    ? ['الأرخص', 'قيمة ممتازة', 'توفير ٦٠٪']
    : ['الأكثر مبيعاً', 'سعر مميز', 'جودة عالية'];
  const images = [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300&h=300&fit=crop',
  ];
  const domain = AMAZON_DOMAINS[market] || 'amazon.sa';
  return [0, 1, 2].map(i => ({
    id:     `mock-${offset}-${i}`,
    name:   `${query} ${i + 1}`,
    price:  `${prices[i]} ${currency}`,
    store:  `Amazon ${market}`,
    image:  images[i % images.length],
    url:    `https://www.${domain}/s?k=${encodeURIComponent(query)}`,
    badge:  badges[i],
    rating: (4 + Math.random() * 0.9).toFixed(1),
  }));
}

// ────────────────────────────────────
// تشغيل السيرفر
// ────────────────────────────────────
app.listen(config.PORT, () => {
  const hasRainforest = !!process.env.RAINFOREST_API_KEY;
  const hasSerp       = !!process.env.SERP_API_KEY;
  const hasClaude     = !!process.env.CLAUDE_API_KEY;
  console.log(`✅ fetchli.shop running on port ${config.PORT}`);
  console.log(`   Rainforest API: ${hasRainforest ? '✅' : '❌ missing'}`);
  console.log(`   SerpAPI:        ${hasSerp       ? '✅ (backup)' : '❌ missing'}`);
  console.log(`   Claude API:     ${hasClaude     ? '✅' : '❌ missing'}`);
});
