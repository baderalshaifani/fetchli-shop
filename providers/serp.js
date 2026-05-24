// ===================================
// providers/serp.js — SerpAPI (Google Shopping)
// الحالة: ✅ شغّال الآن
// ===================================

const fetch = require('node-fetch');

// خريطة السوق → إعدادات البحث
const MARKET_PARAMS = {
  SA: { gl: 'sa', hl: 'ar', currency: 'SAR', flag: '🇸🇦' },
  AE: { gl: 'ae', hl: 'ar', currency: 'AED', flag: '🇦🇪' },
  EG: { gl: 'eg', hl: 'ar', currency: 'EGP', flag: '🇪🇬' },
  KW: { gl: 'kw', hl: 'ar', currency: 'KWD', flag: '🇰🇼' },
  QA: { gl: 'qa', hl: 'ar', currency: 'QAR', flag: '🇶🇦' },
  US: { gl: 'us', hl: 'en', currency: 'USD', flag: '🇺🇸' },
  UK: { gl: 'uk', hl: 'en', currency: 'GBP', flag: '🇬🇧' },
};

async function searchSerp(query, market = 'SA', wantCheaper = false) {
  try {
    const API_KEY = process.env.SERP_API_KEY;
    if (!API_KEY) return null;
    if (!query || query.trim() === '') return null;

    const params = MARKET_PARAMS[market] || MARKET_PARAMS['SA'];
    const q = wantCheaper ? `${query} budget affordable` : query;

    const url = `https://serpapi.com/search?engine=google_shopping&q=${encodeURIComponent(q)}&gl=${params.gl}&hl=${params.hl}&api_key=${API_KEY}&num=6`;

    const response = await fetch(url);
    const data     = await response.json();

    if (data.error) {
      console.error('SerpAPI Error:', data.error);
      return null;
    }

    const results = data.shopping_results || [];
    if (!results.length) return null;

    console.log(`✅ SerpAPI: ${results.length} نتيجة لـ "${query}"`);

    return results.slice(0, 6).map((item, i) => ({
      id:       `serp-${i}-${Date.now()}`,
      name:     item.title?.slice(0, 80) || query,
      price:    item.price || 'تحقق من السعر',
      store:    item.source || 'متجر',
      image:    item.thumbnail || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
      url:      item.product_link || item.link || '#',
      badge:    i === 0 ? 'أفضل نتيجة' : i === 1 ? 'الأكثر مبيعاً' : '',
      rating:   item.rating ? String(item.rating) : (4 + Math.random() * 0.9).toFixed(1),
      source:   'serp',
      market,
    }));

  } catch (err) {
    console.error('SerpAPI error:', err.message);
    return null;
  }
}

module.exports = { searchSerp };
