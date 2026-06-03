// ===================================
// fetchli.shop — البحث في مصادر السفر
// ===================================
// SerpAPI للبحث + بناء بطاقات النتائج
// مع روابط أفلييت Travelpayouts

const fetch              = require('node-fetch');
const { buildSourceUrls } = require('./sources');

// ────────────────────────────────────
// SerpAPI — بحث Google للسفر
// ────────────────────────────────────
const MARKET_PARAMS = {
  SA: 'gl=sa&hl=ar',
  AE: 'gl=ae&hl=ar',
  EG: 'gl=eg&hl=ar',
  US: 'gl=us&hl=en',
};

/**
 * يبحث في Google عن نتائج سفر
 */
async function searchTravelWithGoogle(query, market = 'SA') {
  try {
    const API_KEY = process.env.SERP_API_KEY;
    if (!API_KEY || !query?.trim()) return null;

    const params = MARKET_PARAMS[market] || MARKET_PARAMS['SA'];
    const url = `https://serpapi.com/search?engine=google&q=${encodeURIComponent(query)}&${params}&api_key=${API_KEY}&num=6`;

    const response = await fetch(url);
    const data     = await response.json();

    if (data.error) { console.error('SerpAPI travel error:', data.error); return null; }

    // نتائج عضوية
    const results = data.organic_results || [];
    if (!results.length) return null;

    return results.slice(0, 5).map((item, i) => ({
      id:      `t-${i}-${Date.now()}`,
      title:   item.title?.slice(0, 70) || query,
      snippet: item.snippet?.slice(0, 120) || '',
      url:     item.link || '#',
      source:  extractDomain(item.link),
    }));

  } catch (err) {
    console.error('Travel search error:', err.message);
    return null;
  }
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return 'نتيجة بحث'; }
}

// ────────────────────────────────────
// بناء بطاقات السفر
// ────────────────────────────────────

// صور افتراضية حسب الوجهة
const DESTINATION_IMAGES = {
  dubai:    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=250&fit=crop',
  istanbul: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=400&h=250&fit=crop',
  london:   'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=250&fit=crop',
  paris:    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&h=250&fit=crop',
  bangkok:  'https://images.unsplash.com/photo-1508009603885-50cf7c8dd0d5?w=400&h=250&fit=crop',
  maldives: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&h=250&fit=crop',
  egypt:    'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?w=400&h=250&fit=crop',
  default:  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=250&fit=crop',
};

function getDestinationImage(destination = '') {
  const key = destination.toLowerCase();
  for (const [name, img] of Object.entries(DESTINATION_IMAGES)) {
    if (key.includes(name)) return img;
  }
  return DESTINATION_IMAGES.default;
}

/**
 * يبني بطاقات السفر الرئيسية من روابط المصادر
 */
function buildTravelCards(analysis) {
  const { travelType, travelTypeEn, destination, destinationEn,
          checkIn, checkOut, adults, serviceClass } = analysis;

  const urls  = buildSourceUrls(analysis);
  const image = getDestinationImage(destinationEn || destination);

  const dateInfo = checkIn
    ? `${checkIn}${checkOut ? ' → ' + checkOut : ''}`
    : 'مرن';

  const guestInfo = `${adults || 2} بالغ${(adults || 2) > 1 ? 'ين' : ''}`;

  const classMap = { economy: 'اقتصادي', business: 'أعمال', luxury: 'فاخر', any: '' };
  const classLabel = classMap[serviceClass] || '';

  // بطاقات المصادر
  const cards = [
    {
      id:       'trip-1',
      source:   'trip',
      name:     `${travelType} — ${destination}`,
      platform: 'Trip.com',
      logo:     '✈️',
      badge:    'الأوفر سعراً',
      image,
      price:    'تحقق من السعر',
      details:  `${dateInfo} • ${guestInfo}${classLabel ? ' • ' + classLabel : ''}`,
      url:      urls.trip,
      rating:   '4.7',
    },
    {
      id:       'booking-1',
      source:   'booking',
      name:     `فنادق ${destination} — Booking.com`,
      platform: 'Booking.com',
      logo:     '🏨',
      badge:    'الأكثر خيارات',
      image,
      price:    'من 200 ر.س / ليلة',
      details:  `${dateInfo} • ${guestInfo}`,
      url:      urls.booking,
      rating:   '4.5',
    },
    {
      id:       'agoda-1',
      source:   'agoda',
      name:     `عروض ${destination} — Agoda`,
      platform: 'Agoda',
      logo:     '🌏',
      badge:    'عروض حصرية',
      image,
      price:    'خصومات تصل 40٪',
      details:  `${dateInfo} • ${guestInfo}`,
      url:      urls.agoda,
      rating:   '4.4',
    },
  ];

  // لو طيران فقط، أزل Agoda وخلّي Trip أولاً
  if (travelTypeEn === 'flight') {
    return cards.filter(c => c.source !== 'agoda');
  }

  // لو رحلة بحرية أو فعالية، Trip فقط
  if (['cruise', 'activity', 'tour'].includes(travelTypeEn)) {
    return cards.filter(c => c.source === 'trip');
  }

  return cards;
}

// ────────────────────────────────────
// البحث الرئيسي
// ────────────────────────────────────
/**
 * @param {object} analysis   — نتيجة analyzeTravelRequest
 * @param {string} market     — SA | AE | EG
 * @returns {{ results: Array, cards: Array }}
 */
async function searchTravel(analysis, market = 'SA') {
  const { searchQueries } = analysis;

  // بطاقات المصادر دائماً موجودة
  const cards = buildTravelCards(analysis);

  // بحث Google للمزيد من المعلومات
  let googleResults = null;
  if (searchQueries?.length) {
    googleResults = await searchTravelWithGoogle(searchQueries[0], market);
  }

  return {
    cards,                          // بطاقات المصادر الرئيسية (Trip/Booking/Agoda)
    results: googleResults || [],   // نتائج Google الإضافية
    analysis,
  };
}

module.exports = { searchTravel, buildTravelCards, getDestinationImage };
