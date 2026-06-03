// ===================================
// fetchli.shop — مصادر السفر
// ===================================
// روابط البحث + روابط الأفلييت لكل مصدر
// Travelpayouts + Trip.com + Booking.com + Agoda

// ────────────────────────────────────
// إعدادات Travelpayouts
// ────────────────────────────────────
const TRAVELPAYOUTS = {
  MARKER:     process.env.TRAVELPAYOUTS_MARKER     || '',  // رقم الـ marker الخاص بك
  TRIP_TOKEN: process.env.TRAVELPAYOUTS_TRIP_TOKEN || '',  // Trip.com affiliate token
};

// ────────────────────────────────────
// بناء روابط البحث مع الأفلييت
// ────────────────────────────────────

/**
 * Trip.com — رحلات طيران + فنادق + باقات
 * Travelpayouts affiliate
 */
function buildTripUrl({ type, destination, origin, checkIn, checkOut, adults = 2, children = 0 }) {
  const marker = TRAVELPAYOUTS.MARKER;
  const base   = 'https://www.trip.com';

  let url = '';

  if (type === 'flight' && origin) {
    // صفحة البحث عن طيران
    url = `${base}/flights/`;
    if (origin && destination && checkIn) {
      url = `${base}/flights/${encodeURIComponent(origin)}-${encodeURIComponent(destination)}/`;
    }
  } else if (type === 'hotel') {
    url = `${base}/hotels/list?city=${encodeURIComponent(destination)}`;
    if (checkIn)  url += `&checkin=${checkIn}`;
    if (checkOut) url += `&checkout=${checkOut}`;
    url += `&adult=${adults}&children=${children}`;
  } else {
    // باقات وغيرها
    url = `${base}/travel-guide/${encodeURIComponent(destination.toLowerCase())}/`;
  }

  // أضف الأفلييت
  if (marker) url += (url.includes('?') ? '&' : '?') + `utm_medium=affiliate&utm_source=fetchli&marker=${marker}`;

  return url;
}

/**
 * Booking.com — فنادق + شقق
 * Travelpayouts affiliate
 */
function buildBookingUrl({ destination, checkIn, checkOut, adults = 2, children = 0 }) {
  const marker = TRAVELPAYOUTS.MARKER;

  let url = `https://www.booking.com/search.html?ss=${encodeURIComponent(destination)}`;
  if (checkIn)  url += `&checkin=${checkIn}`;
  if (checkOut) url += `&checkout=${checkOut}`;
  url += `&group_adults=${adults}&group_children=${children}&no_rooms=1`;

  // Travelpayouts affiliate لـ Booking
  if (marker) {
    url = `https://tp.media/r?marker=${marker}&trs=233070&p=4&u=${encodeURIComponent(url)}`;
  }

  return url;
}

/**
 * Agoda — فنادق آسيا والشرق الأوسط
 */
function buildAgodaUrl({ destination, checkIn, checkOut, adults = 2, children = 0 }) {
  const marker = TRAVELPAYOUTS.MARKER;

  let url = `https://www.agoda.com/search?city=${encodeURIComponent(destination)}`;
  if (checkIn)  url += `&checkIn=${checkIn}`;
  if (checkOut) url += `&checkOut=${checkOut}`;
  url += `&rooms=1&adults=${adults}&children=${children}`;

  if (marker) {
    url = `https://tp.media/r?marker=${marker}&trs=233070&p=1809&u=${encodeURIComponent(url)}`;
  }

  return url;
}

/**
 * يبني الروابط المناسبة حسب نوع الرحلة
 */
function buildSourceUrls(analysis) {
  const { travelTypeEn, destinationEn, originEn, checkIn, checkOut, adults, children } = analysis;
  const params = {
    type:        travelTypeEn,
    destination: destinationEn,
    origin:      originEn,
    checkIn,
    checkOut,
    adults:      adults || 2,
    children:    children || 0,
  };

  const urls = {
    trip:    buildTripUrl(params),
    booking: buildBookingUrl(params),
    agoda:   buildAgodaUrl(params),
  };

  return urls;
}

module.exports = { buildSourceUrls, buildTripUrl, buildBookingUrl, buildAgodaUrl, TRAVELPAYOUTS };
