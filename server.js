// ===================================
// fetchli.shop — الباك اند
// ===================================

const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const path     = require('path');
const crypto   = require('crypto');
const config   = require('./config');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ────────────────────────────────────
// 1. تحديد دولة المستخدم
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
// 2. Google Vision
// ────────────────────────────────────
async function analyzeWithGoogleVision(imageBase64) {
  try {
    const GOOGLE_KEY = process.env.GOOGLE_VISION_KEY;
    if (!GOOGLE_KEY) return null;

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
              { type: 'LOGO_DETECTION',      maxResults: 5  },
              { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
              { type: 'IMAGE_PROPERTIES',    maxResults: 5  },
              { type: 'WEB_DETECTION',       maxResults: 10 },
              { type: 'TEXT_DETECTION',      maxResults: 1  }, // لقراءة نصوص التذاكر
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
    const fullText    = result.textAnnotations?.[0]?.description || ''; // النص الكامل من الصورة
    const colors      = result.imagePropertiesAnnotation?.dominantColors?.colors
      ?.slice(0, 3)
      ?.map(c => rgbToColorName(
        Math.round(c.color.red   || 0),
        Math.round(c.color.green || 0),
        Math.round(c.color.blue  || 0)
      )) || [];

    return { labels, logos, objects, webEntities, bestGuess, colors, fullText };
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
// 3. Claude — تحليل ذكي شامل
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
- Text in image: ${visionData.fullText?.slice(0, 300) || 'none'}
` : '';

  content.push({
    type: 'text',
    text: `You are fetchli — an intelligent universal search assistant. You understand ANY request in ANY language and find the best results.

${imageBase64 ? 'Analyze the image carefully.' : ''}
${visionContext}
${message ? `User request: "${message}"` : ''}
${wantCheaper ? 'User wants cheaper alternatives.' : ''}

STEP 1 — Determine request type:
- "product": physical item to buy (clothes, electronics, cosmetics, food supplements, hair products, skincare, etc.)
- "hotel": hotel or accommodation search
- "flight": flight ticket search  
- "other": anything else

STEP 2 — For PRODUCTS, understand even indirect requests:
- "تساقط شعر" / "hair loss" → hair loss shampoo/treatment/serum
- "تبييض أسنان" → teeth whitening products
- "كريم مبيض" → whitening cream/serum
- "آلام ظهر" → back pain relief products
- "نوم أفضل" → sleep aid/melatonin/pillow
- "رجيم" / "diet" → weight loss supplements
- "بشرة جافة" → moisturizer/dry skin cream
- Always map the PROBLEM to the PRODUCT SOLUTION

STEP 3 — Generate 5 short English search queries (max 5 words each):
- Query 1: most specific (brand + product + key feature)
- Query 2: problem-solution focused
- Query 3: category + top feature
- Query 4: ${wantCheaper ? 'budget affordable alternative' : 'premium/best version'}
- Query 5: general category (1-2 words only)

STEP 4 — For FLIGHTS (from image or text), extract:
- from: departure city/airport
- to: destination city/airport  
- date: travel date
- passengers: number

STEP 5 — For HOTELS, extract:
- city: destination
- checkIn / checkOut dates
- guests: number

Respond ONLY with JSON:
{
  "searchType": "product|hotel|flight|other",
  "productType": "نوع المنتج أو الخدمة بالعربي",
  "brand": "brand or null",
  "color": "color or null",
  "material": "material or null",
  "details": "key features",
  "searchQueries": ["q1","q2","q3","q4","q5"],
  "flightData": { "from": null, "to": null, "date": null, "passengers": 1 },
  "hotelData": { "city": null, "checkIn": null, "checkOut": null, "guests": 1 },
  "reply": "رد ودي قصير بالعربي يوضح ما فهمته",
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
      system:     'You are a universal search API. Respond with valid JSON only. No markdown, no explanation.',
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
// Fallback
// ────────────────────────────────────
function buildFallback(visionData, message, wantCheaper) {
  if (!visionData && !message) {
    return { searchType: 'product', productType: 'منتج', brand: null, color: '',
      searchQueries: ['product'], reply: 'جاري البحث...', confidence: 60 };
  }

  const brand   = visionData?.logos?.[0] || null;
  const guess   = visionData?.bestGuess  || message || '';
  const color   = visionData?.colors?.[0] || '';
  const objects = visionData?.objects?.join(' ') || '';
  const labels  = visionData?.labels?.slice(0, 5).join(' ') || '';

  const productMap = {
    'watch':'ساعة','bag':'حقيبة','shoe':'حذاء','shirt':'قميص',
    'phone':'جوال','laptop':'لابتوب','headphone':'سماعة',
    'hair':'شعر','cream':'كريم','shampoo':'شامبو',
    'ticket':'تذكرة','boarding':'تذكرة طيران','hotel':'فندق',
  };

  let productType = 'منتج';
  const allText = (guess + ' ' + objects + ' ' + labels + ' ' + (message||'')).toLowerCase();
  for (const [en, ar] of Object.entries(productMap)) {
    if (allText.includes(en)) { productType = ar; break; }
  }

  // كشف نوع الطلب
  let searchType = 'product';
  if (/hotel|فندق|إقامة|accommodation/i.test(allText)) searchType = 'hotel';
  if (/flight|ticket|تذكرة|طيران|boarding/i.test(allText)) searchType = 'flight';

  const q1 = [brand, guess, color].filter(Boolean).join(' ').trim() || message || 'product';
  const q2 = message || guess || q1;
  const q3 = wantCheaper ? `${guess} budget` : `best ${guess}`;
  const q4 = brand ? `${brand} ${guess}` : `${guess} online`;
  const q5 = guess.split(' ')[0] || 'product';

  return {
    searchType, productType, brand, color, details: objects,
    searchQueries: [q1,q2,q3,q4,q5].filter(q => q?.trim().length > 1),
    reply: `جاري البحث عن ${productType}...`,
    confidence: 70,
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
      console.log('Vision:', visionData?.bestGuess, '| Text:', visionData?.fullText?.slice(0,50));
    }

    let analyzed = null;
    try {
      analyzed = await analyzeWithClaude(message, imageBase64, visionData, wantCheaper);
      console.log('Claude searchType:', analyzed.searchType, '| queries:', analyzed.searchQueries?.slice(0,2));
    } catch (e) {
      console.error('Claude failed:', e.message);
    }

    if (!analyzed?.searchQueries?.length) {
      analyzed = buildFallback(visionData, message, wantCheaper);
    }

    if (visionData?.logos?.length > 0 && analyzed.brand) {
      analyzed.confidence = Math.min(98, (analyzed.confidence || 85) + 5);
    }

    res.json({ ...analyzed, visionData });
  } catch (err) {
    console.error('Analyze error:', err);
    res.json({ searchType: 'product', searchQueries: [req.body.message || 'product'],
      reply: 'جاري البحث...', confidence: 60 });
  }
});

// ────────────────────────────────────
// 5A. Amazon — Rainforest API
// ────────────────────────────────────
async function searchAmazon(query, market = 'SA') {
  try {
    const API_KEY = process.env.RAINFOREST_API_KEY;
    if (!API_KEY || !query?.trim()) return [];

    const domainMap = {
      SA:'amazon.sa', AE:'amazon.ae', EG:'amazon.eg',
      US:'amazon.com', CA:'amazon.ca', KW:'amazon.sa', QA:'amazon.sa',
    };
    const amazon_domain = domainMap[market] || 'amazon.sa';
    const url = `https://api.rainforestapi.com/request?api_key=${API_KEY}&type=search&amazon_domain=${amazon_domain}&search_term=${encodeURIComponent(query)}&sort_by=relevance`;

    console.log(`Amazon: "${query}" → ${amazon_domain}`);
    const response = await fetch(url);
    const data     = await response.json();
    if (!data.search_results?.length) return [];

    const currencyMap = { SA:'ر.س', AE:'د.إ', EG:'ج.م', US:'$', CA:'C$', KW:'ر.س', QA:'ر.س' };
    const currency = currencyMap[market] || 'ر.س';

    return data.search_results.slice(0, 5).map((item, i) => ({
      id:     `amz-${Date.now()}-${i}`,
      name:   item.title?.slice(0, 70) || query,
      price:  item.price?.value ? `${item.price.value} ${currency}` : (item.price?.raw || 'تحقق من السعر'),
      store:  `Amazon ${market}`,
      image:  item.image || '',
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
    if (!APP_KEY || !APP_SECRET || !query?.trim()) return [];

    const params = {
      app_key:         APP_KEY,
      timestamp:       String(Date.now()),
      sign_method:     'md5',
      method:          'aliexpress.affiliate.product.query',
      keywords:        query,
      page_size:       '6',
      page_no:         '1',
      sort:            wantCheaper ? 'SALE_PRICE_ASC' : 'SALE_PRICE_DESC',
      target_currency: 'USD',
      target_language: 'EN',
      tracking_id:     APP_KEY,
    };

    params.sign = generateAliSign(params, APP_SECRET);

    const queryString = Object.entries(params)
      .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    console.log(`AliExpress: "${query}"`);
    const response = await fetch(`https://api-sg.aliexpress.com/sync?${queryString}`);
    const data     = await response.json();

    const items = data?.['aliexpress_affiliate_product_query_response']
      ?.resp_result?.result?.products?.product;

    if (!items?.length) {
      console.log('AliExpress no results:', JSON.stringify(data).slice(0, 150));
      return [];
    }

    return items.slice(0, 5).map((item, i) => ({
      id:     `ali-${Date.now()}-${i}`,
      name:   item.product_title?.slice(0, 70) || query,
      price:  item.target_sale_price
        ? `${item.target_sale_price} ${item.target_sale_price_currency || 'USD'}`
        : 'تحقق من السعر',
      store:  'AliExpress',
      image:  item.product_main_image_url || '',
      url:    item.promotion_link || item.product_detail_url || '#',
      badge:  i === 0 ? '🛒 AliExpress' : '',
      rating: item.evaluate_rate
        ? (parseFloat(item.evaluate_rate) / 20).toFixed(1)
        : null,
      source: 'aliexpress',
    }));
  } catch (err) {
    console.error('AliExpress error:', err.message);
    return [];
  }
}

function generateAliSign(params, secret) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  return crypto.createHash('md5').update(secret + sorted + secret).digest('hex').toUpperCase();
}

// ────────────────────────────────────
// 5C. Flights — PLACEHOLDER (جاهز للربط)
// ────────────────────────────────────
async function searchFlights(flightData) {
  // TODO: ربط Skyscanner API أو Amadeus
  // flightData = { from, to, date, passengers }
  console.log('Flight search requested:', flightData);
  return []; // placeholder
}

// ────────────────────────────────────
// 5D. Hotels — PLACEHOLDER (جاهز للربط)
// ────────────────────────────────────
async function searchHotels(hotelData) {
  // TODO: ربط Booking.com API أو Hotels.com
  // hotelData = { city, checkIn, checkOut, guests }
  console.log('Hotel search requested:', hotelData);
  return []; // placeholder
}

// ────────────────────────────────────
// 6. Endpoint البحث الرئيسي
// ────────────────────────────────────
app.post('/api/search', async (req, res) => {
  try {
    const {
      queries, query, market = 'SA',
      wantCheaper = false,
      searchType  = 'product',
      flightData, hotelData,
    } = req.body;

    const searchTerms = (queries || [query]).filter(q => q?.trim().length > 0);
    console.log(`=== Search [${searchType}] ===`, searchTerms.slice(0,2));

    // ── تذاكر طيران ──
    if (searchType === 'flight') {
      const results = await searchFlights(flightData || {});
      if (results.length) return res.json({ products: results, mock: false, searchType: 'flight' });
      // Fallback مؤقت لو ما في API
      return res.json({
        products: [],
        mock: false,
        searchType: 'flight',
        message: 'سيتم إضافة البحث عن الرحلات قريباً ✈️',
      });
    }

    // ── فنادق ──
    if (searchType === 'hotel') {
      const results = await searchHotels(hotelData || {});
      if (results.length) return res.json({ products: results, mock: false, searchType: 'hotel' });
      return res.json({
        products: [],
        mock: false,
        searchType: 'hotel',
        message: 'سيتم إضافة البحث عن الفنادق قريباً 🏨',
      });
    }

    // ── منتجات: Amazon + AliExpress بالتوازي ──
    if (!searchTerms.length) return res.json({ products: [], mock: false });

    const topQ = searchTerms.slice(0, 3);

    const [amazonResults, aliResults] = await Promise.all([
      searchAmazon(topQ[0], market),
      (async () => {
        let r = await searchAliExpress(topQ[0], wantCheaper);
        if (r.length < 3 && topQ[1]) {
          const r2 = await searchAliExpress(topQ[1], wantCheaper);
          r = [...r, ...r2];
        }
        return r;
      })(),
    ]);

    console.log(`Results → Amazon: ${amazonResults.length} | AliExpress: ${aliResults.length}`);

    // دمج: Amazon أولاً ثم AliExpress
    let allProducts = [...amazonResults, ...aliResults];

    // لو ما رجع شيء، جرب query ثانية على Amazon
    if (allProducts.length === 0 && topQ[1]) {
      const r2 = await searchAmazon(topQ[1], market);
      allProducts = [...r2];
    }

    // لو ما زال فارغ، جرب query ثالثة
    if (allProducts.length === 0 && topQ[2]) {
      const [r3a, r3b] = await Promise.all([
        searchAmazon(topQ[2], market),
        searchAliExpress(topQ[2], wantCheaper),
      ]);
      allProducts = [...r3a, ...r3b];
    }

    if (wantCheaper) {
      allProducts.sort((a, b) => extractPrice(a.price) - extractPrice(b.price));
    }

    res.json({ products: allProducts.slice(0, 8), mock: false, searchType: 'product' });

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
${wantCheaper ? 'Preference: cheapest' : ''}

Products (${products.length}):
${products.map((p, i) => `${i}: ${p.name} | ${p.price} | ${p.store}`).join('\n')}

Return best ${Math.min(products.length, 6)} ranked by ${wantCheaper ? 'price asc' : 'relevance'}.
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
  console.log(`   Amazon  (Rainforest): ${process.env.RAINFOREST_API_KEY ? '✅' : '❌'}`);
  console.log(`   AliExpress:           ${process.env.ALIEXPRESS_APP_KEY ? '✅' : '❌'}`);
  console.log(`   Google Vision:        ${process.env.GOOGLE_VISION_KEY  ? '✅' : '❌'}`);
  console.log(`   Claude:               ${process.env.CLAUDE_API_KEY     ? '✅' : '❌'}`);
  console.log(`   Flights API:          ⏳ placeholder`);
  console.log(`   Hotels API:           ⏳ placeholder`);
});
