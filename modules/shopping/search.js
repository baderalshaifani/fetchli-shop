// ===================================
// fetchli.shop — البحث في متاجر التسوق
// ===================================
// AliExpress Affiliate API (أساسي)
// Rainforest API / Amazon (fallback)
// تحويل العملة تلقائي حسب الدولة

const fetch = require('node-fetch');
const crypto = require('crypto');
const { deduplicateProducts, extractPrice } = require('../../shared/helpers');

// ────────────────────────────────────
// إعدادات العملات
// ────────────────────────────────────
const CURRENCY_CONFIG = {
  SA: { code: 'SAR', symbol: 'ر.س', rate: 3.75 },
  AE: { code: 'AED', symbol: 'د.إ', rate: 3.67 },
  KW: { code: 'KWD', symbol: 'د.ك', rate: 0.31 },
  QA: { code: 'QAR', symbol: 'ر.ق', rate: 3.64 },
  BH: { code: 'BHD', symbol: 'د.ب', rate: 0.38 },
  OM: { code: 'OMR', symbol: 'ر.ع', rate: 0.38 },
  EG: { code: 'EGP', symbol: 'ج.م', rate: 48.5  },
  GB: { code: 'GBP', symbol: '£',   rate: 0.79  },
  DE: { code: 'EUR', symbol: '€',   rate: 0.92  },
  FR: { code: 'EUR', symbol: '€',   rate: 0.92  },
  PK: { code: 'PKR', symbol: '₨',   rate: 278   },
  US: { code: 'USD', symbol: '$',   rate: 1.0   },
  CA: { code: 'CAD', symbol: 'C$',  rate: 1.36  },
};

// Cache أسعار الصرف — يتجدد كل 24 ساعة
let ratesCache = { rates: null, lastFetch: 0 };

/**
 * جلب أسعار الصرف المحدثة من API مجاني
 * لو فشل يرجع للأسعار الثابتة
 */
async function getLiveRates() {
  const now = Date.now();
  const AGE = 24 * 60 * 60 * 1000; // 24 ساعة

  if (ratesCache.rates && (now - ratesCache.lastFetch) < AGE) {
    return ratesCache.rates;
  }

  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      timeout: 5000,
    });
    const data = await res.json();
    if (data.rates) {
      ratesCache = { rates: data.rates, lastFetch: now };
      console.log('✅ Exchange rates updated');
      return data.rates;
    }
  } catch (err) {
    console.warn('Exchange rate fetch failed, using static rates:', err.message);
  }

  return null; // يرجع للأسعار الثابتة
}

/**
 * تحويل السعر من USD إلى عملة الدولة
 * @param {number} usdPrice
 * @param {string} country  SA | AE | DE | ...
 * @returns {string} "299 ر.س"
 */
async function convertPrice(usdPrice, country = 'SA') {
  const cfg = CURRENCY_CONFIG[country] || CURRENCY_CONFIG['US'];
  let rate = cfg.rate;

  // حاول الحصول على سعر صرف محدث
  const liveRates = await getLiveRates();
  if (liveRates && liveRates[cfg.code]) {
    rate = liveRates[cfg.code];
  }

  const converted = (usdPrice * rate).toFixed(0);
  return `${converted} ${cfg.symbol}`;
}

// ────────────────────────────────────
// AliExpress Affiliate API
// ────────────────────────────────────

/**
 * يبني signature للـ AliExpress API
 */
