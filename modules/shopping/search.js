// ===================================
// fetchli.shop — البحث في متاجر التسوق
// ===================================
// AliExpress (3 منتجات) + Amazon Rainforest (3 منتجات) = 6 نتائج
// تحويل العملة تلقائي حسب الدولة

const fetch  = require('node-fetch');
const crypto = require('crypto');
const { deduplicateProducts, extractPrice } = require('../../shared/helpers');

// ────────────────────────────────────
// العملات
// ────────────────────────────────────
const CURRENCY_CONFIG = {
  SA: { code: 'SAR', symbol: 'ر.س',  rate: 3.75  },
  AE: { code: 'AED', symbol: 'د.إ',  rate: 3.67  },
  KW: { code: 'KWD', symbol: 'د.ك',  rate: 0.31  },
  QA: { code: 'QAR', symbol: 'ر.ق',  rate: 3.64  },
  BH: { code: 'BHD', symbol: 'د.ب',  rate: 0.38  },
  OM: { code: 'OMR', symbol: 'ر.ع',  rate: 0.38  },
  EG: { code: 'EGP', symbol: 'ج.م',  rate: 48.5  },
  GB: { code: 'GBP', symbol: '£',    rate: 0.79  },
  DE: { code: 'EUR', symbol: '€',    rate: 0.92  },
  FR: { code: 'EUR', symbol: '€',    rate: 0.92  },
  PK: { code: 'PKR', symbol: '₨',    rate: 278   },
  US: { code: 'USD', symbol: '$',    rate: 1.0   },
  CA: { code: 'CAD', symbol: 'C$',   rate: 1.36  },
};

// Cache أسعار الصرف — يتجدد كل 24 ساعة
let ratesCache = { rates: null, lastFetch: 0 };

async function getLiveRates() {
  const now = Date.now();
  if (ratesCache.rates && (now - ratesCache.lastFetch) < 24 * 60 * 60 * 1000) {
    return ratesCache.rates;
  }
  try {
    const res  = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 5000 });
    const data = await res.json();
    if (data.rates) {
      ratesCache = { rates: data.rates, lastFetch: now };
      console.log('✅ Exchange rates updated');
      return data.rates;
    }
  } catch (err) {
    console.warn('Exchange rate fetch failed:', err.message);
  }
  return null;
}

async function convertPrice(usdPrice, country = 'SA') {
  const cfg  = CURRENCY_CONFIG[country] || CURRENCY_CONFIG['US'];
  let rate   = cfg.rate;
  const live = await getLiveRates();
  if (live && live[cfg.code]) rate = live[cfg.code];
  return `${(usdPrice * rate).toFixed(0)} ${cfg.symbol}`;
}

// ────────────────────────────────────
// تبسيط كلمة البحث لـ AliExpress
// يأخذ أول 3 كلمات فقط — AliExpress حساس للجمل الطويلة
// ────────────────────────────────────
function simplifyQuery(query) {
  return query.trim().split(/\s+/).slice(0, 3).join(' ');
}

