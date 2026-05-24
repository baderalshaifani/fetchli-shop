// ===================================
// providers/jumia.js — Jumia Affiliate API
// الحالة: 🔴 معطّل
// التفعيل: سجّل على developer.jumia.com
// الأسواق: EG, NG, KE, MA, TN, GH, CI, SN
// ===================================

// ════════════════════════════════════
// 🔴 لتفعيله: غيّر إلى true
// ════════════════════════════════════
const JUMIA_ENABLED = false;

const fetch = require('node-fetch');

// ── إعدادات كل سوق ──────────────────
const JUMIA_MARKETS = {
  EG: { host: 'https://www.jumia.com.eg', apiKey: process.env.JUMIA_EG_KEY || '', lang: 'ar', currency: 'EGP' },
  NG: { host: 'https://www.jumia.com.ng', apiKey: process.env.JUMIA_NG_KEY || '', lang: 'en', currency: 'NGN' },
  KE: { host: 'https://www.jumia.co.ke',  apiKey: process.env.JUMIA_KE_KEY || '', lang: 'en', currency: 'KES' },
  MA: { host: 'https://www.jumia.ma',     apiKey: process.env.JUMIA_MA_KEY || '', lang: 'fr', currency: 'MAD' },
  TN: { host: 'https://www.jumia.com.tn', apiKey: process.env.JUMIA_TN_KEY || '', lang: 'fr', currency: 'TND' },
};

async function searchJumia(query, market = 'EG', wantCheaper = false) {

  if (!JUMIA_ENABLED) {
    console.log('🔴 Jumia API معطّل');
    return null;
  }

  try {
    const m = JUMIA_MARKETS[market] || JUMIA_MARKETS['EG'];
    if (!m.apiKey) {
      console.error(`❌ Jumia ${market}: API Key ناقص`);
      return null;
    }

    const sort = wantCheaper ? 'price-asc' : 'popularity';
    const url  = `${m.host}/catalog/productlist/?q=${encodeURIComponent(query)}&sort=${sort}&api_key=${m.apiKey}&limit=6&lang=${m.lang}`;

    const response = await fetch(url, {
      headers: { 'Accept-Language': m.lang }
    });
    const data = await response.json();

    const items = data?.products || data?.data?.products || [];
    if (!items.length) return null;

    console.log(`✅ Jumia ${market}: ${items.length} منتج لـ "${query}"`);

    return items.map((item, i) => ({
      id:      `jumia-${market}-${item.sku || i}`,
      name:    item.name?.slice(0, 80) || query,
      price:   `${item.price?.current_price || ''} ${m.currency}`,
      oldPrice: item.price?.old_price ? `${item.price.old_price} ${m.currency}` : null,
      store:   `Jumia ${market}`,
      image:   item.image_url || item.images?.[0] || '',
      url:     `${m.host}${item.url || ''}`,
      badge:   i === 0 ? '🌍 Jumia' : '',
      rating:  item.rating?.average ? String(item.rating.average) : null,
      reviews: item.rating?.count ? `${item.rating.count} تقييم` : null,
      source:  'jumia',
      market,
    }));

  } catch (err) {
    console.error('Jumia API error:', err.message);
    return null;
  }
}

module.exports = { searchJumia, JUMIA_ENABLED };
