// ===================================
// fetchli.shop — تحديد الدولة عبر IP
// ===================================
// مشترك بين التسوق والسفر وأي موديول مستقبلي

const fetch  = require('node-fetch');
const config = require('../config');

const COUNTRY_INFO = {
  SA: { currency: 'SAR', flag: '🇸🇦', name: 'السعودية' },
  AE: { currency: 'AED', flag: '🇦🇪', name: 'الإمارات' },
  EG: { currency: 'EGP', flag: '🇪🇬', name: 'مصر'      },
  US: { currency: 'USD', flag: '🇺🇸', name: 'أمريكا'   },
  CA: { currency: 'CAD', flag: '🇨🇦', name: 'كندا'     },
  KW: { currency: 'KWD', flag: '🇰🇼', name: 'الكويت'   },
  QA: { currency: 'QAR', flag: '🇶🇦', name: 'قطر'      },
};

const DEFAULT_LOCATION = {
  country: 'SA',
  market:  'SA',
  currency: 'SAR',
  flag:    '🇸🇦',
  name:    'السعودية',
};

/**
 * يكتشف موقع المستخدم من IP ويرجع بيانات الدولة
 * @param {string} ip
 * @returns {object} { country, market, currency, flag, name }
 */
async function detectLocation(ip) {
  try {
    // IP محلي → افتراضي السعودية
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168')) {
      return DEFAULT_LOCATION;
    }

    const response = await fetch(`${config.IP_API_URL}/${ip}/json/`);
    const data     = await response.json();
    const country  = data.country_code || 'SA';
    const market   = config.COUNTRY_MAP[country] || 'US';

    return {
      country,
      market,
      ...(COUNTRY_INFO[country] || COUNTRY_INFO['US']),
    };
  } catch (err) {
    console.error('Location detection error:', err.message);
    return DEFAULT_LOCATION;
  }
}

module.exports = { detectLocation, COUNTRY_INFO, DEFAULT_LOCATION };
