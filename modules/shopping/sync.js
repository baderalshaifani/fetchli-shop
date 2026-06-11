// ===================================
// fetchli.shop — مزامنة المنتجات
// AliExpress API — Keywords + Categories Loop
// ===================================

const fetch  = require('node-fetch');
const crypto = require('crypto');
require('dotenv').config();

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_API_KEY       = process.env.OPENAI_API_KEY;
const ALI_APP_KEY          = process.env.ALIEXPRESS_APP_KEY    || '535192';
const ALI_APP_SECRET       = process.env.ALIEXPRESS_APP_SECRET || '';
const ALI_ACCESS_TOKEN     = process.env.ALIEXPRESS_ACCESS_TOKEN || '';
const ALI_TRACKING_ID      = process.env.ALIEXPRESS_TRACKING_ID || 'default';

// ────────────────────────────────────
// الكلمات المفتاحية الأكثر بحثاً في الخليج
// ────────────────────────────────────
const SEARCH_TARGETS = [
  // ── ملابس وأزياء ──
  { keywords: 'women abaya',          category: '200003496', pages: 20 },
  { keywords: 'women dress',          category: '200003496', pages: 20 },
  { keywords: 'women hijab fashion',  category: '200003500', pages: 15 },
  { keywords: 'men thobe',            category: '200003500', pages: 15 },
  { keywords: 'women blouse top',     category: '200003500', pages: 15 },
  { keywords: 'men shirt',            category: '200003500', pages: 15 },

  // ── حقائب ──
  { keywords: 'women handbag leather',category: '200003499', pages: 20 },
  { keywords: 'women shoulder bag',   category: '200003499', pages: 20 },
  { keywords: 'luxury bag',           category: '200003499', pages: 15 },
  { keywords: 'backpack school',      category: '200003499', pages: 10 },

  // ── أحذية ──
  { keywords: 'women heels shoes',    category: '200003501', pages: 20 },
  { keywords: 'sneakers men',         category: '200003501', pages: 20 },
  { keywords: 'sandals women',        category: '200003501', pages: 15 },
  { keywords: 'sport shoes',          category: '200003501', pages: 15 },

  // ── ساعات ──
  { keywords: 'luxury watch men',     category: '200000828', pages: 20 },
  { keywords: 'smart watch',          category: '200000828', pages: 20 },
  { keywords: 'women watch gold',     category: '200000828', pages: 15 },

  // ── إلكترونيات ──
  { keywords: 'wireless earbuds',     category: '200003824', pages: 20 },
  { keywords: 'phone case iphone',    category: '509',       pages: 15 },
  { keywords: 'bluetooth speaker',    category: '200003824', pages: 15 },
  { keywords: 'laptop accessories',   category: '200003791', pages: 10 },
  { keywords: 'smart home device',    category: '509',       pages: 10 },

  // ── جمال وعناية ──
  { keywords: 'perfume women',        category: '200003833', pages: 20 },
  { keywords: 'skincare set',         category: '200003835', pages: 15 },
  { keywords: 'hair care',            category: '200003835', pages: 10 },
  { keywords: 'makeup brush set',     category: '200003835', pages: 10 },
{ keywords: 'lipstick makeup',      category: '200003835', pages: 15 }, // 
{ keywords: 'foundation makeup',    category: '200003835', pages: 10 }, // 
{ keywords: 'eyeshadow palette',    category: '200003835', pages: 10 }, // 
  // ── إكسسوارات ──
  { keywords: 'gold necklace women',  category: '200003826', pages: 15 },
  { keywords: 'sunglasses women',     category: '200003827', pages: 15 },
  { keywords: 'ring jewelry',         category: '200003826', pages: 10 },

  // ── منزل وديكور ──
  { keywords: 'home decor',           category: '200003708', pages: 10 },
  { keywords: 'kitchen gadget',       category: '200003708', pages: 10 },
  { keywords: 'bedding set',          category: '200003708', pages: 10 },

  // ── رياضة ──
  { keywords: 'gym workout equipment',category: '200003810', pages: 10 },
  { keywords: 'yoga mat',             category: '200003810', pages: 10 },
];

// ────────────────────────────────────
// توليد Embedding عبر OpenAI
// ────────────────────────────────────
async function generateEmbedding(text) {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 500),
      }),
    });
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    return null;
  }
}

