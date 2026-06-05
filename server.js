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
// ── IP Location cache + 3 providers ──
const _locCache = new Map();
const _COUNTRY_INFO = {
  SA:{currency:'SAR',flag:'🇸🇦',name:'السعودية'}, AE:{currency:'AED',flag:'🇦🇪',name:'الإمارات'},
  EG:{currency:'EGP',flag:'🇪🇬',name:'مصر'},      US:{currency:'USD',flag:'🇺🇸',name:'أمريكا'},
  CA:{currency:'CAD',flag:'🇨🇦',name:'كندا'},     KW:{currency:'KWD',flag:'🇰🇼',name:'الكويت'},
  QA:{currency:'QAR',flag:'🇶🇦',name:'قطر'},      BH:{currency:'BHD',flag:'🇧🇭',name:'البحرين'},
  OM:{currency:'OMR',flag:'🇴🇲',name:'عُمان'},    GB:{currency:'GBP',flag:'🇬🇧',name:'بريطانيا'},
  DE:{currency:'EUR',flag:'🇩🇪',name:'ألمانيا'},
};
async function _safeJsonFetch(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const text = await r.text();
    clearTimeout(t);
    if (!text.trim().startsWith('{')) throw new Error('non-JSON: ' + text.slice(0,40));
    return JSON.parse(text);
  } catch(e) { clearTimeout(t); throw e; }
}
async function _detectCountry(ip) {
  if (_locCache.has(ip)) return _locCache.get(ip);
  const COUNTRY_MAP = config.COUNTRY_MAP || {};
  let country = 'SA';
  const providers = [
    () => _safeJsonFetch(`http://ip-api.com/json/${ip}?fields=countryCode`).then(d => { if(d.countryCode) return d.countryCode; throw new Error('empty'); }),
    () => _safeJsonFetch(`https://ipwho.is/${ip}`).then(d => { if(d.country_code) return d.country_code; throw new Error('empty'); }),
    () => _safeJsonFetch(`https://ipapi.co/${ip}/json/`).then(d => { if(d.country_code) return d.country_code; throw new Error('empty'); }),
  ];
  for (const p of providers) {
    try { country = await p(); break; }
    catch(e) { console.warn('IP provider failed:', e.message); }
  }
  const market = COUNTRY_MAP[country] || 'US';
  const info   = _COUNTRY_INFO[country] || _COUNTRY_INFO['US'];
  const result = { country, market, ...info };
  if (_locCache.size > 500) _locCache.clear();
  _locCache.set(ip, result);
  return result;
}

app.get('/api/location', async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
      return res.json({ country:'SA', market:'SA', currency:'SAR', flag:'🇸🇦', name:'السعودية' });
    }
    res.json(await _detectCountry(ip));
  } catch(err) {
    res.json({ country:'SA', market:'SA', currency:'SAR', flag:'🇸🇦', name:'السعودية' });
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

    // استخرج المعلومات المفيدة
    const labels  = result.labelAnnotations?.map(l => l.description) || [];
    const logos   = result.logoAnnotations?.map(l => l.description)  || [];
    const objects = result.localizedObjectAnnotations?.map(o => o.name) || [];
    const webEntities = result.webDetection?.webEntities
      ?.filter(e => e.score > 0.5)
      ?.map(e => e.description) || [];
    const bestGuess = result.webDetection?.bestGuessLabels?.[0]?.label || '';

    // أبرز الألوان
    const colors = result.imagePropertiesAnnotation?.dominantColors?.colors
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

// تحويل RGB لاسم لون
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

  // أضف بيانات Google Vision كسياق إضافي
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

Respond ONLY with valid JSON, no extra text:
{
  "productType": "نوع المنتج بالعربي",
  "brand": "brand name or null",
  "color": "main color",
  "material": "material/texture",
  "details": "distinctive features",
  "searchQueries": ["specific query","no-brand query","q3","q4","q5"],
  "priceRange": "${wantCheaper ? 'budget' : 'any'}",
  "reply": "رد ودي قصير بالعربي يصف ما وجدته بالضبط",
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
      system:     'You are a product analysis API. You MUST respond with valid JSON only. No markdown, no code blocks, no explanation. Just the raw JSON object starting with { and ending with }.',
      messages:   [
        { role: 'user',      content },
        { role: 'assistant', content: [{ type: 'text', text: '{' }] },
      ],
    }),
  });

  const data  = await response.json();
  const raw   = data.content?.[0]?.text || '""';
  // Claude ابتدأ بـ { لأننا prefilled — نضيف الـ { المفقود
  const text  = raw.startsWith('{') ? raw : '{' + raw;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Claude raw response:', raw.slice(0, 200));
    throw new Error("No JSON in response");
  }
  return JSON.parse(jsonMatch[0]);
}


