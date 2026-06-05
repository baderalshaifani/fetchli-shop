// ===================================
// fetchli.shop — عروض التسوق
// ===================================
// Rainforest API → Amazon Best Sellers
// Cache: 8 ساعات

const fetch = require('node-fetch');
const { convertPrice } = require('./search');

// ────────────────────────────────────
// Cache
// ────────────────────────────────────
const cache = {};
const CACHE_TTL = 8 * 60 * 60 * 1000; // 8 ساعات

function getCached(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL) { delete cache[key]; return null; }
  return entry.data;
}

function setCached(key, data) {
  cache[key] = { data, time: Date.now() };
}

// ────────────────────────────────────
// إعدادات Amazon حسب السوق
// ────────────────────────────────────
const AMAZON_CONFIG = {
  SA: { domain: 'amazon.sa',     category: 'bestsellers',      lang: 'ar' },
  AE: { domain: 'amazon.ae',     category: 'bestsellers',      lang: 'ar' },
  EG: { domain: 'amazon.eg',     category: 'bestsellers',      lang: 'ar' },
  GB: { domain: 'amazon.co.uk',  category: 'bestsellers',      lang: 'en' },
  DE: { domain: 'amazon.de',     category: 'bestsellers',      lang: 'de' },
  US: { domain: 'amazon.com',    category: 'bestsellers',      lang: 'en' },
  CA: { domain: 'amazon.ca',     category: 'bestsellers',      lang: 'en' },
};

// فئات متنوعة للعروض
const CATEGORIES = [
  { id: 'bestsellers',                    label: '🔥 الأكثر مبيعاً' },
  { id: 'boost-fashion-deals',            label: '👗 أزياء'         },
  { id: 'electronics',                    label: '📱 إلكترونيات'    },
  { id: 'boost-beauty-deals',             label: '✨ جمال وعناية'   },
];

// ────────────────────────────────────
// جلب Best Sellers من Rainforest
// ────────────────────────────────────
async function fetchBestSellers(market = 'SA', categoryId = 'bestsellers') {
  const API_KEY = process.env.RAINFOREST_API_KEY;
  if (!API_KEY) { console.warn('RAINFOREST_API_KEY not set'); return null; }

  const cfg = AMAZON_CONFIG[market] || AMAZON_CONFIG['SA'];
  const url = `https://api.rainforestapi.com/request?api_key=${API_KEY}&type=best_sellers&amazon_domain=${cfg.domain}&category_id=${categoryId}&output=json`;

  try {
    const res  = await fetch(url, { timeout: 12000 });
    const data = await res.json();

    const items = data?.best_sellers || [];
    if (!items.length) { console.log(`Rainforest deals: no results for ${market}/${categoryId}`); return null; }

    console.log(`Rainforest deals: ${items.length} items for ${market}/${categoryId}`);

    // تحويل للفورمات الموحد
    const products = await Promise.all(
      items
        .filter(item => item.image && item.price?.value)
        .slice(0, 4)
        .map(async (item, i) => {
          const usdPrice = item.price?.value || 0;
          return {
            id:       `deal-amz-${item.asin || i}`,
            name:     (item.title || '').slice(0, 60),
            price:    usdPrice > 0 ? await convertPrice(usdPrice, market) : item.price?.raw || '',
            image:    item.image,
            url:      item.link || `https://www.${cfg.domain}/dp/${item.asin}`,
            badge:    i === 0 ? '🏆 الأكثر مبيعاً' : item.badge || '',
            rating:   item.rating ? String(item.rating) : null,
            savings:  item.price?.savings?.percentage ? `${item.price.savings.percentage}%` : null,
            store:    `Amazon ${market}`,
            source:   'amazon',
          };
        })
    );

    return products.filter(Boolean);

  } catch (err) {
    console.error('Rainforest deals error:', err.message);
    return null;
  }
}

// ────────────────────────────────────
// جلب عروض متنوعة من فئات مختلفة
// ────────────────────────────────────
async function getShoppingDeals(market = 'SA') {
  const cacheKey = `deals-shop-${market}`;
  const cached   = getCached(cacheKey);
  if (cached) { console.log(`✅ Shopping deals from cache: ${market}`); return cached; }

  let allDeals = [];

  // جرب فئتين للحصول على تنوع
  for (const cat of CATEGORIES.slice(0, 2)) {
    if (allDeals.length >= 4) break;
    const results = await fetchBestSellers(market, cat.id);
    if (results?.length) {
      // أضف label الفئة
      results.forEach(p => { if (!p.badge) p.badge = cat.label; });
      allDeals.push(...results);
    }
  }

  // deduplicate
  const seen = new Set();
  allDeals = allDeals.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  }).slice(0, 4);

  if (allDeals.length > 0) {
    setCached(cacheKey, allDeals);
    console.log(`✅ Shopping deals cached: ${allDeals.length} for ${market}`);
    return allDeals;
  }

  // Fallback: بيانات ثابتة لو API فشل
  console.log('Rainforest deals failed — using static fallback');
  return null;
}

module.exports = { getShoppingDeals };