// ────────────────────────────────────
// AliExpress Affiliate API
// ────────────────────────────────────
function buildAliSignature(params, secret) {
  const sorted = Object.keys(params).sort();
  const str    = secret + sorted.map(k => `${k}${params[k]}`).join('') + secret;
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

function getAliMarketConfig(market) {
  const map = {
    SA: { language: 'ar', currency: 'USD' },
    AE: { language: 'ar', currency: 'USD' },
    EG: { language: 'ar', currency: 'USD' },
    DE: { language: 'de', currency: 'USD' },
    GB: { language: 'en', currency: 'USD' },
    PK: { language: 'en', currency: 'USD' },
    US: { language: 'en', currency: 'USD' },
  };
  return map[market] || map['US'];
}

/**
 * يبحث في AliExpress ويرجع أفضل 3 منتجات
 */
async function searchAliExpress(queries, market = 'SA') {
  const APP_KEY    = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
  if (!APP_KEY || !APP_SECRET) return [];

  const marketCfg = getAliMarketConfig(market);
  let allResults  = [];

  for (const rawQuery of queries.slice(0, 3)) {
    if (allResults.length >= 3) break;

    // بسّط الكلمة قبل إرسالها
    const query = simplifyQuery(rawQuery);
    if (!query) continue;

    try {
      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const params = {
        method:          'aliexpress.affiliate.product.query',
        app_key:         APP_KEY,
        timestamp,
        sign_method:     'md5',
        v:               '2.0',
        format:          'json',
        keywords:        query,
        page_no:         '1',
        page_size:       '6',
        sort:            'LAST_VOLUME_DESC',
        target_currency: marketCfg.currency,
        target_language: marketCfg.language,
        tracking_id:     process.env.ALIEXPRESS_TRACKING_ID || 'fetchli',
      };
      params.sign = buildAliSignature(params, APP_SECRET);

      const url  = `https://api-sg.aliexpress.com/sync?${new URLSearchParams(params)}`;
      const res  = await fetch(url, { timeout: 10000 });
      const data = await res.json();

      const items = data?.aliexpress_affiliate_product_query_response
        ?.resp_result?.result?.products?.product || [];

      if (!items.length) {
        console.log(`AliExpress: no results for "${query}"`);
        continue;
      }

      console.log(`AliExpress: ${items.length} results for "${query}"`);

      const products = await Promise.all(
        items
          .filter(item => item.product_main_image_url)
          .slice(0, 3)
          .map(async (item, i) => {
            const usdPrice = parseFloat(item.target_sale_price || item.target_original_price || 0);
            if (usdPrice <= 0 || usdPrice > 50000) return null;

            return {
              id:     `ali-${item.product_id}`,
              name:   (item.product_title || query).slice(0, 70),
              price:  await convertPrice(usdPrice, market),
              store:  'AliExpress',
              image:  item.product_main_image_url,
              url:    item.promotion_link || `https://aliexpress.com/item/${item.product_id}.html`,
              badge:  i === 0 ? '🏷️ AliExpress' : '',
              rating: item.evaluate_rate
                ? (parseFloat(item.evaluate_rate) / 20).toFixed(1)
                : (4 + Math.random() * 0.9).toFixed(1),
              source: 'aliexpress',
            };
          })
      );

      allResults.push(...products.filter(Boolean));

    } catch (err) {
      console.error(`AliExpress error for "${rawQuery}":`, err.message);
    }
  }

  // أرجع أفضل 3
  return deduplicateProducts(allResults).slice(0, 3);
}

// ────────────────────────────────────
// Rainforest API — Amazon
// ────────────────────────────────────
const RAINFOREST_DOMAINS = {
  SA: 'amazon.sa', AE: 'amazon.ae', EG: 'amazon.eg',
  US: 'amazon.com', CA: 'amazon.ca', GB: 'amazon.co.uk', DE: 'amazon.de',
};

/**
 * يبحث في Amazon ويرجع أفضل 3 منتجات
 */
async function searchRainforest(queries, market = 'SA') {
  const API_KEY = process.env.RAINFOREST_API_KEY;
  if (!API_KEY) return [];

  const domain     = RAINFOREST_DOMAINS[market] || RAINFOREST_DOMAINS['SA'];
  let allResults   = [];

  for (const query of queries.slice(0, 2)) {
    if (allResults.length >= 3) break;
    if (!query?.trim()) continue;

    try {
      const url  = `https://api.rainforestapi.com/request?api_key=${API_KEY}&type=search&amazon_domain=${domain}&search_term=${encodeURIComponent(query)}&sort_by=featured&output=json`;
      const res  = await fetch(url, { timeout: 12000 });
      const data = await res.json();

      const results = data?.search_results || [];
      if (!results.length) {
        console.log(`Rainforest: no results for "${query}"`);
        continue;
      }

      console.log(`Rainforest: ${results.length} results for "${query}"`);

      const products = await Promise.all(
        results
          .filter(item => item.image && item.prices?.length > 0)
          .slice(0, 3)
          .map(async (item, i) => {
            const usdPrice = item.prices?.[0]?.value || 0;
            return {
              id:     `amz-${item.asin || i}`,
              name:   (item.title || query).slice(0, 70),
              price:  usdPrice > 0
                ? await convertPrice(usdPrice, market)
                : item.prices?.[0]?.raw || 'تحقق من السعر',
              store:  `Amazon ${market}`,
              image:  item.image,
              url:    item.link || `https://www.${domain}/s?k=${encodeURIComponent(query)}`,
              badge:  i === 0 ? '🏆 Amazon' : item.is_best_seller ? '🔥 الأكثر مبيعاً' : '',
              rating: item.rating ? String(item.rating) : (4 + Math.random() * 0.9).toFixed(1),
              source: 'amazon',
            };
          })
      );

      allResults.push(...products.filter(Boolean));

    } catch (err) {
      console.error(`Rainforest error for "${query}":`, err.message);
    }
  }

  return deduplicateProducts(allResults).slice(0, 3);
}

// ────────────────────────────────────
// Mock — عند فشل الكل
// ────────────────────────────────────
async function getMockProducts(query, market, cheaper = false) {
  const cfg = CURRENCY_CONFIG[market] || CURRENCY_CONFIG['SA'];
  const live = await getLiveRates();
  const rate = (live && live[cfg.code]) ? live[cfg.code] : cfg.rate;

  const aliPrices = cheaper ? [69, 89, 49]   : [199, 149, 299];
  const amzPrices = cheaper ? [89, 109, 79]  : [249, 199, 349];

  const aliProducts = [0, 1, 2].map(i => ({
    id:     `mock-ali-${i}`,
    name:   `${query} - AliExpress ${i + 1}`,
    price:  `${Math.round(aliPrices[i] * rate)} ${cfg.symbol}`,
    store:  'AliExpress',
    image:  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
    url:    `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}`,
    badge:  i === 0 ? '🏷️ AliExpress' : '',
    rating: (4 + Math.random() * 0.9).toFixed(1),
    source: 'mock',
  }));

  const amzProducts = [0, 1, 2].map(i => ({
    id:     `mock-amz-${i}`,
    name:   `${query} - Amazon ${i + 1}`,
    price:  `${Math.round(amzPrices[i] * rate)} ${cfg.symbol}`,
    store:  `Amazon ${market}`,
    image:  'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&h=300&fit=crop',
    url:    `https://www.amazon.sa/s?k=${encodeURIComponent(query)}`,
    badge:  i === 0 ? '🏆 Amazon' : '',
    rating: (4 + Math.random() * 0.9).toFixed(1),
    source: 'mock',
  }));

  return [...aliProducts, ...amzProducts];
}

// ────────────────────────────────────
// البحث الرئيسي
// يشغل AliExpress و Amazon بالتوازي
// ────────────────────────────────────
/**
 * @param {string[]} queries
 * @param {string}   market
 * @param {boolean}  wantCheaper
 * @returns {{ products: Array, mock: boolean, source: string }}
 */
async function searchProducts(queries, market = 'SA', wantCheaper = false) {
  const validTerms = (queries || []).filter(q => q && q.trim().length > 1);

  if (validTerms.length === 0) {
    const mock = await getMockProducts('products', market, false);
    return { products: mock, mock: true, source: 'mock' };
  }

  // ── شغّل AliExpress و Amazon بالتوازي ──
  console.log(`🔍 Searching: "${validTerms[0]}" | market: ${market}`);

  const [aliResults, amzResults] = await Promise.allSettled([
    searchAliExpress(validTerms, market),
    searchRainforest(validTerms, market),
  ]);

  const aliProducts = aliResults.status === 'fulfilled' ? aliResults.value : [];
  const amzProducts = amzResults.status === 'fulfilled' ? amzResults.value : [];

  console.log(`📦 AliExpress: ${aliProducts.length} | Amazon: ${amzProducts.length}`);

  // لو كلاهما فشل → mock
  if (!aliProducts.length && !amzProducts.length) {
    console.log('Both APIs failed — using mock');
    const mock = await getMockProducts(validTerms[0], market, wantCheaper);
    return { products: mock, mock: true, source: 'mock' };
  }

  // ادمج: 3 من AliExpress + 3 من Amazon
  // لو أحدهم فاشل كمّل من الآخر
  let combined = [];

  if (aliProducts.length >= 3 && amzProducts.length >= 3) {
    // الحالة المثالية: 3 + 3
    combined = [...aliProducts.slice(0, 3), ...amzProducts.slice(0, 3)];
  } else if (aliProducts.length > 0 && amzProducts.length > 0) {
    // أكمل من الآخر لو ناقص
    const aliCount = Math.min(aliProducts.length, 3);
    const amzCount = Math.min(amzProducts.length, 6 - aliCount);
    combined = [...aliProducts.slice(0, aliCount), ...amzProducts.slice(0, amzCount)];
  } else {
    // واحد فقط يشتغل — خذ 6 منه
    combined = aliProducts.length > 0
      ? aliProducts.slice(0, 6)
      : amzProducts.slice(0, 6);
  }

  // ترتيب حسب السعر لو أرخص
  if (wantCheaper) {
    combined.sort((a, b) => extractPrice(a.price) - extractPrice(b.price));
  }

  const source = aliProducts.length > 0 && amzProducts.length > 0
    ? 'aliexpress+amazon'
    : aliProducts.length > 0 ? 'aliexpress' : 'amazon';

  console.log(`✅ Final: ${combined.length} products | source: ${source}`);
  return { products: combined, mock: false, source };
}

module.exports = { searchProducts, searchAliExpress, searchRainforest, convertPrice };