// ────────────────────────────────────
// Fallback — يبني البحث من Vision مباشرة
// ────────────────────────────────────
function buildFallbackFromVision(visionData, message, wantCheaper) {
  if (!visionData) {
    return {
      productType: message || 'منتج',
      brand: null,
      color: '',
      searchQueries: [message || 'product'],
      reply: 'جاري البحث عن المنتج...',
      confidence: 60,
    };
  }

  const brand    = visionData.logos?.[0] || null;
  const guess    = visionData.bestGuess  || '';
  const objects  = visionData.objects?.join(' ') || '';
  const labels   = visionData.labels?.slice(0, 5).join(' ') || '';
  const color    = visionData.colors?.[0] || '';

  // حدد نوع المنتج من Vision
  const productMap = {
    'watch':  'ساعة', 'clock': 'ساعة', 'timepiece': 'ساعة',
    'bag':    'حقيبة', 'handbag': 'حقيبة', 'purse': 'حقيبة',
    'shoe':   'حذاء', 'sneaker': 'حذاء', 'boot': 'حذاء',
    'shirt':  'قميص', 'dress': 'فستان', 'jacket': 'جاكيت',
    'phone':  'جوال', 'laptop': 'لابتوب', 'headphone': 'سماعة',
  };

  let productType = 'منتج';
  const allText = (guess + ' ' + objects + ' ' + labels).toLowerCase();
  for (const [en, ar] of Object.entries(productMap)) {
    if (allText.includes(en)) { productType = ar; break; }
  }

  const cheaper = wantCheaper ? 'budget affordable' : '';

  // بناء كلمات بحث قوية من بيانات Vision
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
    details: objects,
    searchQueries: queries.length > 0 ? queries : [message || brand || 'product'],
    reply: `وجدت ${productType}${brand ? ' من ' + brand : ''} — جاري البحث عن أفضل الأسعار`,
    confidence: 82,
  };
}

// ────────────────────────────────────
// 4. Endpoint الرئيسي — تحليل متكامل
// ────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  try {
    const { message, imageBase64, wantCheaper = false } = req.body;

    // المرحلة ١: Google Vision (بصري)
    let visionData = null;
    if (imageBase64) {
      visionData = await analyzeWithGoogleVision(imageBase64);
      console.log('Vision data:', visionData?.bestGuess, visionData?.logos);
    }

    // المرحلة ٢: Claude (فهم عميق + كلمات بحث)
    let analyzed = null;
    try {
      analyzed = await analyzeWithClaude(message, imageBase64, visionData, wantCheaper);
    } catch (claudeErr) {
      console.error('Claude failed, using Vision fallback:', claudeErr.message);
      analyzed = null;
    }

    // ── Fallback ذكي لو Claude فشل ──
    if (!analyzed || !analyzed.searchQueries?.length) {
      analyzed = buildFallbackFromVision(visionData, message, wantCheaper);
    }

    // رفع الثقة لو Google Vision أكد الماركة
    if (visionData?.logos?.length > 0 && analyzed.brand) {
      analyzed.confidence = Math.min(98, (analyzed.confidence || 85) + 5);
    }

    res.json({ ...analyzed, visionData });
  } catch (err) {
    console.error('Analyze error:', err);
    res.json({
      searchQueries: [req.body.message || 'product'],
      reply: 'جاري البحث...',
      confidence: 60,
    });
  }
});


// ────────────────────────────────────
// SerpAPI — نتائج Google Shopping حقيقية
// ────────────────────────────────────
async function searchWithGoogle(query, market = 'SA') {
  try {
    const API_KEY = process.env.SERP_API_KEY;
    if (!API_KEY) return null;

    // تأكد من وجود query
    if (!query || query.trim() === '') {
      console.error('SerpAPI: empty query');
      return null;
    }

    // حدد اللغة والبلد حسب السوق
    const marketParams = {
      SA: 'gl=sa&hl=ar',
      AE: 'gl=ae&hl=ar',
      EG: 'gl=eg&hl=ar',
      US: 'gl=us&hl=en',
      CA: 'gl=ca&hl=en',
    };
    const params = marketParams[market] || marketParams['SA'];

    const url = `https://serpapi.com/search?engine=google_shopping&q=${encodeURIComponent(query)}&${params}&api_key=${API_KEY}&num=6`;

    const response = await fetch(url);
    const data     = await response.json();

    if (data.error) {
      console.error('SerpAPI Error:', data.error);
      return null;
    }

    const results = data.shopping_results || [];
    console.log('SerpAPI success:', results.length, 'results for:', query);

    if (!results.length) return null;

    return results.slice(0, 6).map((item, i) => ({
      id:     `s-${i}`,
      name:   item.title?.slice(0, 60) || query,
      price:  item.price || 'تحقق من السعر',
      store:  item.source || 'متجر',
      image:  item.thumbnail || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
      url:    item.product_link || item.link || '#',
      badge:  i === 0 ? 'أفضل نتيجة' : i === 1 ? 'الأكثر مبيعاً' : '',
      rating: item.rating ? String(item.rating) : (4 + Math.random() * 0.9).toFixed(1),
      source: 'serp',
    }));

  } catch (err) {
    console.error('SerpAPI error:', err.message);
    return null;
  }
}

