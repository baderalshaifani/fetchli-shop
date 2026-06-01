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
              { type: 'LOGO_DETECTION',     maxResults: 5  },
              { type: 'OBJECT_LOCALIZATION',maxResults: 10 },
              { type: 'IMAGE_PROPERTIES',   maxResults: 5  },
              { type: 'WEB_DETECTION',      maxResults: 10 },
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
      ?.map(c => rgbToColorName(
        Math.round(c.color.red   || 0),
        Math.round(c.color.green || 0),
        Math.round(c.color.blue  || 0)
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
// 3. Claude — تحليل عميق + كلمات بحث
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
Google Vision data:
- Brands/Logos: ${visionData.logos.join(', ') || 'none'}
- Objects: ${visionData.objects.join(', ') || 'none'}
- Labels: ${visionData.labels.slice(0, 8).join(', ') || 'none'}
- Web entities: ${visionData.webEntities.slice(0, 5).join(', ') || 'none'}
- Best guess: ${visionData.bestGuess || 'none'}
- Colors: ${visionData.colors.join(', ') || 'none'}
` : '';

  const cheaperNote = wantCheaper
    ? 'User wants cheaper alternatives — focus on: alternative, dupe, budget, affordable, similar'
    : '';

  content.push({
    type: 'text',
    text: `You are a professional shopping search expert.
${imageBase64 ? 'Carefully analyze the image and identify EXACTLY what product is shown.' : ''}
${visionContext}
${message ? `User request: "${message}"` : ''}
${cheaperNote}

RULES:
- Watch image → productType "ساعة", search watches only
- Bag image → productType "حقيبة", search bags only  
- Shoes image → productType "حذاء", search shoes only
- Never mix categories

Create 5 SHORT English search queries (max 4 words each) suitable for e-commerce search:
- Query 1: brand + type + color (e.g. "Rolex watch black")
- Query 2: type + color + material (e.g. "leather watch brown")
- Query 3: type + style (e.g. "luxury dress watch")
- Query 4: ${wantCheaper ? 'budget similar type' : 'type + key feature'}
- Query 5: general type only (e.g. "watch", "bag", "shoes")

Respond ONLY with valid JSON:
{
  "productType": "نوع المنتج بالعربي",
  "brand": "brand or null",
  "color": "main color",
  "material": "material",
  "details": "key features",
  "searchQueries": ["q1","q2","q3","q4","q5"],
  "reply": "رد ودي قصير بالعربي",
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
      max_tokens: 800,
      system:     'You are a product analysis API. Respond with valid JSON only. No markdown, no code blocks.',
      messages:   [
        { role: 'user',      content },
        { role: 'assistant', content: [{ type: 'text', text: '{' }] },
      ],
    }),
  });

  const data  = await response.json();
  const raw   = data.content?.[0]?.text || '';
  const text  = raw.startsWith('{') ? raw : '{' + raw;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON from Claude');
  return JSON.parse(match[0]);
}

