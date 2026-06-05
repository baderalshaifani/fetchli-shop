// ────────────────────────────────────
// تحديد دولة المستخدم عبر IP
// مع fallback لثلاث خدمات مختلفة
// ────────────────────────────────────

const COUNTRY_INFO = {
  SA: { currency: 'SAR', flag: '🇸🇦', name: 'السعودية' },
  AE: { currency: 'AED', flag: '🇦🇪', name: 'الإمارات' },
  EG: { currency: 'EGP', flag: '🇪🇬', name: 'مصر'      },
  US: { currency: 'USD', flag: '🇺🇸', name: 'أمريكا'   },
  CA: { currency: 'CAD', flag: '🇨🇦', name: 'كندا'     },
  KW: { currency: 'KWD', flag: '🇰🇼', name: 'الكويت'   },
  QA: { currency: 'QAR', flag: '🇶🇦', name: 'قطر'      },
  BH: { currency: 'BHD', flag: '🇧🇭', name: 'البحرين'  },
  OM: { currency: 'OMR', flag: '🇴🇲', name: 'عُمان'    },
  GB: { currency: 'GBP', flag: '🇬🇧', name: 'بريطانيا' },
  DE: { currency: 'EUR', flag: '🇩🇪', name: 'ألمانيا'  },
};

const DEFAULT = { country: 'SA', market: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'السعودية' };

// cache بسيط في الذاكرة — يمنع الطلبات المتكررة لنفس الـ IP
const locationCache = new Map();

async function fetchWithTimeout(url, ms = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    // تحقق أن الـ response فعلاً JSON قبل parse
    const text = await res.text();
    if (!text.trim().startsWith('{')) throw new Error('Not JSON: ' + text.slice(0, 60));
    return JSON.parse(text);
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function detectCountry(ip) {
  // local IP → السعودية افتراضي
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
    return DEFAULT;
  }

  // cache hit
  if (locationCache.has(ip)) return locationCache.get(ip);

  const COUNTRY_MAP = {
    'SA':'SA','KW':'SA','BH':'SA','QA':'SA','OM':'SA',
    'AE':'AE','EG':'EG','US':'US','CA':'US',
    'GB':'US','DE':'US',
  };

  // ثلاث خدمات بالترتيب — أول واحدة تشتغل نستخدمها
  const providers = [
    async () => {
      // ip-api.com — مجاني 45 طلب/دقيقة بدون مفتاح
      const d = await fetchWithTimeout(`http://ip-api.com/json/${ip}?fields=countryCode`);
      if (d.countryCode) return d.countryCode;
      throw new Error('no countryCode');
    },
    async () => {
      // ipwho.is — مجاني بدون حد
      const d = await fetchWithTimeout(`https://ipwho.is/${ip}`);
      if (d.country_code) return d.country_code;
      throw new Error('no country_code');
    },
    async () => {
      // ipapi.co — الأصلي كـ fallback أخير
      const d = await fetchWithTimeout(`https://ipapi.co/${ip}/json/`);
      if (d.country_code) return d.country_code;
      throw new Error('no country_code');
    },
  ];

  let country = 'SA';
  for (const provider of providers) {
    try {
      country = await provider();
      break; // نجح — توقف
    } catch (e) {
      // جرب التالي
      console.warn('IP provider failed:', e.message);
    }
  }

  const market = COUNTRY_MAP[country] || 'US';
  const info   = COUNTRY_INFO[country] || COUNTRY_INFO['US'];
  const result = { country, market, ...info };

  // احفظ في cache لمدة الجلسة
  locationCache.set(ip, result);
  // امسح الـ cache كل ساعة لو كبر
  if (locationCache.size > 500) locationCache.clear();

  return result;
}

module.exports = { detectCountry };
