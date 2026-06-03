// ===================================
// fetchli.shop — Routes السفر
// ===================================
// POST /api/travel/analyze  — تحليل طلب السفر
// POST /api/travel/search   — البحث عن رحلات/فنادق
// GET  /api/travel/suggest  — اقتراحات وجهات

const express  = require('express');
const router   = express.Router();

const { analyzeTravelRequest }  = require('./analyze');
const { searchTravel }          = require('./search');

// ────────────────────────────────────
// POST /api/travel/analyze
// Claude يفهم طلب السفر ويستخرج التفاصيل
// ────────────────────────────────────
router.post('/analyze', async (req, res) => {
  try {
    const { message, imageBase64 } = req.body;

    if (!message && !imageBase64) {
      return res.status(400).json({ error: 'message or image required' });
    }

    const analysis = await analyzeTravelRequest(message, imageBase64);
    res.json(analysis);

  } catch (err) {
    console.error('Travel analyze error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────
// POST /api/travel/search
// يبحث في Trip.com + Booking + Agoda
// ────────────────────────────────────
router.post('/search', async (req, res) => {
  try {
    const { analysis, market = 'SA' } = req.body;

    if (!analysis) {
      return res.status(400).json({ error: 'analysis object required' });
    }

    const result = await searchTravel(analysis, market);
    res.json(result);

  } catch (err) {
    console.error('Travel search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────
// GET /api/travel/suggest
// اقتراحات وجهات شهيرة من السعودية
// ────────────────────────────────────
router.get('/suggest', (req, res) => {
  const suggestions = [
    { name: 'إسطنبول',   nameEn: 'Istanbul',  emoji: '🕌', tag: 'الأكثر طلباً'   },
    { name: 'دبي',       nameEn: 'Dubai',     emoji: '🌆', tag: 'قريبة وسريعة'   },
    { name: 'بانكوك',    nameEn: 'Bangkok',   emoji: '🏯', tag: 'الأوفر سعراً'   },
    { name: 'المالديف',  nameEn: 'Maldives',  emoji: '🏝️', tag: 'شهر العسل'      },
    { name: 'لندن',      nameEn: 'London',    emoji: '🎡', tag: 'تسوق وترفيه'    },
    { name: 'باريس',     nameEn: 'Paris',     emoji: '🗼', tag: 'رومانسية'        },
    { name: 'القاهرة',   nameEn: 'Cairo',     emoji: '🏺', tag: 'حضارة وتاريخ'   },
    { name: 'جورجيا',    nameEn: 'Georgia',   emoji: '⛰️', tag: 'طبيعة خلابة'   },
  ];
  res.json({ suggestions });
});

module.exports = router;
