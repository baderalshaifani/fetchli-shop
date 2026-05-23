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

  const baseQuery = brand ? `${brand} ${guess}` : guess || labels;
  const cheaper   = wantCheaper ? 'budget affordable alternative' : '';

  return {
    productType,
    brand,
    color,
    details: objects,
    searchQueries: [
      brand ? `${brand} ${guess} ${color}`.trim() : guess,
      `${guess} ${color}`.trim(),
      `${cheaper || productType} ${color}`.trim(),
      objects || guess,
      brand || guess,
    ].filter(Boolean).slice(0, 5),
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
// Google Custom Search — نتائج حقيقية
// ────────────────────────────────────
async function searchWithGoogle(query, market = 'SA') {
  try {
    const API_KEY = process.env.GOOGLE_SEARCH_KEY;
    const CX      = process.env.GOOGLE_SEARCH_CX;
    if (!API_KEY || !CX) return null;

    // أضف السوق للبحث
    const marketSuffix = {
      SA: 'site:amazon.sa OR site:noon.com',
      AE: 'site:amazon.ae OR site:noon.com',
      EG: 'site:amazon.eg OR site:jumia.com.eg',
      US: 'site:amazon.com OR site:aliexpress.com',
    };
    const suffix = marketSuffix[market] || marketSuffix['SA'];
    const fullQuery = `${query} ${suffix}`;

    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(fullQuery)}&num=6`;

    const response = await fetch(url);
    const data     = await response.json();

    // طباعة الخطأ كاملاً للتشخيص
    if (data.error) {
      console.error('Google Search API Error:', JSON.stringify(data.error));
      return null;
    }

    console.log('Google Search success:', data.items?.length, 'results for:', query);
    if (!data.items?.length) return null;

    // حول النتائج لصيغة المنتجات
    return data.items.map((item, i) => {
      // استخرج السعر من الوصف لو موجود
      const priceMatch = item.snippet?.match(/[\$﷼ر\.س]+\s*[\d,]+|[\d,]+\s*[\$﷼]|SAR\s*[\d,]+/i);
      const price      = priceMatch ? priceMatch[0] : null;

      // حدد المتجر من الرابط
      const storeName = item.displayLink
        ?.replace('www.', '')
        ?.replace('.com', '')
        ?.replace('.sa', '')
        ?.replace('.ae', '') || 'متجر';

      // صورة المنتج
      const image = item.pagemap?.cse_image?.[0]?.src
        || item.pagemap?.product?.[0]?.image
        || `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop`;

      // السعر من pagemap
      const productPrice = item.pagemap?.offer?.[0]?.price
        || item.pagemap?.product?.[0]?.price
        || price
        || null;

      return {
        id:     `g-${i}`,
        name:   item.title?.slice(0, 60) || query,
        price:  productPrice ? `${productPrice}` : 'تحقق من السعر',
        store:  storeName,
        image,
        url:    item.link,
        badge:  i === 0 ? 'أفضل نتيجة' : i === 1 ? 'الأكثر مبيعاً' : '',
        rating: (4 + Math.random() * 0.9).toFixed(1),
        source: 'google',
      };
    }).filter(Boolean);

  } catch (err) {
    console.error('Google Search error:', err.message);
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

    // ── المرحلة ١: جرب Google Custom Search أولاً ──
    let allProducts = [];
    for (const q of searchTerms.slice(0, 3)) {
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
// تشغيل السيرفر
// ────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`✅ fetchli.shop server running on port ${config.PORT}`);
});
