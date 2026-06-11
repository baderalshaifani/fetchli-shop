// ===================================
// fetchli.shop — الإعدادات والمفاتيح
// ===================================
// المفاتيح السرية تُضاف على Render كـ Environment Variables

require('dotenv').config();

const config = {

  // ── السيرفر ──────────────────────
  PORT: process.env.PORT || 3000,

  // أي الوحدات تعمل في هذه الخدمة (افتراضياً: الكل)
  ENABLE_SHOPPING: process.env.ENABLE_SHOPPING !== 'false',
  ENABLE_TRAVEL:   process.env.ENABLE_TRAVEL   !== 'false',

  // ── Claude API ───────────────────
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
  CLAUDE_MODEL:   process.env.CLAUDE_MODEL   || 'claude-sonnet-4-20250514',

  // ── لوحة التحكم ──────────────────
  // كلمة مرور admin.html — يجب ضبطها في env (لا قيمة افتراضية لأسباب أمنية)
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',

  // ── Supabase ─────────────────────
  SUPABASE_URL:         process.env.SUPABASE_URL         || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '',

  // ── Travelpayouts / Aviasales ────
  TRAVEL: {
    TOKEN:  process.env.AVIASALES_TOKEN || process.env.TRAVELPAYOUTS_TOKEN || '',
    MARKER: process.env.TRAVELPAYOUTS_MARKER || '734923',
    // قالب رابط الفنادق — Hotellook توقفت، ضع هنا deeplink الشريك المعتمد
    // من لوحة Travelpayouts (مثل Trip.com) مع المتغيرات:
    // {destination} {checkIn} {checkOut} {adults}
    HOTEL_DEEPLINK_TEMPLATE: process.env.HOTEL_DEEPLINK_TEMPLATE
      || 'https://www.trip.com/hotels/list?city={destination}&checkin={checkIn}&checkout={checkOut}&adult={adults}',
  },

  // ── Amazon Associates ────────────
  AMAZON: {
    SA: { ACCESS_KEY: process.env.AMAZON_SA_ACCESS_KEY || '', SECRET_KEY: process.env.AMAZON_SA_SECRET_KEY || '', PARTNER_TAG: process.env.AMAZON_SA_PARTNER_TAG || '', HOST: 'webservices.amazon.sa',  MARKETPLACE: 'www.amazon.sa',  REGION: 'eu-west-1' },
    AE: { ACCESS_KEY: process.env.AMAZON_AE_ACCESS_KEY || '', SECRET_KEY: process.env.AMAZON_AE_SECRET_KEY || '', PARTNER_TAG: process.env.AMAZON_AE_PARTNER_TAG || '', HOST: 'webservices.amazon.ae',  MARKETPLACE: 'www.amazon.ae',  REGION: 'eu-west-1' },
    US: { ACCESS_KEY: process.env.AMAZON_US_ACCESS_KEY || '', SECRET_KEY: process.env.AMAZON_US_SECRET_KEY || '', PARTNER_TAG: process.env.AMAZON_US_PARTNER_TAG || '', HOST: 'webservices.amazon.com', MARKETPLACE: 'www.amazon.com', REGION: 'us-east-1' },
    EG: { ACCESS_KEY: process.env.AMAZON_EG_ACCESS_KEY || '', SECRET_KEY: process.env.AMAZON_EG_SECRET_KEY || '', PARTNER_TAG: process.env.AMAZON_EG_PARTNER_TAG || '', HOST: 'webservices.amazon.eg',  MARKETPLACE: 'www.amazon.eg',  REGION: 'eu-west-1' },
  },

  // ── IP Detection — سلسلة fallback ─
  // ipapi.co يحد الطلبات ويرجع نص غير JSON عند الفشل → نضعه آخر السلسلة
  IP_PROVIDERS: [
    { name: 'ip-api',  url: ip => `http://ip-api.com/json/${ip}?fields=countryCode`,  field: 'countryCode'  },
    { name: 'ipwho',   url: ip => `https://ipwho.is/${ip}`,                            field: 'country_code' },
    { name: 'ipapi',   url: ip => `https://ipapi.co/${ip}/json/`,                      field: 'country_code' },
  ],

  // ── خريطة الدول → Amazon ─────────
  COUNTRY_MAP: {
    'SA': 'SA', 'KW': 'SA', 'BH': 'SA',
    'QA': 'SA', 'OM': 'SA',
    'AE': 'AE',
    'EG': 'EG',
    'US': 'US', 'CA': 'US',
    // باقي الدول → Amazon US افتراضياً
  },

  COUNTRY_INFO: {
    SA: { currency: 'SAR', flag: '🇸🇦', name: 'السعودية' },
    AE: { currency: 'AED', flag: '🇦🇪', name: 'الإمارات' },
    EG: { currency: 'EGP', flag: '🇪🇬', name: 'مصر'      },
    US: { currency: 'USD', flag: '🇺🇸', name: 'أمريكا'   },
    CA: { currency: 'CAD', flag: '🇨🇦', name: 'كندا'     },
    KW: { currency: 'KWD', flag: '🇰🇼', name: 'الكويت'   },
    QA: { currency: 'QAR', flag: '🇶🇦', name: 'قطر'      },
    BH: { currency: 'BHD', flag: '🇧🇭', name: 'البحرين'  },
    OM: { currency: 'OMR', flag: '🇴🇲', name: 'عُمان'    },
  },

};

module.exports = config;
