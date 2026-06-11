// ===================================
// fetchli.shop — السيرفر الرئيسي (راوتر خفيف)
// التسوق: modules/shopping · السفر: modules/travel
// ===================================

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const config  = require('./config');
const { locationHandler } = require('./shared/location');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── مشترك ──
app.get('/api/location', locationHandler);
app.get('/health', (_, res) => res.json({
  status:   'ok',
  service:  'fetchli-shop',
  shopping: config.ENABLE_SHOPPING,
  travel:   config.ENABLE_TRAVEL,
}));

// ── الوحدات ──
if (config.ENABLE_SHOPPING) app.use(require('./modules/shopping'));
if (config.ENABLE_TRAVEL)   app.use(require('./modules/travel'));

// ── تشغيل ──
app.listen(config.PORT, () => {
  console.log(`✅ fetchli.shop running on port ${config.PORT} (shopping:${config.ENABLE_SHOPPING} travel:${config.ENABLE_TRAVEL})`);
});
