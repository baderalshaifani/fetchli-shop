// ===================================
// providers/noon.js — Noon Affiliate
// الحالة: 🔴 معطّل
// التفعيل: سجّل على noon.com/ae-en/sell
// الأسواق: SA, AE, EG
// ===================================

// ════════════════════════════════════
// 🔴 لتفعيله: غيّر إلى true
// ════════════════════════════════════
const NOON_ENABLED = false;

const fetch = require('node-fetch');

const NOON_MARKETS = {
  SA: { host: 'https://www.noon.com/saudi-ar', apiKey: process.env.NOON_SA_KEY || '', lang: 'ar', currency: 'SAR' },
  AE: { host: 'https://www.noon.com/uae-ar',   apiKey: process.env.NOON_AE_KEY || '', lang: 'ar', currency: 'AED' },
  EG: { host: 'https://www.noon.com/egypt-ar', apiKey: process.env.NOON_EG_KEY || '', lang: 'ar', currency: 'EGP' },
};

async function searchNoon(query, market = 'SA', wantCheaper = false) {

  if (!NOON_ENABLED) {
    console.log('🔴 Noon API معطّل');
    return null;
  }

  try {
    const m = NOON_MARKETS[market] || NOON_MARKETS['SA'];
    if (!m.apiKey) {
      console.error(`❌ Noon ${market}: API Key ناقص`);
      return null;
    }

    const sort = wantCheaper ? 'price_asc' : 'popularity';
    const url  = `https://api.noon.com/catalog/v3/search?q=${encodeURIComponent(query)}&sort=${sort}&limit=6&lang=${m.lang}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${m.apiKey}`,
        'Accept-Language': m.lang,
      }
    });
    const data = await response.json();

    const items = data?.hits || data?.results || [];
    if (!items.length) return null;

    console.log(`✅ Noon ${market}: ${items.length} منتج لـ "${query}"`);

    return items.map((item, i) => ({
      id:      `noon-${market}-${item.sku || i}`,
      name:    item.name?.slice(0, 80) || query,
      price:   `${item.price?.now || ''} ${m.currency}`,
      oldPrice: item.price?.was ? `${item.price.was} ${m.currency}` : null,
      store:   `Noon ${market}`,
      image:   item.image_url || item.thumbnail || '',
      url:     `${m.host}/p/${item.sku || ''}`,
      badge:   i === 0 ? '🟡 Noon' : '',
      rating:  item.rating ? String(item.rating) : null,
      reviews: item.review_count ? `${item.review_count} تقييم` : null,
      source:  'noon',
      market,
    }));

  } catch (err) {
    console.error('Noon API error:', err.message);
    return null;
  }
}

module.exports = { searchNoon, NOON_ENABLED };
