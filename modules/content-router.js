// ===================================
// fetchli.shop — Admin Content Router
// ===================================
// يستقبل النصائح والمدونة والعروض من الأدمن
// يحفظها في admin-config.json على Render Disk

const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const CONFIG_PATH = process.env.CONFIG_PATH || '/var/data/admin-config.json';
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'fetchli2026';

// ── قراءة الكونفيج ──
function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch(e) {}
  return { tips: { ar:[], en:[], de:[] }, blog: {}, deals: { travel:[], shop:[] } };
}

// ── كتابة الكونفيج ──
function writeConfig(data) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

// ── Middleware: تحقق من الباسورد ──
function authAdmin(req, res, next) {
  const pass = req.headers['x-admin-password'] || req.body?.password;
  if (pass !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ────────────────────────────────────
// GET /api/admin/content?type=tips|blog|deals
// يرجع البيانات للفرونت
// ────────────────────────────────────
router.get('/content', (req, res) => {
  const { type } = req.query;
  const config = readConfig();

  if (type === 'tips')  return res.json(config.tips  || { ar:[], en:[], de:[] });
  if (type === 'blog')  return res.json(config.blog  || {});
  if (type === 'deals') return res.json(config.deals || { travel:[], shop:[] });

  // إرجاع كل شيء
  res.json(config);
});

// ────────────────────────────────────
// POST /api/admin/content
// يحفظ البيانات من الأدمن
// ────────────────────────────────────
router.post('/content', authAdmin, (req, res) => {
  try {
    const { type, data } = req.body;
    if (!type || !data) return res.status(400).json({ error: 'Missing type or data' });

    const config = readConfig();

    if (type === 'tips')  config.tips  = data;
    if (type === 'blog')  config.blog  = data;
    if (type === 'deals') config.deals = data;

    writeConfig(config);
    console.log(`✅ Admin saved: ${type}`);
    res.json({ ok: true, type });

  } catch(err) {
    console.error('Content save error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────
// GET /api/tip?lang=ar
// نصيحة اليوم — تتناوب حسب اليوم
// ────────────────────────────────────
router.get('/tip', (req, res) => {
  const lang   = req.query.lang || 'ar';
  const config = readConfig();
  const tips   = config.tips?.[lang] || [];

  if (!tips.length) {
    // نصائح افتراضية لو ما في شيء
    const defaults = {
      ar: 'احجز الفنادق قبل 21 يوماً للحصول على أفضل الأسعار.',
      en: 'Book hotels at least 21 days in advance for the best rates.',
      de: 'Buchen Sie Hotels mindestens 21 Tage im Voraus für beste Preise.',
    };
    return res.json({ tip: defaults[lang] || defaults.ar });
  }

  // تناوب حسب رقم اليوم في السنة
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  const tip = tips[dayOfYear % tips.length];
  res.json({ tip });
});

// ────────────────────────────────────
// GET /api/blog?lang=ar&type=travel|shop
// مقالات المدونة
// ────────────────────────────────────
router.get('/blog', (req, res) => {
  const { lang = 'ar', type } = req.query;
  const config  = readConfig();
  const langData = config.blog?.[lang] || { travel:[], shop:[] };

  if (type) return res.json(langData[type] || []);
  res.json(langData);
});

// ────────────────────────────────────
// GET /api/deals?type=travel|shop&lang=ar
// عروض يدوية من الأدمن
// ────────────────────────────────────
router.get('/deals', (req, res) => {
  const { type, lang = 'ar' } = req.query;
  const config = readConfig();
  const deals  = config.deals || { travel:[], shop:[] };

  if (type) return res.json(deals[type] || []);
  res.json(deals);
});

module.exports = router;
