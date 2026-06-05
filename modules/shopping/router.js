// ===================================
// fetchli.shop — Routes التسوق
// ===================================
// /api/analyze  — تحليل الصورة/النص
// /api/search   — البحث في المتاجر
// /api/filter   — ترتيب النتائج

const express  = require('express');
const router   = express.Router();

const { analyzeWithGoogleVision }          = require('./vision');
const { analyzeWithClaude, buildFallbackFromVision } = require('./analyze');
const { searchProducts }                   = require('./search');
const { filterProducts }                   = require('./filter');

// ────────────────────────────────────
// POST /api/analyze
// تحليل متكامل: Vision → Claude → Fallback
// ────────────────────────────────────
router.post('/analyze', async (req, res) => {
  try {
    const { message, imageBase64, wantCheaper = false } = req.body;

    // المرحلة ١: Google Vision
    let visionData = null;
    if (imageBase64) {
      visionData = await analyzeWithGoogleVision(imageBase64);
    }

    // المرحلة ٢: Claude
    let analyzed = null;
    try {
      analyzed = await analyzeWithClaude(message, imageBase64, visionData, wantCheaper);
    } catch (err) {
      console.error('Claude analyze failed, using fallback:', err.message);
    }

    // Fallback لو Claude فشل
    if (!analyzed || !analyzed.searchQueries?.length) {
      analyzed = buildFallbackFromVision(visionData, message, wantCheaper);
    }

    // رفع الثقة لو Vision أكد الماركة
    if (visionData?.logos?.length > 0 && analyzed.brand) {
      analyzed.confidence = Math.min(98, (analyzed.confidence || 85) + 5);
    }

    res.json({ ...analyzed, visionData });

  } catch (err) {
    console.error('Analyze error:', err);
    res.json({
      searchQueries: [req.body.message || 'product'],
      reply:         'جاري البحث...',
      confidence:    60,
    });
  }
});

// ────────────────────────────────────
// POST /api/search
// البحث في المتاجر بكلمات البحث
// ────────────────────────────────────
router.post('/search', async (req, res) => {
  try {
    const { queries, query, market = 'SA', wantCheaper = false } = req.body;
    const searchTerms = queries || (query ? [query] : []);

    const result = await searchProducts(searchTerms, market, wantCheaper);
    res.json(result);

  } catch (err) {
    console.error('Search error:', err);
    res.json({ products: [], error: err.message });
  }
});

// ────────────────────────────────────
// POST /api/filter
// ترتيب النتائج بـ Claude
// ────────────────────────────────────
router.post('/filter', async (req, res) => {
  try {
    const { products, originalAnalysis, wantCheaper } = req.body;
    const filtered = await filterProducts(products, originalAnalysis, wantCheaper);
    res.json({ products: filtered });

  } catch (err) {
    console.error('Filter error:', err);
    res.json({ products: req.body.products || [] });
  }
});


const { getShoppingDeals } = require('./deals');

router.get('/deals/shop', async (req, res) => {
  try {
    const market = req.query.market || 'SA';
    const deals  = await getShoppingDeals(market);
    if (deals?.length) return res.json({ deals, source: 'amazon' });
    res.json({ deals: [], source: 'fallback' });
  } catch (err) {
    res.json({ deals: [], source: 'error' });
  }
});

module.exports = router;
