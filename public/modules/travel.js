// ===================================
// fetchli — وحدة السفر
// ===================================

const TravelModule = (() => {

  // ── إعدادات ──
  const CONFIG = {
    timeoutMs:   15000,
    maxResults:  8,
  };

  // ── تحليل طلب السفر ──
  async function analyze(message, imageBase64) {
    const res = await fetchWithTimeout('/api/analyze', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, imageBase64, mode: 'travel' }),
    });
    return res.json();
  }

  // ── البحث ──
  async function search(analyzed, market) {
    const res = await fetchWithTimeout('/api/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        queries:    analyzed.searchQueries || [],
        market,
        searchType: analyzed.searchType || 'hotel',
        flightData: analyzed.flightData  || null,
        hotelData:  analyzed.hotelData   || null,
      }),
    });
    return res.json();
  }

  // ── بناء Deep Link لـ Trip.com (affiliate) ──
  function buildTripLink(type, data, marker = '534923') {
    const base = 'https://www.trip.com';
    if (type === 'hotel') {
      const city = encodeURIComponent(data.city || '');
      return `${base}/hotels/list?city=${city}&checkin=${data.checkIn || ''}&checkout=${data.checkOut || ''}&adult=${data.guests || 2}&curr=${data.currency || 'USD'}&locale=ar-SA&Allianceid=4897061&SID=${marker}`;
    }
    if (type === 'flight') {
      const from = encodeURIComponent(data.from || '');
      const to   = encodeURIComponent(data.to   || '');
      return `${base}/flights/list?dcity=${from}&acity=${to}&ddate=${data.date || ''}&adult=${data.passengers || 1}&curr=${data.currency || 'USD'}&locale=ar-SA&Allianceid=4897061&SID=${marker}`;
    }
    return base;
  }

  // ── بناء Deep Link لـ Booking.com (affiliate) ──
  function buildBookingLink(data, aid = '') {
    const city = encodeURIComponent(data.city || '');
    let url = `https://www.booking.com/search.html?ss=${city}&checkin=${data.checkIn || ''}&checkout=${data.checkOut || ''}&group_adults=${data.guests || 2}&no_rooms=1&lang=ar`;
    if (aid) url += `&aid=${aid}`;
    return url;
  }

  // ── استخراج بيانات السفر من النص ──
  function extractTravelIntent(text) {
    const isHotel  = /فندق|hotel|إقامة|نزل|accommodation|ホテル|hotel/i.test(text);
    const isFlight = /رحلة|طيران|تذكرة|flight|ticket|پرواز|Flug/i.test(text);
    return { isHotel, isFlight };
  }

  // ── fetch مع timeout ──
  async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  return {
    analyze,
    search,
    buildTripLink,
    buildBookingLink,
    extractTravelIntent,
    CONFIG,
  };

})();

window.TravelModule = TravelModule;
