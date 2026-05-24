// ===================================
// providers/aliexpress.js — AliExpress Affiliate API
// الحالة: 🔴 معطّل
// التفعيل: سجّل على portals.aliexpress.com → Affiliate API
// ===================================

// ════════════════════════════════════
// 🔴 لتفعيله: غيّر إلى true
// ════════════════════════════════════
const ALIEXPRESS_ENABLED = false;

const fetch  = require('node-fetch');
const crypto = require('crypto');

// ── الإعدادات ────────────────────────
const CONFIG = {
  appKey:    process.env.ALIEXPRESS_APP_KEY    || '',
  appSecret: process.env.ALIEXPRESS_APP_SECRET || '',
  trackingId: process.env.ALIEXPRESS_TRACKING_ID || '',
  baseUrl:   'https://api-sg.aliexpress.com/sync',
};

// ── توليد Sign ───────────────────────
function generateSign(params, secret) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha256', secret).update(sorted).digest('hex').toUpperCase();
}

// ── البحث عن منتجات ──────────────────
async function searchAliExpress(query, market = 'SA', wantCheaper = false) {

  if (!ALIEXPRESS_ENABLED) {
    console.log('🔴 AliExpress API معطّل');
    return null;
  }

  try {
    const timestamp = Date.now().toString();

    // خريطة السوق → لغة العرض
    const langMap = {
      SA: 'ar', AE: 'ar', EG: 'ar', KW: 'ar', QA: 'ar',
      US: 'en', UK: 'en',
    };

    const params = {
      method:              'aliexpress.affiliate.product.query',
      app_key:             CONFIG.appKey,
      timestamp,
      sign_method:         'sha256',
      format:              'json',
      v:                   '2.0',
      keywords:            query,
      page_no:             '1',
      page_size:           '6',
      sort:                wantCheaper ? 'SALE_PRICE_ASC' : 'LAST_VOLUME_DESC',
      target_currency:     market === 'US' ? 'USD' : market === 'UK' ? 'GBP' : 'SAR',
      target_language:     langMap[market] || 'en',
      tracking_id:         CONFIG.trackingId,
      fields:              'product_id,product_title,product_main_image_url,sale_price,original_price,evaluate_rate,lastest_volume,promotion_link,shop_name',
    };

    params.sign = generateSign(params, CONFIG.appSecret);

    const url = `${CONFIG.baseUrl}?${new URLSearchParams(params)}`;
    const response = await fetch(url);
    const data     = await response.json();

    const items = data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
    if (!items.length) return null;

    console.log(`✅ AliExpress: ${items.length} منتج لـ "${query}"`);

    return items.map((item, i) => ({
      id:      `ali-${item.product_id}`,
      name:    item.product_title?.slice(0, 80) || query,
      price:   `${item.sale_price} ${item.sale_price_currency || 'USD'}`,
      oldPrice: item.original_price ? `${item.original_price} ${item.sale_price_currency}` : null,
      store:   'AliExpress',
      image:   item.product_main_image_url || '',
      url:     item.promotion_link || `https://www.aliexpress.com/item/${item.product_id}.html`,
      badge:   i === 0 ? '🌍 شحن عالمي' : '',
      rating:  item.evaluate_rate ? (parseFloat(item.evaluate_rate) / 20).toFixed(1) : null,
      reviews: item.lastest_volume ? `${item.lastest_volume} طلب` : null,
      source:  'aliexpress',
      market,
    }));

  } catch (err) {
    console.error('AliExpress API error:', err.message);
    return null;
  }
}

module.exports = { searchAliExpress, ALIEXPRESS_ENABLED };
