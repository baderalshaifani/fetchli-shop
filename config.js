// ===================================
// fetchli.shop — الإعدادات والمفاتيح
// ===================================
// نضع هنا المفاتيح السرية
// على Render نضيفها كـ Environment Variables

require('dotenv').config();

const config = {

  // ── السيرفر ──────────────────────
  PORT: process.env.PORT || 3000,

  // ── Claude API ───────────────────
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',

  // ── Amazon Associates ────────────
  // سجل على: https://affiliate-program.amazon.sa
  AMAZON: {
    SA: {
      ACCESS_KEY:    process.env.AMAZON_SA_ACCESS_KEY    || '',
      SECRET_KEY:    process.env.AMAZON_SA_SECRET_KEY    || '',
      PARTNER_TAG:   process.env.AMAZON_SA_PARTNER_TAG   || '',  // مثال: fetchli-21
      HOST:          'webservices.amazon.sa',
      MARKETPLACE:   'www.amazon.sa',
      REGION:        'eu-west-1',
    },
    AE: {
      ACCESS_KEY:    process.env.AMAZON_AE_ACCESS_KEY    || '',
      SECRET_KEY:    process.env.AMAZON_AE_SECRET_KEY    || '',
      PARTNER_TAG:   process.env.AMAZON_AE_PARTNER_TAG   || '',
      HOST:          'webservices.amazon.ae',
      MARKETPLACE:   'www.amazon.ae',
      REGION:        'eu-west-1',
    },
    US: {
      ACCESS_KEY:    process.env.AMAZON_US_ACCESS_KEY    || '',
      SECRET_KEY:    process.env.AMAZON_US_SECRET_KEY    || '',
      PARTNER_TAG:   process.env.AMAZON_US_PARTNER_TAG   || '',
      HOST:          'webservices.amazon.com',
      MARKETPLACE:   'www.amazon.com',
      REGION:        'us-east-1',
    },
    EG: {
      ACCESS_KEY:    process.env.AMAZON_EG_ACCESS_KEY    || '',
      SECRET_KEY:    process.env.AMAZON_EG_SECRET_KEY    || '',
      PARTNER_TAG:   process.env.AMAZON_EG_PARTNER_TAG   || '',
      HOST:          'webservices.amazon.eg',
      MARKETPLACE:   'www.amazon.eg',
      REGION:        'eu-west-1',
    },
  },

  // ── IP Detection ─────────────────
  // مجاني بدون مفتاح حتى 1000 طلب/يوم
  IP_API_URL: 'https://ipapi.co',

  // ── خريطة الدول → Amazon ─────────
  COUNTRY_MAP: {
    'SA': 'SA', 'KW': 'SA', 'BH': 'SA',
    'QA': 'SA', 'OM': 'SA',
    'AE': 'AE',
    'EG': 'EG',
    'US': 'US', 'CA': 'US',
    // باقي الدول → Amazon US افتراضي
  },

};

module.exports = config;