// ────────────────────────────────────
// 5. البحث في المتاجر
// ────────────────────────────────────
app.post('/api/search', async (req, res) => {
  try {
    const { queries, query, market = 'SA', wantCheaper = false } = req.body;
    const searchTerms = queries || [query];

    // ── Emergency fallback لو كل الـ queries فارغة ──
    if (!searchTerms || searchTerms.length === 0 || searchTerms.every(q => !q || q.trim() === '')) {
      console.log('All queries empty - using generic fallback');
      const fallbackResults = await searchWithGoogle('trending products', market);
      if (fallbackResults?.length) {
        return res.json({ products: fallbackResults.slice(0, 6), mock: false, source: 'serp' });
      }
      return res.json({ products: getMockProducts('products', market, false, 0), mock: true });
    }

    // ── المرحلة ١: جرب SerpAPI أولاً ──
    let allProducts = [];
    const validTerms = searchTerms.filter(q => q && q.trim().length > 0);
    console.log('Search terms:', validTerms);
    for (const q of validTerms.slice(0, 3)) {
      const googleResults = await searchWithGoogle(
        wantCheaper ? `${q} budget affordable` : q,
        market
      );
      if (googleResults?.length) {
        allProducts.push(...googleResults);
      }
    }

    // ── المرحلة ٢: لو Google رجع نتائج ──
    if (allProducts.length > 0) {
      const unique = deduplicateProducts(allProducts);
      const sorted = wantCheaper
        ? unique.sort((a, b) => extractPrice(a.price) - extractPrice(b.price))
        : unique;
      console.log(`Google Search: ${sorted.length} results for "${searchTerms[0]}"`);
      return res.json({ products: sorted.slice(0, 6), mock: false, source: 'google' });
    }

    // ── Fallback: بيانات تجريبية لو Google فشل ──
    console.log('Google Search failed, using mock data');
    const mockProducts = [];
    searchTerms.slice(0, 3).forEach((q, i) => {
      mockProducts.push(...getMockProducts(q, market, wantCheaper, i));
    });
    const unique = deduplicateProducts(mockProducts);
    const sorted = wantCheaper
      ? unique.sort((a, b) => extractPrice(a.price) - extractPrice(b.price))
      : unique;
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
  return products.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
}

function extractPrice(priceStr) {
  return parseFloat(priceStr.replace(/[^\d.]/g, '')) || 999999;
}

function getMockProducts(query, market, cheaper = false, offset = 0) {
  const currencies = { SA: 'ر.س', AE: 'د.إ', EG: 'ج.م', US: '$', CA: 'C$' };
  const currency   = currencies[market] || 'ر.س';
  const prices     = cheaper ? [89, 129, 69] : [299, 199, 399];
  const badges     = cheaper
    ? ['الأرخص', 'قيمة ممتازة', 'توفير ٦٠٪']
    : ['الأكثر مبيعاً', 'سعر مميز', 'جودة عالية'];
  const images = [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300&h=300&fit=crop',
  ];
  return [0, 1, 2].map(i => ({
    id:     `${offset}-${i}`,
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
// Content API (نصائح + مقالات + عروض)
// ────────────────────────────────────
const fs   = require('fs');
const DATA_FILE = process.env.DATA_PATH
  ? require('path').join(process.env.DATA_PATH, 'content.json')
  : require('path').join(__dirname, 'data', 'content.json');

const DEFAULT_CONTENT = {
  tips:         { ar:[], en:[], de:[] },
  blog:         { ar:{travel:[],shop:[]}, en:{travel:[],shop:[]}, de:{travel:[],shop:[]} },
  manual_deals: { travel:[], shop:[] },
};

function readContent() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch(e) { console.error('content read:', e.message); }
  return DEFAULT_CONTENT;
}

function writeContent(data) {
  try {
    const dir = require('path').dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive:true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch(e) { console.error('content write:', e.message); return false; }
}

// GET — عام (للفرونت)
app.get('/api/admin/content', (req, res) => {
  res.json(readContent());
});

// POST — أدمن فقط
app.post('/api/admin/content', (req, res) => {
  const pass = req.headers['x-admin-password'];
  if (pass !== (process.env.ADMIN_PASSWORD || 'fetchli2026')) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  const { type, data } = req.body;
  if (!type || !data) return res.status(400).json({ error: 'type و data مطلوبان' });

  const content = readContent();
  if      (type === 'tips')  content.tips         = data;
  else if (type === 'blog')  content.blog         = data;
  else if (type === 'deals') content.manual_deals = data;
  else return res.status(400).json({ error: 'نوع غير معروف' });

  writeContent(content)
    ? res.json({ ok:true })
    : res.status(500).json({ error: 'فشل الحفظ — تحقق من Render Disk' });
});

// ────────────────────────────────────
// تشغيل السيرفر
// ────────────────────────────────────
// ── Admin Panel Route ──
app.get('/admin', (req, res) => {
  const token = req.query.token;
  if (token !== (process.env.ADMIN_PASSWORD || 'fetchli2026')) {
    return res.status(401).send(`<html><body style="font-family:sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px"><div style="font-size:32px">🔒</div><div>غير مصرح</div></body></html>`);
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ────────────────────────────────────
// تشغيل السيرفر
// ────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`✅ fetchli.shop server running on port ${config.PORT}`);
});
