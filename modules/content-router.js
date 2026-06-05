// ===================================
// fetchli — modules/content-router.js
// ===================================

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

// مسار الملف — Render Disk أو local fallback
const DATA_FILE = process.env.DATA_PATH
  ? path.join(process.env.DATA_PATH, 'content.json')
  : path.join(__dirname, '../data/content.json');

const DEFAULT_CONTENT = {
  tips:         { ar: [], en: [], de: [] },
  blog:         { ar: { travel: [], shop: [] }, en: { travel: [], shop: [] }, de: { travel: [], shop: [] } },
  manual_deals: { travel: [], shop: [] },
};

function readContent() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('content read error:', e.message); }
  return DEFAULT_CONTENT;
}

function writeContent(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('content write error:', e.message);
    return false;
  }
}

function auth(req, res, next) {
  const pass = req.headers['x-admin-password'] || req.query.token;
  if (pass !== (process.env.ADMIN_PASSWORD || 'fetchli2026')) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  next();
}

// ── GET /api/admin/content ── (عام — للفرونت)
router.get('/content', (req, res) => {
  res.json(readContent());
});

// ── POST /api/admin/content ── (أدمن فقط)
router.post('/content', auth, (req, res) => {
  const { type, data } = req.body;
  if (!type || !data) return res.status(400).json({ error: 'type و data مطلوبان' });

  const content = readContent();
  if      (type === 'tips')  content.tips         = data;
  else if (type === 'blog')  content.blog         = data;
  else if (type === 'deals') content.manual_deals = data;
  else return res.status(400).json({ error: 'نوع غير معروف: ' + type });

  const ok = writeContent(content);
  if (ok) res.json({ ok: true });
  else    res.status(500).json({ error: 'فشل الحفظ — تحقق من Render Disk' });
});

module.exports = router;
