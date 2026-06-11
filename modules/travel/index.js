// ===================================
// modules/travel/index.js — راوتر السفر
// رحلات: Travelpayouts/Aviasales · فنادق: deeplink قابل للتهيئة
// (Hotellook توقفت — راجع HOTEL_DEEPLINK_TEMPLATE في config.js)
// ===================================

const express = require('express');
const fetch   = require('node-fetch');
const config  = require('../../config');
const { callClaude, extractJson } = require('../../shared/claude');

const router = express.Router();

const TOKEN  = config.TRAVEL.TOKEN;
const MARKER = config.TRAVEL.MARKER;

// ─────────────────────────────────────────
// IATA codes للمدن الخليجية + الشائعة
// ─────────────────────────────────────────
const CITY_IATA = {
  'الرياض': 'RUH', 'رياض': 'RUH',
  'جدة': 'JED', 'جده': 'JED',
  'الدمام': 'DMM', 'دمام': 'DMM',
  'أبوظبي': 'AUH', 'ابوظبي': 'AUH',
  'دبي': 'DXB',
  'الكويت': 'KWI', 'كويت': 'KWI',
  'البحرين': 'BAH', 'بحرين': 'BAH', 'المنامة': 'BAH',
  'مسقط': 'MCT',
  'الدوحة': 'DOH', 'دوحة': 'DOH',
  'إسطنبول': 'IST', 'اسطنبول': 'IST',
  'لندن': 'LON',
  'باريس': 'PAR',
  'بانكوك': 'BKK',
  'كوالالمبور': 'KUL',
  'المالديف': 'MLE', 'مالديف': 'MLE',
  'القاهرة': 'CAI', 'قاهرة': 'CAI',
  'بيروت': 'BEY',
  'أمستردام': 'AMS',
  'فرانكفورت': 'FRA',
  'نيويورك': 'NYC',
  'طوكيو': 'TYO',
  'جورجيا': 'TBS', 'تبليسي': 'TBS',
};

function resolveIATA(city) {
  if (!city) return null;
  const clean = city.trim();
  if (/^[A-Z]{3}$/.test(clean)) return clean;
  return CITY_IATA[clean] || CITY_IATA[clean.replace(/^ال/, '')] || null;
}

function hotelDeeplink(destination, checkIn, checkOut, adults) {
  return config.TRAVEL.HOTEL_DEEPLINK_TEMPLATE
    .replace('{destination}', encodeURIComponent(destination || ''))
    .replace('{checkIn}',     checkIn  || '')
    .replace('{checkOut}',    checkOut || '')
    .replace('{adults}',      String(adults || 2));
}

