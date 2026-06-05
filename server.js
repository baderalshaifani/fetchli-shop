// ===================================
// fetchli.shop — الباك اند (Router)
// ===================================
// هذا الملف router فقط — لا يحتوي على أي منطق
// كل موديول في مجلده المستقل:
//   modules/shopping/  — كل ما يخص التسوق
//   modules/travel/    — كل ما يخص السفر
//   shared/            — دوال مشتركة

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const config   = require('./config');

// ── Shared ───────────────────────────
const { detectLocation } = require('./shared/location');

// ── Modules ──────────────────────────
const shoppingRouter = require('./modules/shopping/router');
const travelRouter   = require('./modules/travel/router');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ────────────────────────────────────
// تحديد دولة المستخدم (مشترك)
// ────────────────────────────────────
app.get('/api/location', async (req, res) => {
  const ip       = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '';
  const location = await detectLocation(ip);
  res.json(location);
});

// ────────────────────────────────────
// Modules Routes
// ────────────────────────────────────
app.use('/api',         shoppingRouter);  // /api/analyze | /api/search | /api/filter
app.use('/api/travel',  travelRouter);    // /api/travel/analyze | /api/travel/search | /api/travel/suggest


const contentRouter = require('./modules/content-router');
app.use('/api/admin', contentRouter);
// ────────────────────────────────────
// تشغيل السيرفر
// ────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`✅ fetchli.shop running on port ${config.PORT}`);
  console.log(`   🛍️  Shopping : /api/analyze | /api/search | /api/filter`);
  console.log(`   ✈️  Travel   : /api/travel/analyze | /api/travel/search | /api/travel/suggest`);
});
