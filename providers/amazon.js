// ===================================
// providers/amazon.js — Amazon Product Advertising API
// الحالة: 🔴 معطّل — يُفعَّل بعد 3 مبيعات Affiliate
// الأسواق: SA + US + UK
// ===================================

// ════════════════════════════════════
// 🔴 لتفعيله: ابحث عن DISABLED وغيّره إلى ENABLED
// ════════════════════════════════════
const AMAZON_ENABLED = false; // 🔴 غيّر إلى true عند التفعيل

const fetch  = require('node-fetch');
const crypto = require('crypto');

// ── إعدادات كل سوق ──────────────────
const AMAZON_MARKETS = {
  SA: {
    host:       'webservices.amazon.sa',
    marketplace: 'www.amazon.sa',
    region:     'eu-west-1',
    currency:   'SAR',
    lang:       'ar_SA',
    partnerTag: process.env.AMAZON_SA_PARTNER_TAG || '',
    accessKey:  process.env.AMAZON_SA_ACCESS_KEY  || '',
    secretKey:  process.env.AMAZON_SA_SECRET_KEY  || '',
  },
  US: {
    host:       'webservices.amazon.com',
    marketplace: 'www.amazon.com',
    region:     'us-east-1',
    currency:   'USD',
    lang:       'en_US',
    partnerTag: process.env.AMAZON_US_PARTNER_TAG || '',
    accessKey:  process.env.AMAZON_US_ACCESS_KEY  || '',
    secretKey:  process.env.AMAZON_US_SECRET_KEY  || '',
  },
  UK: {
    host:       'webservices.amazon.co.uk',
    marketplace: 'www.amazon.co.uk',
    region:     'eu-west-1',
    currency:   'GBP',
    lang:       'en_GB',
    partnerTag: process.env.AMAZON_UK_PARTNER_TAG || '',
    accessKey:  process.env.AMAZON_UK_ACCESS_KEY  || '',
    secretKey:  process.env.AMAZON_UK_SECRET_KEY  || '',
  },
};

// ── توليد AWS Signature v4 ────────────
function signRequest(market, payload) {
  const m          = AMAZON_MARKETS[market];
  const now        = new Date();
  const amzDate    = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp  = amzDate.slice(0, 8);
  const service    = 'ProductAdvertisingAPI';
  const endpoint   = `https://${m.host}/paapi5/searchitems`;

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${m.host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;

  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const payloadHash   = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = `POST\n/paapi5/searchitems\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${m.region}/${service}/aws4_request`;
  const stringToSign    = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${m.secretKey}`, dateStamp), m.region), service), 'aws4_request');
  const signature  = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${m.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { endpoint, amzDate, authHeader };
}

// ── البحث عن منتجات ──────────────────
async function searchAmazon(query, market = 'SA', wantCheaper = false) {

  // 🔴 الكود معطّل — غيّر AMAZON_ENABLED إلى true للتفعيل
  if (!AMAZON_ENABLED) {
    console.log('🔴 Amazon PA API معطّل — يُفعَّل بعد 3 مبيعات Affiliate');
    return null;
  }

  try {
    const m = AMAZON_MARKETS[market];
    if (!m?.accessKey || !m?.secretKey || !m?.partnerTag) {
      console.error(`❌ Amazon ${market}: مفاتيح API ناقصة في .env`);
      return null;
    }

    const payload = JSON.stringify({
      Keywords:      query,
      Resources: [
        'Images.Primary.Large',
        'Images.Variants.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis',
        'Offers.Listings.Promotions',
        'Offers.Summaries.LowestPrice',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count',
        'BrowseNodeInfo.BrowseNodes',
      ],
      PartnerTag:    m.partnerTag,
      PartnerType:   'Associates',
      Marketplace:   m.marketplace,
      LanguagesOfPreference: [m.lang],
      ItemCount:     6,
      SortBy:        wantCheaper ? 'Price:LowToHigh' : 'Relevance',
    });

    const { endpoint, amzDate, authHeader } = signRequest(market, payload);

    const response = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'content-encoding': 'amz-1.0',
        'content-type':     'application/json; charset=utf-8',
        'host':             AMAZON_MARKETS[market].host,
        'x-amz-date':       amzDate,
        'x-amz-target':     'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
        'Authorization':    authHeader,
      },
      body: payload,
    });

    const data = await response.json();

    if (data.Errors) {
      console.error(`❌ Amazon PA API Error:`, data.Errors[0]?.Message);
      return null;
    }

    const items = data.SearchResult?.Items || [];
    console.log(`✅ Amazon ${market}: ${items.length} منتج لـ "${query}"`);

    return items.map((item, i) => {
      const title    = item.ItemInfo?.Title?.DisplayValue || query;
      const price    = item.Offers?.Listings?.[0]?.Price?.DisplayAmount || 'تحقق من السعر';
      const oldPrice = item.Offers?.Listings?.[0]?.SavingBasis?.DisplayAmount || null;
      const image    = item.Images?.Primary?.Large?.URL || '';
      const images   = item.Images?.Variants?.map(v => v.Large?.URL).filter(Boolean) || [];
      const rating   = item.CustomerReviews?.StarRating?.DisplayValue || null;
      const reviews  = item.CustomerReviews?.Count?.DisplayValue || null;
      const asin     = item.ASIN || '';
      const url      = `https://${AMAZON_MARKETS[market].marketplace}/dp/${asin}?tag=${m.partnerTag}`;
      // رابط Buy Now مباشر للسلة
      const buyNowUrl = `https://${AMAZON_MARKETS[market].marketplace}/gp/aws/cart/add.html?ASIN.1=${asin}&Quantity.1=1&tag=${m.partnerTag}`;

      return {
        id:        `amz-${market}-${asin}`,
        name:      title.slice(0, 80),
        price,
        oldPrice,
        store:     `Amazon ${market}`,
        image,
        images,
        url,
        buyNowUrl, // ← رابط مباشر للسلة
        badge:     i === 0 ? '🏆 أفضل نتيجة' : i === 1 ? '⭐ الأكثر مبيعاً' : '',
        rating,
        reviews,
        asin,
        source:    'amazon',
        market,
      };
    });

  } catch (err) {
    console.error('Amazon PA API error:', err.message);
    return null;
  }
}

