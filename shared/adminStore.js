// ===================================
// shared/adminStore.js
// تخزين إعدادات لوحة التحكم (المتاجر + المحتوى) في Supabase
// جدول: app_config (key text PK, value jsonb, updated_at timestamptz)
// مع كاش في الذاكرة لمدة دقيقة لتقليل الطلبات
// ===================================

const fetch  = require('node-fetch');
const config = require('../config');

const CACHE_TTL = 60 * 1000; // دقيقة واحدة
const _cache = new Map();    // key → { value, ts }

function supabaseReady() {
  return Boolean(config.SUPABASE_URL && config.SUPABASE_SERVICE_KEY);
}

function headers() {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${config.SUPABASE_SERVICE_KEY}`,
    'apikey':        config.SUPABASE_SERVICE_KEY,
  };
}

// ── قراءة قيمة ──
async function getConfigValue(key, def = null) {
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.value;

  if (!supabaseReady()) return def;
  try {
    const res = await fetch(
      `${config.SUPABASE_URL}/rest/v1/app_config?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: headers() }
    );
    const rows  = await res.json();
    const value = Array.isArray(rows) && rows[0] ? rows[0].value : def;
    _cache.set(key, { value, ts: Date.now() });
    return value;
  } catch (err) {
    console.error('[adminStore] get error:', err.message);
    return def;
  }
}

// ── حفظ قيمة (upsert) ──
async function setConfigValue(key, value) {
  if (!supabaseReady()) throw new Error('Supabase غير مهيأ (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
  const res = await fetch(`${config.SUPABASE_URL}/rest/v1/app_config?on_conflict=key`, {
    method:  'POST',
    headers: { ...headers(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body:    JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase: ${txt.slice(0, 120)}`);
  }
  _cache.set(key, { value, ts: Date.now() });
  return true;
}

// ── middleware حماية مسارات الأدمن ──
// admin.html يرسل أحياناً x-admin-token وأحياناً x-admin-password — ندعم الاثنين
function adminAuth(req, res, next) {
  if (!config.ADMIN_PASSWORD) {
    return res.status(503).json({ ok: false, error: 'ADMIN_PASSWORD غير مضبوطة في env' });
  }
  const token = req.headers['x-admin-token'] || req.headers['x-admin-password'] || '';
  if (token !== config.ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

module.exports = { getConfigValue, setConfigValue, adminAuth };