// ─────────────────────────────────────────
// POST /api/travel/analyze
// ─────────────────────────────────────────
router.post('/api/travel/analyze', async (req, res) => {
  try {
    const { message, imageBase64 } = req.body;

    const content = [];
    if (imageBase64) {
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } });
    }
    content.push({ type: 'text', text: message || '' });

    const todayStr = new Date().toISOString().split('T')[0];

    const raw = await callClaude({
      max_tokens: 800,
      system: `أنت مساعد سفر ذكي لـ fetchli.shop. اليوم: ${todayStr}.
استخرج من طلب المستخدم:
- type: "flight" | "hotel" | "car" | "transfer" | "mixed"
- origin: مدينة الانطلاق (بالعربي)
- destination: الوجهة (بالعربي)
- checkIn: تاريخ الوصول YYYY-MM-DD (احسب من "بعد أسبوع" وما شابه)
- checkOut: تاريخ المغادرة YYYY-MM-DD
- adults: عدد البالغين (افتراضي 2)
- currency: SAR
- reply: رد قصير ودّي بالعربي يؤكد فهمك للطلب (جملة واحدة)
أجب بـ JSON فقط بدون أي نص خارجه.`,
      messages: [{ role: 'user', content }],
    });

    const analysis = extractJson(raw);
    res.json({ success: true, ...analysis });
  } catch (err) {
    console.error('travel analyze error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/travel/search
// ─────────────────────────────────────────
router.post('/api/travel/search', async (req, res) => {
  try {
    const { analysis } = req.body;
    const { type, origin, destination, checkIn, checkOut, adults = 2, currency = 'SAR' } = analysis;

    const originCode      = resolveIATA(origin);
    const destinationCode = resolveIATA(destination);

    const cards = [];

    // ── الرحلات (Travelpayouts Data API — أسعار مخزّنة) ──
    if ((type === 'flight' || type === 'mixed') && originCode && destinationCode) {
      try {
        const params = new URLSearchParams({
          origin:      originCode,
          destination: destinationCode,
          depart_date: checkIn || '',
          return_date: checkOut || '',
          currency,
          token: TOKEN,
        });
        const flightRes = await fetch(`https://api.travelpayouts.com/v1/prices/cheap?${params}`, { timeout: 8000 });
        const flightData = await flightRes.json();

        const data = flightData?.data?.[destinationCode];
        if (data) {
          Object.values(data).slice(0, 4).forEach((flight, i) => {
            const bookUrl = `https://www.aviasales.com/search/${originCode}${(checkIn || '').replace(/-/g, '').slice(4)}${destinationCode}1?marker=${MARKER}`;
            cards.push({
              id:       `flight_${i}`,
              name:     `${origin} ← ${destination}`,
              price:    `${flight.price} ${currency}`,
              platform: 'Aviasales',
              image:    'https://cdn.travelpayouts.com/aviasales/logo.png',
              url:      bookUrl,
              badge:    flight.transfers === 0 ? 'مباشر' : `${flight.transfers} توقف`,
              rating:   null,
              details:  `${flight.airline} · ${flight.departure_at ? new Date(flight.departure_at).toLocaleDateString('ar-SA') : ''}`,
              source:   'aviasales',
            });
          });
        }
      } catch (e) {
        console.warn('flights API warn:', e.message);
      }

      // fallback لو ما جاء شيء
      if (cards.filter(c => c.source === 'aviasales').length === 0) {
        cards.push({
          id:       'flight_fallback',
          name:     `${origin} ← ${destination}`,
          price:    'ابحث عن أفضل سعر',
          platform: 'Aviasales',
          image:    'https://cdn.travelpayouts.com/aviasales/logo.png',
          url:      `https://www.aviasales.com/search/${originCode}${destinationCode}?marker=${MARKER}`,
          badge:    'عروض متاحة',
          details:  'اضغط لرؤية جميع الرحلات',
          source:   'aviasales_fallback',
        });
      }
    }

    // ── الفنادق — deeplink (Hotellook توقفت) ─────────────────
    if ((type === 'hotel' || type === 'mixed') && destination) {
      const ci = checkIn  || new Date(Date.now() + 7  * 86400000).toISOString().split('T')[0];
      const co = checkOut || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
      const nights = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));

      cards.push({
        id:       'hotel_deeplink',
        name:     `فنادق ${destination}`,
        price:    'قارن الأسعار',
        platform: 'Trip.com',
        image:    '',
        url:      hotelDeeplink(destination, ci, co, adults),
        badge:    `${nights} ليالي`,
        details:  `${ci} → ${co} · ${adults} بالغين`,
        source:   'hotel_deeplink',
      });
    }

    // ── السيارات (Localrent deeplink) ─────────────────────────
    if (type === 'car' || type === 'mixed') {
      const ci = checkIn  || new Date(Date.now() + 7  * 86400000).toISOString().split('T')[0];
      const co = checkOut || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
      cards.push({
        id:       'car_localrent',
        name:     `تأجير سيارة في ${destination || origin}`,
        price:    'قارن الأسعار',
        platform: 'Localrent',
        image:    '',
        url:      `https://localrent.com/?marker=${MARKER}&city=${encodeURIComponent(destination || origin || '')}&from=${ci}&to=${co}`,
        badge:    'شركات محلية',
        details:  'شركات محلية معتمدة',
        source:   'localrent',
      });
    }

    // ── التاكسي (GetTransfer deeplink) ────────────────────────
    if (type === 'transfer') {
      cards.push({
        id:       'transfer_gettransfer',
        name:     `نقل من ${origin} إلى ${destination}`,
        price:    'ابحث عن الأسعار',
        platform: 'GetTransfer',
        image:    '',
        url:      `https://gettransfer.com/?ref=${MARKER}`,
        badge:    'حجز فوري',
        details:  'سائق خاص · مطار · فندق',
        source:   'gettransfer',
      });
    }

    res.json({ success: true, cards, count: cards.length });

  } catch (err) {
    console.error('travel search error:', err.message);
    res.status(500).json({ success: false, error: err.message, cards: [] });
  }
});

// ─────────────────────────────────────────
// GET /api/travel/suggest
// ─────────────────────────────────────────
router.get('/api/travel/suggest', (req, res) => {
  res.json({
    suggestions: [
      { name: 'إسطنبول',  nameEn: 'Istanbul', emoji: '🕌', tag: 'الأكثر طلباً',  iata: 'IST' },
      { name: 'دبي',      nameEn: 'Dubai',    emoji: '🌆', tag: 'قريبة وسريعة',  iata: 'DXB' },
      { name: 'بانكوك',   nameEn: 'Bangkok',  emoji: '🏯', tag: 'الأوفر سعراً',  iata: 'BKK' },
      { name: 'المالديف', nameEn: 'Maldives', emoji: '🏝️', tag: 'شهر العسل',     iata: 'MLE' },
      { name: 'لندن',     nameEn: 'London',   emoji: '🎡', tag: 'تسوق وترفيه',   iata: 'LON' },
      { name: 'جورجيا',   nameEn: 'Georgia',  emoji: '⛰️', tag: 'طبيعة خلابة',  iata: 'TBS' },
    ],
  });
});

module.exports = router;