function buildAliSignature(params, secret) {
  const sorted = Object.keys(params).sort();
  const str = secret + sorted.map(k => `${k}${params[k]}`).join('') + secret;
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

/**
 * يحدد language و currency حسب السوق
 */
function getAliMarketConfig(market) {
  const configs = {
    SA: { language: 'ar',  currency: 'USD', site: 'glo' },
    AE: { language: 'ar',  currency: 'USD', site: 'glo' },
    EG: { language: 'ar',  currency: 'USD', site: 'glo' },
    DE: { language: 'de',  currency: 'USD', site: 'glo' },
    GB: { language: 'en',  currency: 'USD', site: 'glo' },
    PK: { language: 'en',  currency: 'USD', site: 'glo' },
    US: { language: 'en',  currency: 'USD', site: 'glo' },
  };
  return configs[market] || configs['US'];
}

/**
 * البحث في AliExpress Affiliate API
 * @param {string} query
 * @param {string} market
 * @returns {Array|null}
 */
async function searchAliExpress(query, market = 'SA') {
  try {
    const APP_KEY    = process.env.ALIEXPRESS_APP_KEY;
    const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;

    if (!APP_KEY || !APP_SECRET) {
      console.warn('AliExpress keys not set');
      return null;
    }

    if (!query || query.trim() === '') return null;

    const marketCfg = getAliMarketConfig(market);
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const params = {
      method:           'aliexpress.affiliate.product.query',
      app_key:          APP_KEY,
      timestamp,
      sign_method:      'md5',
      v:                '2.0',
      format:           'json',
      keywords:         query,
      page_no:          '1',
      page_size:        '8',
      sort:             'LAST_VOLUME_DESC',  // الأكثر مبيعاً أولاً
      target_currency:  marketCfg.currency,
      target_language:  marketCfg.language,
      tracking_id:      process.env.ALIEXPRESS_TRACKING_ID || 'fetchli',
    };

    params.sign = buildAliSignature(params, APP_SECRET);

    const url = `https://api-sg.aliexpress.com/sync?${new URLSearchParams(params)}`;
    const res  = await fetch(url, { timeout: 10000 });
    const data = await res.json();

    // استخرج النتائج
    const resp = data?.aliexpress_affiliate_product_query_response;
    const items = resp?.resp_result?.result?.products?.product || [];

    if (!items.length) {
      console.log(`AliExpress: no results for "${query}"`);
      return null;
    }

    console.log(`AliExpress: ${items.length} results for "${query}"`);

    // تحويل الأسعار وبناء المنتجات
    const products = await Promise.all(
      items
        .filter(item => item.product_main_image_url) // فلترة بدون صور
        .slice(0, 6)
        .map(async (item, i) => {
          const usdPrice = parseFloat(item.target_sale_price || item.target_original_price || 0);
          const price    = usdPrice > 0
            ? await convertPrice(usdPrice, market)
            : 'تحقق من السعر';

          // فلترة أسعار غريبة
          if (usdPrice > 0 && (usdPrice < 0.5 || usdPrice > 50000)) return null;

          return {
            id:     `ali-${item.product_id}-${i}`,
            name:   (item.product_title || query).slice(0, 70),
            price,
            store:  'AliExpress',
            image:  item.product_main_image_url,
            url:    item.promotion_link || item.product_detail_url || `https://aliexpress.com/item/${item.product_id}.html`,
            badge:  i === 0 ? '⭐ الأكثر مبيعاً' : item.evaluate_rate ? `${item.evaluate_rate} تقييم` : '',
            rating: item.evaluate_rate
              ? (parseFloat(item.evaluate_rate) / 20).toFixed(1)
              : (4 + Math.random() * 0.9).toFixed(1),
            source: 'aliexpress',
            sales:  item.lastest_volume || 0,
          };
        })
    );

    return products.filter(Boolean); // أحذف الـ null

  } catch (err) {
    console.error('AliExpress search error:', err.message);
    return null;
  }
}

// ────────────────────────────────────
// Rainforest API — Amazon (Fallback)
// ────────────────────────────────────

const RAINFOREST_DOMAINS = {
  SA: 'amazon.sa',
  AE: 'amazon.ae',
  EG: 'amazon.eg',
  US: 'amazon.com',
  CA: 'amazon.ca',
  GB: 'amazon.co.uk',
  DE: 'amazon.de',
};

/**
 * البحث في Amazon عبر Rainforest API
 * @param {string} query
 * @param {string} market
 * @returns {Array|null}
 */
async function searchRainforest(query, market = 'SA') {
  try {
    const API_KEY = process.env.RAINFOREST_API_KEY;
    if (!API_KEY) {
      console.warn('RAINFOREST_API_KEY not set');
      return null;
    }

    if (!query || query.trim() === '') return null;

    const domain = RAINFOREST_DOMAINS[market] || RAINFOREST_DOMAINS['SA'];
    const url = `https://api.rainforestapi.com/request?api_key=${API_KEY}&type=search&amazon_domain=${domain}&search_term=${encodeURIComponent(query)}&sort_by=featured&output=json`;

    const res  = await fetch(url, { timeout: 12000 });
    const data = await res.json();

    const results = data?.search_results || [];
    if (!results.length) {
      console.log(`Rainforest: no results for "${query}"`);
      return null;
    }

    console.log(`Rainforest: ${results.length} results for "${query}"`);

    const products = await Promise.all(
      results
        .filter(item => item.image && item.prices?.length > 0)
        .slice(0, 6)
        .map(async (item, i) => {
          const usdPrice = item.prices?.[0]?.value || 0;
          const price    = usdPrice > 0
            ? await convertPrice(usdPrice, market)
            : item.prices?.[0]?.raw || 'تحقق من السعر';

          return {
            id:     `amz-${item.asin || i}`,
            name:   (item.title || query).slice(0, 70),
            price,
            store:  `Amazon ${market}`,
            image:  item.image,
            url:    item.link || `https://www.${domain}/s?k=${encodeURIComponent(query)}`,
            badge:  i === 0 ? '🏆 أفضل نتيجة' : item.is_best_seller ? '🔥 الأكثر مبيعاً' : '',
            rating: item.rating ? String(item.rating) : (4 + Math.random() * 0.9).toFixed(1),
            source: 'amazon',
          };
        })
    );

    return products.filter(Boolean);

  } catch (err) {
    console.error('Rainforest search error:', err.message);
    return null;
  }
}

// ────────────────────────────────────
// Mock — بيانات تجريبية عند فشل الكل
// ────────────────────────────────────
function getMockProducts(query, market, cheaper = false, offset = 0) {
  const cfg      = CURRENCY_CONFIG[market] || CURRENCY_CONFIG['SA'];
  const prices   = cheaper ? [89, 129, 69] : [299, 199, 399];
  const pricesConverted = prices.map(p => `${Math.round(p * cfg.rate)} ${cfg.symbol}`);
  const badges   = cheaper
    ? ['💰 الأرخص', '✅ قيمة ممتازة', '🏷️ توفير ٦٠٪']
    : ['⭐ الأكثر مبيعاً', '🏆 الأفضل تقييماً', '🔥 عرض محدود'];
  const images = [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300&h=300&fit=crop',
  ];

  return [0, 1, 2].map(i => ({
    id:     `mock-${offset}-${i}-${Date.now()}`,
    name:   `${query} ${i + 1}`,
    price:  pricesConverted[i],
    store:  'AliExpress',
    image:  images[i % images.length],
    url:    `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}`,
    badge:  badges[i],
    rating: (4 + Math.random() * 0.9).toFixed(1),
    source: 'mock',
  }));
}

// ────────────────────────────────────
// البحث الرئيسي
// AliExpress أولاً ← Rainforest ثانياً ← Mock
// ────────────────────────────────────
/**
 * @param {string[]} queries      — كلمات البحث من Claude
 * @param {string}   market       — SA | AE | DE | US | ...
 * @param {boolean}  wantCheaper  — يريد الأرخص؟
 * @returns {{ products: Array, mock: boolean, source: string }}
 */
async function searchProducts(queries, market = 'SA', wantCheaper = false) {
  const validTerms = (queries || []).filter(q => q && q.trim().length > 1);

  // Emergency fallback
  if (validTerms.length === 0) {
    console.log('All queries empty — using fallback');
    const ali = await searchAliExpress('best sellers', market);
    if (ali?.length) return { products: ali.slice(0, 6), mock: false, source: 'aliexpress' };
    return { products: getMockProducts('products', market, false, 0), mock: true, source: 'mock' };
  }

  // ── المرحلة 1: AliExpress ──
  let allProducts = [];
  const searchLimit = Math.min(validTerms.length, 3);

  for (let i = 0; i < searchLimit; i++) {
    const q = wantCheaper ? `${validTerms[i]} budget` : validTerms[i];
    const results = await searchAliExpress(q, market);
    if (results?.length) allProducts.push(...results);
    // لو حصلنا على نتائج كافية نوقف
    if (allProducts.length >= 6) break;
  }

  if (allProducts.length > 0) {
    const unique = deduplicateProducts(allProducts);
    const sorted = wantCheaper
      ? unique.sort((a, b) => extractPrice(a.price) - extractPrice(b.price))
      : unique;
    console.log(`✅ AliExpress: ${sorted.length} products for "${validTerms[0]}"`);
    return { products: sorted.slice(0, 6), mock: false, source: 'aliexpress' };
  }

  // ── المرحلة 2: Rainforest (Amazon) fallback ──
  console.log('AliExpress failed — trying Rainforest...');
  for (let i = 0; i < searchLimit; i++) {
    const results = await searchRainforest(validTerms[i], market);
    if (results?.length) allProducts.push(...results);
    if (allProducts.length >= 6) break;
  }

  if (allProducts.length > 0) {
    const unique = deduplicateProducts(allProducts);
    const sorted = wantCheaper
      ? unique.sort((a, b) => extractPrice(a.price) - extractPrice(b.price))
      : unique;
    console.log(`✅ Rainforest: ${sorted.length} products for "${validTerms[0]}"`);
    return { products: sorted.slice(0, 6), mock: false, source: 'amazon' };
  }

  // ── المرحلة 3: Mock ──
  console.log('All APIs failed — using mock data');
  const mockAll = [];
  validTerms.slice(0, 3).forEach((q, i) => {
    mockAll.push(...getMockProducts(q, market, wantCheaper, i));
  });
  const unique = deduplicateProducts(mockAll);
  const sorted = wantCheaper
    ? unique.sort((a, b) => extractPrice(a.price) - extractPrice(b.price))
    : unique;

  return { products: sorted.slice(0, 6), mock: true, source: 'mock' };
}

module.exports = { searchProducts, searchAliExpress, searchRainforest, convertPrice };
