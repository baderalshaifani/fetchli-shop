// ===================================
// shared/location.js — تحديد دولة المستخدم
// سلسلة fallback: ip-api.com → ipwho.is → ipapi.co
// ===================================

const fetch  = require('node-fetch');
const config = require('../config');

const DEFAULT = { country: 'SA', market: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'السعودية' };

function extractIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || '';
}

function isLocal(ip) {
  return !ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.');
}

async function detectCountry(ip) {
  for (const provider of config.IP_PROVIDERS) {
    try {
      const res = await fetch(provider.url(ip), { timeout: 3000 });
      // بعض المزودات (خاصة ipapi.co عند الحد) ترجع نصاً غير JSON
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { continue; }
      const code = data?.[provider.field];
      if (code && /^[A-Z]{2}$/i.test(code)) return code.toUpperCase();
    } catch (e) {
      // جرّب المزود التالي
    }
  }
  return null;
}

function buildLocationResponse(country) {
  const market = config.COUNTRY_MAP[country] || 'US';
  const info   = config.COUNTRY_INFO[country] || config.COUNTRY_INFO['US'];
  return { country, market, ...info };
}

/** Express handler — GET /api/location */
async function locationHandler(req, res) {
  try {
    const ip = extractIp(req);
    if (isLocal(ip)) return res.json(DEFAULT);
    const country = await detectCountry(ip);
    if (!country) return res.json(DEFAULT);
    res.json(buildLocationResponse(country));
  } catch (err) {
    res.json(DEFAULT);
  }
}

module.exports = { locationHandler };
