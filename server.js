require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const axios    = require('axios');

const app    = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY });

const TOKEN  = process.env.AVIASALES_TOKEN || process.env.TRAVELPAYOUTS_TOKEN;
const MARKER = process.env.TRAVELPAYOUTS_MARKER || '734923';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
};

function resolveIATA(city) {
  if (!city) return null;
  const clean = city.trim();
  if (/^[A-Z]{3}$/.test(clean)) return clean;
  return CITY_IATA[clean] || CITY_IATA[clean.replace(/^ال/, '')] || null;
}

// ─────────────────────────────────────────
// POST /api/travel/analyze
// ─────────────────────────────────────────
app.post('/api/travel/analyze', async (req, res) => {
  try {
    const { message, imageBase64 } = req.body;

    const content = [];
    if (imageBase64) {
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } });
    }
    content.push({ type: 'text', text: message || '' });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
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

    const raw = response.content[0].text.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(raw);
    res.json({ success: true, ...analysis });
  } catch (err) {
    console.error('analyze error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/travel/search
// ─────────────────────────────────────────
app.post('/api/travel/search', async (req, res) => {
  try {
    const { analysis } = req.body;
    const { type, origin, destination, checkIn, checkOut, adults = 2, currency = 'SAR' } = analysis;

    const originCode      = resolveIATA(origin);
    const destinationCode = resolveIATA(destination);

    const cards = [];

    // ── الرحلات (Aviasales Flight Data API) ──────────────────
    if ((type === 'flight' || type === 'mixed') && originCode && destinationCode) {
      try {
        const flightRes = await axios.get('https://api.travelpayouts.com/v1/prices/cheap', {
          params: {
            origin:      originCode,
            destination: destinationCode,
            depart_date: checkIn || '',
            return_date: checkOut || '',
            currency,
            token:  TOKEN,
          },
          timeout: 8000,
        });

        const data = flightRes.data?.data?.[destinationCode];
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
      if (cards.filter(c => c.source === 'aviasales').length === 0 && originCode && destinationCode) {
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

    // ── الفنادق (Hotellook API) ───────────────────────────────
    if ((type === 'hotel' || type === 'mixed') && destinationCode) {
      try {
        const ci = checkIn  || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        const co = checkOut || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

        const hotelRes = await axios.get('https://engine.hotellook.com/api/v2/cache.json', {
          params: {
            location:  destinationCode,
            checkIn:   ci,
            checkOut:  co,
            adults,
            currency,
            limit:     4,
            token:     TOKEN,
          },
          timeout: 8000,
        });

        const hotels = hotelRes.data || [];
        hotels.slice(0, 4).forEach((hotel, i) => {
          const nights = Math.round((new Date(co) - new Date(ci)) / 86400000) || 1;
          const bookUrl = `https://search.hotellook.com/?destination=${encodeURIComponent(destination)}&checkIn=${ci}&checkOut=${co}&adults=${adults}&marker=${MARKER}`;
          cards.push({
            id:       `hotel_${i}`,
            name:     hotel.hotelName || destination,
            price:    `${Math.round(hotel.priceFrom)} ${currency}`,
            platform: 'Hotellook',
            image:    hotel.photoUrl || '',
            url:      bookUrl,
            badge:    `${nights} ليالي`,
            rating:   hotel.stars ? `${hotel.stars}★` : null,
            details:  `${destination} · من ${Math.round(hotel.priceFrom / nights)} ${currency}/ليلة`,
            source:   'hotellook',
          });
        });
      } catch (e) {
        console.warn('hotels API warn:', e.message);
      }

      // fallback فنادق
      if (cards.filter(c => c.source === 'hotellook').length === 0) {
        const ci = checkIn  || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        const co = checkOut || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
        cards.push({
          id:       'hotel_fallback',
          name:     `فنادق ${destination}`,
          price:    'أسعار متنوعة',
          platform: 'Hotellook',
          image:    '',
          url:      `https://search.hotellook.com/?destination=${encodeURIComponent(destination)}&checkIn=${ci}&checkOut=${co}&adults=${adults}&marker=${MARKER}`,
          badge:    'قارن الأسعار',
          details:  'اضغط لرؤية جميع الفنادق',
          source:   'hotellook_fallback',
        });
      }
    }

    // ── السيارات (Localrent deeplink) ─────────────────────────
    if (type === 'car' || type === 'mixed') {
      const ci = checkIn  || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const co = checkOut || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
      cards.push({
        id:       'car_localrent',
        name:     `تأجير سيارة في ${destination || origin}`,
        price:    'قارن الأسعار',
        platform: 'Localrent',
        image:    '',
        url:      `https://localrent.com/?marker=${MARKER}&city=${encodeURIComponent(destination || origin)}&from=${ci}&to=${co}`,
        badge:    '7.5–12% عمولة',
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
    console.error('search error:', err.message);
    res.status(500).json({ success: false, error: err.message, cards: [] });
  }
});

// ─────────────────────────────────────────
// GET /api/travel/suggest
// ─────────────────────────────────────────
app.get('/api/travel/suggest', async (req, res) => {
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

// ─────────────────────────────────────────
// Health check
// ─────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'fetchli-travel' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`fetchli-shop (travel) running on port ${PORT}`));