// ────────────────────────────────────
// Fallback إذا فشل Claude
// ────────────────────────────────────
function buildFallbackFromVision(visionData, message, wantCheaper) {
  if (!visionData) {
    return {
      productType: message || 'منتج',
      brand: null, color: '',
      searchQueries: [message || 'product'],
      reply: 'جاري البحث...', confidence: 60,
    };
  }
  const brand   = visionData.logos?.[0] || null;
  const guess   = visionData.bestGuess  || '';
  const objects = visionData.objects?.join(' ') || '';
  const labels  = visionData.labels?.slice(0, 5).join(' ') || '';
  const color   = visionData.colors?.[0] || '';

  const productMap = {
    'watch':'ساعة','clock':'ساعة','bag':'حقيبة','handbag':'حقيبة',
    'shoe':'حذاء','sneaker':'حذاء','shirt':'قميص','dress':'فستان',
    'phone':'جوال','laptop':'لابتوب','headphone':'سماعة',
  };
  let productType = 'منتج';
  const allText = (guess + ' ' + objects + ' ' + labels).toLowerCase();
  for (const [en, ar] of Object.entries(productMap)) {
    if (allText.includes(en)) { productType = ar; break; }
  }

  const q1 = [brand, guess, color].filter(Boolean).join(' ').trim() || message || 'product';
  const q2 = [guess, color].filter(Boolean).join(' ').trim() || q1;
  const q3 = wantCheaper ? `${guess} budget` : `${guess} buy`;
  const q4 = brand ? `${brand} ${guess}` : guess;
  const q5 = message || guess || 'product';

  return {
    productType, brand, color, details: objects,
    searchQueries: [q1,q2,q3,q4,q5].filter(q => q && q.trim().length > 1),
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
    } catch (e) {
      console.error('Claude failed:', e.message);
    }

    if (!analyzed?.searchQueries?.length) {
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
// 5A. Rainforest API — Amazon
// ────────────────────────────────────
async function searchAmazon(query, market = 'SA') {
  try {
    const API_KEY = process.env.RAINFOREST_API_KEY;
    if (!API_KEY) { console.log('Rainforest: no key'); return []; }
    if (!query?.trim()) return [];

    // حدد amazon_domain حسب السوق
    const domainMap = {
      SA: 'amazon.sa', AE: 'amazon.ae', EG: 'amazon.eg',
      US: 'amazon.com', CA: 'amazon.ca', KW: 'amazon.sa',
      QA: 'amazon.sa',
    };
    const amazon_domain = domainMap[market] || 'amazon.sa';

    const url = `https://api.rainforestapi.com/request?api_key=${API_KEY}&type=search&amazon_domain=${amazon_domain}&search_term=${encodeURIComponent(query)}&sort_by=relevance&page=1`;

    console.log(`Amazon search: "${query}" on ${amazon_domain}`);
    const response = await fetch(url);
    const data     = await response.json();

    if (!data.search_results?.length) {
      console.log('Amazon: no results for', query);
      return [];
    }

    // عملة حسب السوق
    const currencyMap = { SA:'ر.س', AE:'د.إ', EG:'ج.م', US:'$', CA:'C$', KW:'ر.س', QA:'ر.س' };
    const currency = currencyMap[market] || 'ر.س';

    return data.search_results.slice(0, 5).map((item, i) => ({
      id:     `amz-${Date.now()}-${i}`,
      name:   item.title?.slice(0, 70) || query,
      price:  item.price?.value ? `${item.price.value} ${currency}` : (item.price?.raw || 'تحقق من السعر'),
      store:  `Amazon ${market}`,
      image:  item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
      url:    item.link || `https://www.amazon.sa/s?k=${encodeURIComponent(query)}`,
      badge:  i === 0 ? '🏆 Amazon' : '',
      rating: item.rating ? String(item.rating) : null,
      source: 'amazon',
    }));
  } catch (err) {
    console.error('Amazon error:', err.message);
    return [];
  }
}

// ────────────────────────────────────
// 5B. AliExpress Affiliate API
// ────────────────────────────────────
async function searchAliExpress(query, wantCheaper = false) {
  try {
    const APP_KEY    = process.env.ALIEXPRESS_APP_KEY;
    const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
    if (!APP_KEY || !APP_SECRET) { console.log('AliExpress: no keys'); return []; }
    if (!query?.trim()) return [];

    // AliExpress Affiliate Product Query API
    const timestamp  = Date.now();
    const method     = 'aliexpress.affiliate.product.query';
    const sortBy     = wantCheaper ? 'SALE_PRICE_ASC' : 'SALE_PRICE_DESC';

    // بناء الـ params
    const params = {
      app_key:       APP_KEY,
      timestamp:     String(timestamp),
      sign_method:   'md5',
      method,
      keywords:      query,
      page_size:     '6',
      page_no:       '1',
      sort:          sortBy,
      target_currency: 'USD',
      target_language: 'EN',
      tracking_id:   APP_KEY,
    };

    // توليد الـ signature
    const sign = generateAliSign(params, APP_SECRET);
    params.sign = sign;

    const queryString = Object.entries(params)
      .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const url = `https://api-sg.aliexpress.com/sync?${queryString}`;
    console.log(`AliExpress search: "${query}"`);

    const response = await fetch(url);
    const data     = await response.json();

    // استخرج النتائج
    const respKey  = 'aliexpress_affiliate_product_query_response';
    const items    = data?.[respKey]?.resp_result?.result?.products?.product;

    if (!items?.length) {
      console.log('AliExpress: no results for', query, JSON.stringify(data).slice(0, 200));
      return [];
    }

    return items.slice(0, 5).map((item, i) => ({
      id:     `ali-${Date.now()}-${i}`,
      name:   item.product_title?.slice(0, 70) || query,
      price:  item.target_sale_price ? `${item.target_sale_price} ${item.target_sale_price_currency || 'USD'}` : 'تحقق من السعر',
      store:  'AliExpress',
      image:  item.product_main_image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
      url:    item.promotion_link || item.product_detail_url || '#',
      badge:  i === 0 ? '🛒 AliExpress' : '',
      rating: item.evaluate_rate ? String(parseFloat(item.evaluate_rate) / 20) : null,
      source: 'aliexpress',
    }));
  } catch (err) {
    console.error('AliExpress error:', err.message);
    return [];
  }
}

// توليد MD5 signature لـ AliExpress
function generateAliSign(params, secret) {
  const crypto = require('crypto');
  // رتّب الـ params أبجدياً
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  const str    = secret + sorted + secret;
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

// ────────────────────────────────────
// 6. Endpoint البحث الرئيسي
// ────────────────────────────────────
app.post('/api/search', async (req, res) => {
  try {
    const { queries, query, market = 'SA', wantCheaper = false } = req.body;
    const searchTerms = (queries || [query]).filter(q => q && q.trim().length > 0);

    if (!searchTerms.length) {
      return res.json({ products: [], mock: false });
    }

    console.log('=== Search start ===', searchTerms.slice(0, 3));

    // ابحث بأفضل 3 queries بالتوازي في كلا المتجرين
    const topQueries = searchTerms.slice(0, 3);

    const [amazonResults, aliResults] = await Promise.all([
      // Amazon — أفضل query فقط (لتوفير credits)
      searchAmazon(topQueries[0], market),
      // AliExpress — نجرب أول قيرتين
      (async () => {
        let results = await searchAliExpress(topQueries[0], wantCheaper);
        if (results.length < 3 && topQueries[1]) {
          const r2 = await searchAliExpress(topQueries[1], wantCheaper);
          results  = [...results, ...r2];
        }
        return results;
      })(),
    ]);

    console.log(`Amazon: ${amazonResults.length} | AliExpress: ${aliResults.length}`);

    // دمج النتائج: Amazon أولاً ثم AliExpress
    let allProducts = [...amazonResults, ...aliResults];

    // لو ما في نتائج، جرب query ثانية على Amazon
    if (allProducts.length === 0 && topQueries[1]) {
      const r2 = await searchAmazon(topQueries[1], market);
      allProducts = [...r2];
    }

    if (allProducts.length === 0) {
      console.log('No results from any source');
      return res.json({ products: [], mock: false });
    }

    // ترتيب لو يريد أرخص
    if (wantCheaper) {
      allProducts.sort((a, b) => extractPrice(a.price) - extractPrice(b.price));
    }

    res.json({ products: allProducts.slice(0, 8), mock: false });

  } catch (err) {
    console.error('Search error:', err);
    res.json({ products: [], error: err.message });
  }
});

// ────────────────────────────────────
// 7. تصفية النتائج بـ Claude
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
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Shopping expert. User wants:
Type: ${originalAnalysis.productType}
Brand: ${originalAnalysis.brand || 'any'}
Color: ${originalAnalysis.color || 'any'}
${wantCheaper ? 'Preference: cheapest similar' : ''}

Products (${products.length}):
${products.map((p, i) => `${i}: ${p.name} | ${p.price} | ${p.store}`).join('\n')}

Return the best ${Math.min(products.length, 6)} indices ranked by ${wantCheaper ? 'lowest price' : 'relevance'}.
JSON only: { "rankedIndices": [0,1,2,3,4,5] }`,
        }],
      }),
    });

    const data   = await response.json();
    const text   = data.content?.[0]?.text || '{}';
    const clean  = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const ranked = parsed.rankedIndices
      ?.filter(i => typeof i === 'number' && i >= 0 && i < products.length)
      ?.map(i => products[i])
      ?.filter(Boolean);

    res.json({ products: ranked?.length >= 1 ? ranked : products });
  } catch (err) {
    console.error('Filter error:', err.message);
    res.json({ products: req.body.products || [] });
  }
});

// ────────────────────────────────────
// Helpers
// ────────────────────────────────────
function extractPrice(priceStr) {
  if (!priceStr) return 999999;
  return parseFloat(String(priceStr).replace(/[^\d.]/g, '')) || 999999;
}

// ────────────────────────────────────
// تشغيل السيرفر
// ────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`✅ fetchli.shop running on port ${config.PORT}`);
  console.log(`   Amazon (Rainforest): ${process.env.RAINFOREST_API_KEY ? '✅' : '❌'}`);
  console.log(`   AliExpress:          ${process.env.ALIEXPRESS_APP_KEY ? '✅' : '❌'}`);
  console.log(`   Google Vision:       ${process.env.GOOGLE_VISION_KEY  ? '✅' : '❌'}`);
  console.log(`   Claude:              ${process.env.CLAUDE_API_KEY     ? '✅' : '❌'}`);
});