// ── جلب تفاصيل منتج بـ ASIN ──────────
async function getProductByASIN(asin, market = 'SA') {

  if (!AMAZON_ENABLED) return null;

  try {
    const m = AMAZON_MARKETS[market];

    const payload = JSON.stringify({
      ItemIds: [asin],
      Resources: [
        'Images.Primary.Large',
        'Images.Variants.Large',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'ItemInfo.ProductInfo',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis',
        'Offers.Listings.DeliveryInfo.IsAmazonFulfilled',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count',
        'VariationSummary.Price.HighestPrice',
        'VariationSummary.Price.LowestPrice',
      ],
      PartnerTag:  m.partnerTag,
      PartnerType: 'Associates',
      Marketplace: m.marketplace,
      LanguagesOfPreference: [m.lang],
    });

    const { endpoint, amzDate, authHeader } = signRequest(market, payload);

    const response = await fetch(endpoint.replace('searchitems', 'getitems'), {
      method:  'POST',
      headers: {
        'content-encoding': 'amz-1.0',
        'content-type':     'application/json; charset=utf-8',
        'host':             m.host,
        'x-amz-date':       amzDate,
        'x-amz-target':     'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
        'Authorization':    authHeader,
      },
      body: payload,
    });

    const data = await response.json();
    const item = data.ItemsResult?.Items?.[0];
    if (!item) return null;

    return {
      asin,
      title:    item.ItemInfo?.Title?.DisplayValue,
      features: item.ItemInfo?.Features?.DisplayValues || [],
      price:    item.Offers?.Listings?.[0]?.Price?.DisplayAmount,
      oldPrice: item.Offers?.Listings?.[0]?.SavingBasis?.DisplayAmount,
      image:    item.Images?.Primary?.Large?.URL,
      images:   item.Images?.Variants?.map(v => v.Large?.URL).filter(Boolean) || [],
      rating:   item.CustomerReviews?.StarRating?.DisplayValue,
      reviews:  item.CustomerReviews?.Count?.DisplayValue,
      isPrime:  item.Offers?.Listings?.[0]?.DeliveryInfo?.IsAmazonFulfilled,
      url:      `https://${m.marketplace}/dp/${asin}?tag=${m.partnerTag}`,
      buyNowUrl: `https://${m.marketplace}/gp/aws/cart/add.html?ASIN.1=${asin}&Quantity.1=1&tag=${m.partnerTag}`,
      market,
      source:   'amazon',
    };

  } catch (err) {
    console.error('Amazon GetItems error:', err.message);
    return null;
  }
}

module.exports = { searchAmazon, getProductByASIN, AMAZON_ENABLED };
