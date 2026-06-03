// ===================================
// fetchli.shop — البحث في المتاجر
// ===================================
// SerpAPI (Google Shopping) + Mock fallback

const fetch                               = require('node-fetch');
const { deduplicateProducts, extractPrice } = require('../../shared/helpers');

// ────────────────────────────────────
// SerpAPI — Google Shopping
// ────────────────────────────────────
const MARKET_PARAMS = {
  SA: 'gl=sa&hl=ar',
  AE: 'gl=ae&hl=ar',
  EG: 'gl=eg&hl=ar',
  US: 'gl=us&hl=en',
  CA: 'gl=ca&hl=en',
};

/**
 * يبحث في Google Shopping بـ SerpAPI
 * @param {string} query
 * @param {string} market  SA | AE | EG | US | CA
 * @returns {Array|null}
 */
async function searchWithGoogle(query, market = 'SA') {
  try {
    const API_KEY = process.env.SERP_API_KEY;
    if (!API_KEY) {
      console.warn('SERP_API_KEY not set');
      return null;
    }

    if (!query || query.trim() === '') {
      console.error('SerpAPI: empty query');
      return null;
    }

    const params = MARKET_PARAMS[market] || MARKET_PARAMS['SA'];
    const url    = `https://serpapi.com/search?engine=google_shopping&q=${encodeURIComponent(query)}&${params}&api_key=${API_KEY}&num=6`;

    const response = await fetch(url);
    const data     = await response.json();

    if (data.error) {
      console.error('SerpAPI Error:', data.error);
      return null;
    }

    const results = data.shopping_results || [];
    console.log(`SerpAPI: ${results.length} results for "${query}"`);
    if (!results.length) return null;

    return results.slice(0, 6).map((item, i) => ({
      id:     `s-${i}-${Date.now()}`,
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
// Mock — بيانات تجريبية عند فشل API
// ────────────────────────────────────
const CURRENCIES = { SA: 'ر.س', AE: 'د.إ', EG: 'ج.م', US: '$', CA: 'C$' };
const MOCK_IMAGES = [
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&h=300&fit=crop',
  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300&h=300&fit=crop',
];

function getMockProducts(query, market, cheaper = false, offset = 0) {
  const currency = CURRENCIES[market] || 'ر.س';
  const prices   = cheaper ? [89, 129, 69] : [299, 199, 399];
  const badges   = cheaper
    ? ['الأرخص', 'قيمة ممتازة', 'توفير ٦٠٪']
    : ['الأكثر مبيعاً', 'سعر مميز', 'جودة عالية'];

  return [0, 1, 2].map(i => ({
    id:     `mock-${offset}-${i}`,
    name:   `${query} ${i + 1}`,
    price:  `${prices[i]} ${currency}`,
    store:  `Amazon ${market}`,
    image:  MOCK_IMAGES[i % MOCK_IMAGES.length],
    url:    `https://www.amazon.sa/s?k=${encodeURIComponent(query)}`,
    badge:  badges[i],
    rating: (4 + Math.random() * 0.9).toFixed(1),
    source: 'mock',
  }));
}

// ────────────────────────────────────
// البحث الرئيسي — يجمع SerpAPI + Mock
// ────────────────────────────────────
/**
 * @param {string[]} queries      — قائمة كلمات البحث من Claude
 * @param {string}   market       — SA | AE | EG | US
 * @param {boolean}  wantCheaper  — هل يريد الأرخص؟
 * @returns {{ products: Array, mock: boolean, source: string }}
 */
async function searchProducts(queries, market = 'SA', wantCheaper = false) {
  // Emergency fallback لو كل الـ queries فارغة
  const validTerms = (queries || []).filter(q => q && q.trim().length > 0);

  if (validTerms.length === 0) {
    console.log('All queries empty — using generic fallback');
    const fallback = await searchWithGoogle('trending products', market);
    if (fallback?.length) return { products: fallback.slice(0, 6), mock: false, source: 'serp' };
    return { products: getMockProducts('products', market, false, 0), mock: true, source: 'mock' };
  }

  // جرب SerpAPI بأول 3 queries
  let allProducts = [];
  for (const q of validTerms.slice(0, 3)) {
    const results = await searchWithGoogle(
      wantCheaper ? `${q} budget affordable` : q,
      market
    );
    if (results?.length) allProducts.push(...results);
  }

  if (allProducts.length > 0) {
    const unique = deduplicateProducts(allProducts);
    const sorted = wantCheaper
      ? unique.sort((a, b) => extractPrice(a.price) - extractPrice(b.price))
      : unique;
    console.log(`Search done: ${sorted.length} products for "${validTerms[0]}"`);
    return { products: sorted.slice(0, 6), mock: false, source: 'google' };
  }

  // Fallback: mock
  console.log('SerpAPI failed — using mock data');
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

module.exports = { searchProducts, searchWithGoogle, getMockProducts };
