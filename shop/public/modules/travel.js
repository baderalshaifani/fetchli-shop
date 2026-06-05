// ===================================
// fetchli.shop — TravelModule (فرونت)
// ===================================
// يُستدعى من app.js فقط عند currentMode === 'travel'

const TravelModule = (() => {

  /**
   * تحليل طلب السفر بـ Claude
   */
  async function analyze(text, imageBase64) {
    const res = await fetch('/api/travel/analyze', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, imageBase64 }),
    });
    return res.json();
  }

  /**
   * البحث في مصادر السفر
   */
  async function search(analyzed, market) {
    const res = await fetch('/api/travel/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ analysis: analyzed, market }),
    });
    const data = await res.json();

    // حوّل بطاقات السفر لنفس شكل المنتجات
    const cards = (data.cards || []).map(card => ({
      id:     card.id,
      name:   card.name,
      price:  card.price,
      store:  card.platform,
      image:  card.image,
      url:    card.url,
      badge:  card.badge,
      rating: card.rating,
      details: card.details,
      source: card.source,
    }));

    return { products: cards, raw: data };
  }

  /**
   * بناء رابط Deep Link لـ Trip.com
   * يُستخدم كـ fallback لو ما في نتائج
   */
  function buildTripLink(type, params = {}) {
    const { destination = '', origin = '', checkIn = '', checkOut = '', adults = 2, currency = 'SAR' } = params;
    const base = 'https://www.trip.com';
    const marker = ''; // يُضاف من env على السيرفر

    if (type === 'flight' && origin && destination) {
      return `${base}/flights/${encodeURIComponent(origin)}-${encodeURIComponent(destination)}/`;
    }
    if (type === 'hotel' && destination) {
      let url = `${base}/hotels/list?city=${encodeURIComponent(destination)}`;
      if (checkIn)  url += `&checkin=${checkIn}`;
      if (checkOut) url += `&checkout=${checkOut}`;
      url += `&adult=${adults}`;
      return url;
    }

    return `${base}/`;
  }

  /**
   * جلب اقتراحات الوجهات
   */
  async function getSuggestions() {
    try {
      const res  = await fetch('/api/travel/suggest');
      const data = await res.json();
      return data.suggestions || [];
    } catch {
      return DEFAULT_SUGGESTIONS;
    }
  }

  // اقتراحات افتراضية لو API فشل
  const DEFAULT_SUGGESTIONS = [
    { name: 'إسطنبول',  nameEn: 'Istanbul', emoji: '🕌', tag: 'الأكثر طلباً' },
    { name: 'دبي',      nameEn: 'Dubai',    emoji: '🌆', tag: 'قريبة وسريعة' },
    { name: 'بانكوك',   nameEn: 'Bangkok',  emoji: '🏯', tag: 'الأوفر سعراً' },
    { name: 'المالديف', nameEn: 'Maldives', emoji: '🏝️', tag: 'شهر العسل'   },
    { name: 'لندن',     nameEn: 'London',   emoji: '🎡', tag: 'تسوق وترفيه' },
    { name: 'جورجيا',   nameEn: 'Georgia',  emoji: '⛰️', tag: 'طبيعة خلابة' },
  ];

  return { analyze, search, buildTripLink, getSuggestions, DEFAULT_SUGGESTIONS };

})();
