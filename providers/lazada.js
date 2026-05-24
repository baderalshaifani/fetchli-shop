// ===================================
// providers/lazada.js — Lazada Affiliate API
// الحالة: 🔴 معطّل
// التفعيل: سجّل على lazada.com/affiliate
// الأسواق: SG, MY, TH, PH, ID, VN
// ===================================

// ════════════════════════════════════
// 🔴 لتفعيله: غيّر إلى true
// ════════════════════════════════════
const LAZADA_ENABLED = false;

const fetch  = require('node-fetch');
const crypto = require('crypto');

// ── إعدادات كل سوق ──────────────────
const LAZADA_MARKETS = {
  SG: { host: 'https://api.lazada.sg/rest',  siteCode: 'SG', currency: 'SGD', lang: 'en' },
  MY: { host: 'https://api.lazada.com.my/rest', siteCode: 'MY', currency: 'MYR', lang: 'en' },
  TH: { host: 'https://api.lazada.co.th/rest',  siteCode: 'TH', currency: 'THB', lang: 'th' },
  PH: { host: 'https://api.lazada.com.ph/rest',  siteCode: 'PH', currency: 'PHP', lang: 'en' },
  ID: { host: 'https://api.lazada.co.id/rest',   siteCode: 'ID', currency: 'IDR', lang: 'id' },
  VN: { host: 'https://api.lazada.vn/rest',       siteCode: 'VN', currency: 'VND', lang: 'vi' },
};

const APP_KEY    = process.env.LAZADA_APP_KEY    || '';
const APP_SECRET = process.env.LAZADA_APP_SECRET || '';
const ACCESS_TOKEN = process.env.LAZADA_ACCESS_TOKEN || '';

// ── توليد Signature ──────────────────
function generateSign(path, params) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  const message = path + sorted;
  return crypto.createHmac('sha256', APP_SECRET).update(message).digest('hex').toUpperCase();
}

async function searchLazada(query, market = 'SG', wantCheaper = false) {

  if (!LAZADA_ENABLED) {
    console.log('🔴 Lazada API معطّل');
    return null;
  }

  try {
    const m = LAZADA_MARKETS[market] || LAZADA_MARKETS['SG'];
    const path = '/products/search';
    const timestamp = Date.now().toString();

    const params = {
      app_key:      APP_KEY,
      timestamp,
      sign_method:  'sha256',
      access_token: ACCESS_TOKEN,
      q:            query,
      page:         '1',
      page_size:    '6',
      sort_by:      wantCheaper ? 'price_asc' : 'popularity',
      site_code:    m.siteCode,
    };

    params.sign = generateSign(path, params);

    const url = `${m.host}${path}?${new URLSearchParams(params)}`;
    const response = await fetch(url);
    const data     = await response.json();

    const items = data?.data?.products || [];
    if (!items.length) return null;

    console.log(`✅ Lazada ${market}: ${items.length} منتج لـ "${query}"`);

    return items.map((item, i) => ({
      id:      `lazada-${market}-${item.item_id || i}`,
      name:    item.name?.slice(0, 80) || query,
      price:   `${item.price_min || item.price} ${m.currency}`,
      oldPrice: item.original_price ? `${item.original_price} ${m.currency}` : null,
      store:   `Lazada ${market}`,
      image:   item.image || item.images?.[0] || '',
      url:     item.product_url || `https://www.lazada.${m.siteCode.toLowerCase()}/products/${item.item_id}.html`,
      badge:   i === 0 ? '🌏 Lazada' : '',
      rating:  item.rating ? String(item.rating) : null,
      reviews: item.review ? `${item.review} تقييم` : null,
      source:  'lazada',
      market,
    }));

  } catch (err) {
    console.error('Lazada API error:', err.message);
    return null;
  }
}

module.exports = { searchLazada, LAZADA_ENABLED };