// ────────────────────────────────────
// تخزين منتج في Supabase
// ────────────────────────────────────
async function upsertProduct(product, embedding) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=source,external_id`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':        SUPABASE_SERVICE_KEY,
        'Prefer':        'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        ...product,
        embedding,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      if (!err.includes('duplicate')) {
        console.error('❌ Supabase:', err.slice(0, 100));
      }
    }
  } catch (err) {
    console.error('❌ upsert:', err.message);
  }
}

// ────────────────────────────────────
// حساب توقيع MD5
// ────────────────────────────────────
function signRequest(params, secret) {
  const sorted = Object.keys(params).sort();
  let str = secret;
  for (const key of sorted) { str += key + params[key]; }
  str += secret;
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

// ────────────────────────────────────
// جلب صفحة واحدة من AliExpress
// ────────────────────────────────────
async function fetchPage(keywords, categoryId, pageNo) {
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const params = {
      method:          'aliexpress.affiliate.product.query',
      app_key:         ALI_APP_KEY,
      access_token:    ALI_ACCESS_TOKEN,
      sign_method:     'md5',
      format:          'json',
      v:               '2.0',
      timestamp,
      tracking_id:     ALI_TRACKING_ID,
      target_currency: 'SAR',
      target_language: 'EN',
      keywords,
      category_ids:    categoryId,
      sort:            'SALE_PRICE_ASC',
      page_no:         String(pageNo),
      page_size:       '50',
      fields:          'product_id,product_title,target_sale_price,target_sale_price_currency,product_main_image_url,product_detail_url,evaluate_rate,second_level_category_name,first_level_category_name',
    };
    params.sign = signRequest(params, ALI_APP_SECRET);

    const res  = await fetch('https://api-sg.aliexpress.com/sync', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams(params),
    });
    const data = await res.json();

    const result = data?.aliexpress_affiliate_product_query_response?.resp_result?.result;
    const items  = result?.products?.product || [];
    const total  = result?.total_record_count || 0;

    return { items, total };
  } catch (err) {
    console.error(`❌ fetchPage error:`, err.message);
    return { items: [], total: 0 };
  }
}

// ────────────────────────────────────
// معالجة وتخزين منتج
// ────────────────────────────────────
async function processProduct(p, keywords) {
  const product = {
    source:      'aliexpress',
    external_id: String(p.product_id),
    name:        (p.product_title || '').slice(0, 200),
    description: (p.product_title || '').slice(0, 500),
    price:       parseFloat(p.target_sale_price) || 0,
    currency:    p.target_sale_price_currency || 'USD',
    image_url:   p.product_main_image_url || '',
    product_url: p.product_detail_url || '',
    category:    p.second_level_category_name || p.first_level_category_name || keywords,
    brand:       null,
    rating:      p.evaluate_rate ? parseFloat(p.evaluate_rate) / 20 : null,
    in_stock:    true,
  };

  const text      = [product.name, product.category, keywords].filter(Boolean).join(' ');
  const embedding = await generateEmbedding(text);
  if (!embedding) return false;

  await upsertProduct(product, embedding);
  return true;
}

// ────────────────────────────────────
// مزامنة keyword واحد
// ────────────────────────────────────
async function syncKeyword(target, globalStats) {
  const { keywords, category, pages } = target;
  let saved = 0;

  console.log(`\n🔍 "${keywords}" — حتى ${pages} صفحة`);

  for (let page = 1; page <= pages; page++) {
    const { items, total } = await fetchPage(keywords, category, page);

    if (!items.length) {
      console.log(`  ⚠️ "${keywords}" صفحة ${page}: لا نتائج — توقف`);
      break;
    }

    for (const item of items) {
      const ok = await processProduct(item, keywords);
      if (ok) {
        saved++;
        globalStats.total++;
      }
      await new Promise(r => setTimeout(r, 30));
    }

    console.log(`  ✅ "${keywords}" صفحة ${page}/${pages} — ${saved} محفوظ | إجمالي: ${globalStats.total}`);
    await new Promise(r => setTimeout(r, 300));
  }

  return saved;
}

// ────────────────────────────────────
// المزامنة الرئيسية
// ────────────────────────────────────
async function syncProducts() {
  console.log('🚀 بدء المزامنة الذكية:', new Date().toLocaleString('ar-SA'));
  console.log(`📋 ${SEARCH_TARGETS.length} keyword/category للمعالجة`);

  const globalStats = { total: 0 };

  for (const target of SEARCH_TARGETS) {
    await syncKeyword(target, globalStats);
    // تأخير بين الكلمات المفتاحية
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n🎉 اكتملت المزامنة الكاملة: ${globalStats.total} منتج محفوظ`);
}

module.exports = { syncProducts };
