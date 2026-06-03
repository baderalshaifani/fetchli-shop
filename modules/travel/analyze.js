// ===================================
// fetchli.shop — تحليل طلب السفر
// ===================================
// Claude يفهم طلب المستخدم ويحدد:
// الوجهة، التواريخ، عدد الأشخاص، نوع الرحلة

const { callClaudeJSON } = require('../../shared/claude');

// ────────────────────────────────────
// أنواع رحلات السفر
// ────────────────────────────────────
const TRAVEL_TYPES = {
  flight:   'طيران',
  hotel:    'فندق',
  package:  'باقة سياحية',
  cruise:   'رحلة بحرية',
  activity: 'فعالية / نشاط',
  tour:     'برنامج سياحي',
};

/**
 * يحلل طلب السفر النصي أو الصورة
 * @param {string|null} message     — رسالة المستخدم
 * @param {string|null} imageBase64 — صورة مكان (اختياري)
 * @returns {object} تفاصيل الرحلة المطلوبة
 */
async function analyzeTravelRequest(message, imageBase64 = null) {
  const content = [];

  // أضف الصورة لو رفع صورة مكان
  if (imageBase64) {
    content.push({
      type:   'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
    });
  }

  content.push({
    type: 'text',
    text: `أنت خبير سفر متخصص في السياحة الخليجية والعربية.
${imageBase64 ? 'المستخدم رفع صورة مكان — حدد الوجهة منها إن أمكن.' : ''}
${message ? `طلب المستخدم: "${message}"` : ''}

استخرج بدقة:
1. نوع الرحلة: طيران / فندق / باقة / رحلة بحرية / فعالية / برنامج سياحي
2. الوجهة (المدينة أو الدولة)
3. مدينة المغادرة (إن ذُكرت)
4. تاريخ الذهاب وتاريخ العودة (إن ذُكرا)
5. عدد الأشخاص (بالغين / أطفال)
6. الميزانية أو درجة الخدمة (اقتصادي / أعمال / فاخر)
7. متطلبات خاصة (عائلي، شهر عسل، مجموعة، إلخ)

أنشئ 4 كلمات بحث إنجليزية للبحث في مواقع السفر:
- بحث ١: الأكثر تحديداً (وجهة + تاريخ + نوع + درجة)
- بحث ٢: بدون تاريخ (وجهة + نوع + درجة خدمة)
- بحث ٣: عام (وجهة + نوع رحلة)
- بحث ٤: بديل أو قريب (وجهات مشابهة أو مجاورة)

رد بـ JSON فقط:
{
  "travelType": "نوع الرحلة بالعربي",
  "travelTypeEn": "flight|hotel|package|cruise|activity|tour",
  "destination": "الوجهة بالعربي",
  "destinationEn": "destination in English",
  "origin": "مدينة المغادرة أو null",
  "originEn": "origin city in English or null",
  "checkIn": "YYYY-MM-DD أو null",
  "checkOut": "YYYY-MM-DD أو null",
  "adults": 2,
  "children": 0,
  "serviceClass": "economy|business|luxury|any",
  "specialNeeds": "عائلي / شهر عسل / إلخ أو null",
  "searchQueries": ["q1","q2","q3","q4"],
  "reply": "رد ودي قصير بالعربي يلخص ما فهمته",
  "confidence": 88
}`,
  });

  try {
    const result = await callClaudeJSON({
      system:      'أنت نظام تحليل طلبات السفر. رد بـ JSON فقط بدون أي نص إضافي.',
      userContent: content,
      maxTokens:   1000,
    });
    return result;
  } catch (err) {
    console.error('Travel analyze error:', err.message);
    // Fallback بسيط
    return buildTravelFallback(message);
  }
}

/**
 * Fallback لو Claude فشل
 */
function buildTravelFallback(message) {
  return {
    travelType:   'رحلة سياحية',
    travelTypeEn: 'package',
    destination:  message || 'وجهة سياحية',
    destinationEn: message || 'tourist destination',
    origin:       null,
    checkIn:      null,
    checkOut:     null,
    adults:       2,
    children:     0,
    serviceClass: 'any',
    specialNeeds: null,
    searchQueries: [
      message || 'travel package',
      `${message || 'vacation'} hotel`,
      `${message || 'trip'} flights`,
      `${message || 'tour'} deals`,
    ],
    reply:      'جاري البحث عن أفضل خيارات السفر لك...',
    confidence: 60,
  };
}

module.exports = { analyzeTravelRequest, buildTravelFallback, TRAVEL_TYPES };
