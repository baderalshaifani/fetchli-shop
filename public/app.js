// ===================================
// fetchli.shop — منطق الفرونت
// ===================================

const API = '';
let userLocation = { country: 'SA', market: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'السعودية' };
let currentLang = 'ar';
let currentMode = 'shop'; // shop | travel

// ────────────────────────────────────
// تحديد الدولة
// ────────────────────────────────────
async function detectLocation() {
  try {
    const res  = await fetch(`${API}/api/location`);
    const data = await res.json();
    userLocation = data;
    const locEl = document.getElementById('locName');
    if (locEl) locEl.textContent = data.flag + ' ' + data.name;
  } catch (e) {}
}

// ────────────────────────────────────
// جلب المحتوى من السيرفر وعرضه
// ────────────────────────────────────
async function loadContent() {
  try {
    const res  = await fetch(`${API}/api/admin/content`);
    const data = await res.json();
    renderTip(data.tips);
    renderDeals(data.manual_deals);
    renderArticles(data.blog);
  } catch (e) {
    // السيرفر ما رجع — نعرض placeholders
    renderTip(null);
    renderDeals(null);
    renderArticles(null);
  }
}

// ── نصيحة اليوم ──
function renderTip(tips) {
  const el = document.getElementById('tip-text');
  if (!el) return;

  const lang    = currentLang;
  const tipList = tips?.[lang] || tips?.['ar'] || [];

  if (!tipList.length) {
    // fallback ثابت لو ما في نصائح محفوظة
    const fallbacks = {
      ar: 'قارن الأسعار دائماً قبل الشراء — وفّر حتى ٤٠٪ على نفس المنتج!',
      en: 'Always compare prices before buying — save up to 40% on the same product!',
      de: 'Vergleiche immer die Preise vor dem Kauf — spare bis zu 40%!',
    };
    el.textContent = fallbacks[lang] || fallbacks['ar'];
    return;
  }

  // نصيحة اليوم = مؤشر بناءً على رقم اليوم
  const dayIndex = new Date().getDate() % tipList.length;
  el.textContent = tipList[dayIndex];
}

// ── العروض اليومية ──
function renderDeals(deals) {
  const grid = document.getElementById('deals-grid');
  if (!grid) return;

  const mode  = currentMode; // shop | travel
  const items = deals?.[mode] || [];

  if (!items.length) {
    // fallback — عروض ثابتة لو ما في عروض محفوظة
    grid.innerHTML = getFallbackDeals(mode);
    return;
  }

  grid.innerHTML = items.map(d => `
    <div class="deal-card" style="background:${d.bg || (mode === 'travel' ? '#1a3a5c' : '#1a2a4a')}">
      <div class="deal-icon">${d.icon || (mode === 'travel' ? '✈️' : '🛍️')}</div>
      <div class="deal-body">
        <div class="deal-title">${d.title}</div>
        <div class="deal-meta">${d.cat || ''}</div>
        <div class="deal-price">${d.price || ''} ${d.savings ? `<span class="deal-save">وفّر ${d.savings}</span>` : ''}</div>
      </div>
      ${d.url ? `<a class="deal-btn" href="${d.url}" target="_blank" rel="noopener">اشترِ ←</a>` : ''}
    </div>
  `).join('');
}

function getFallbackDeals(mode) {
  if (mode === 'travel') return `
    <div class="deal-card" style="background:#1a3a5c">
      <div class="deal-icon">✈️</div>
      <div class="deal-body"><div class="deal-title">تذاكر دبي</div><div class="deal-price">من ٢٩٩ ر.س <span class="deal-save">وفّر ٤٠٪</span></div></div>
    </div>
    <div class="deal-card" style="background:#1a2d4a">
      <div class="deal-icon">🏨</div>
      <div class="deal-body"><div class="deal-title">فنادق القاهرة</div><div class="deal-price">من ١٩٩ ر.س <span class="deal-save">وفّر ٣٠٪</span></div></div>
    </div>
    <div class="deal-card" style="background:#162040">
      <div class="deal-icon">🚗</div>
      <div class="deal-body"><div class="deal-title">تأجير سيارات</div><div class="deal-price">من ٨٩ ر.س/يوم <span class="deal-save">وفّر ٢٥٪</span></div></div>
    </div>`;
  return `
    <div class="deal-card" style="background:#1a2a4a">
      <div class="deal-icon">📱</div>
      <div class="deal-body"><div class="deal-title">إلكترونيات</div><div class="deal-price">خصم حتى ٥٠٪</div></div>
    </div>
    <div class="deal-card" style="background:#1a1e3a">
      <div class="deal-icon">👗</div>
      <div class="deal-body"><div class="deal-title">ملابس وأزياء</div><div class="deal-price">خصم حتى ٤٠٪</div></div>
    </div>
    <div class="deal-card" style="background:#1e1a3a">
      <div class="deal-icon">🏠</div>
      <div class="deal-body"><div class="deal-title">أثاث وديكور</div><div class="deal-price">خصم حتى ٣٠٪</div></div>
    </div>`;
}

// ── مقالات المدونة ──
function renderArticles(blog) {
  const list = document.getElementById('articles-list');
  if (!list) return;

  const lang     = currentLang;
  const mode     = currentMode;
  const langData = blog?.[lang] || blog?.['ar'] || {};
  const items    = langData?.[mode] || [];

  if (!items.length) {
    list.innerHTML = getFallbackArticles(mode, lang);
    return;
  }

  list.innerHTML = items.slice(0, 4).map(a => `
    <div class="article-card">
      <div class="article-icon">${a.icon || '📄'}</div>
      <div class="article-body">
        <div class="article-title">${a.title}</div>
        <div class="article-meta">${a.cat || ''} ${a.read ? '· ' + a.read : ''}</div>
      </div>
      <div class="article-arrow">←</div>
    </div>
  `).join('');
}

function getFallbackArticles(mode, lang) {
  const articles = {
    ar: {
      travel: [
        { icon: '✈️', title: 'أفضل ١٠ وجهات سياحية في ٢٠٢٦', meta: 'سفر · ٥ دقائق' },
        { icon: '🏨', title: 'كيف تختار الفندق المثالي', meta: 'فنادق · ٣ دقائق' },
        { icon: '💳', title: 'نصائح توفير المال في السفر', meta: 'نصائح · ٤ دقائق' },
      ],
      shop: [
        { icon: '📱', title: 'أفضل هواتف ٢٠٢٦ بالمقارنة', meta: 'إلكترونيات · ٦ دقائق' },
        { icon: '👟', title: 'دليل شراء الأحذية الرياضية', meta: 'أزياء · ٤ دقائق' },
        { icon: '💡', title: 'كيف تتجنب المنتجات المقلدة', meta: 'نصائح · ٣ دقائق' },
      ],
    },
    en: {
      travel: [
        { icon: '✈️', title: 'Top 10 Travel Destinations 2026', meta: 'Travel · 5 min' },
        { icon: '🏨', title: 'How to Pick the Perfect Hotel', meta: 'Hotels · 3 min' },
        { icon: '💳', title: 'Money-Saving Travel Tips', meta: 'Tips · 4 min' },
      ],
      shop: [
        { icon: '📱', title: 'Best Phones of 2026 Compared', meta: 'Tech · 6 min' },
        { icon: '👟', title: 'Sneaker Buying Guide', meta: 'Fashion · 4 min' },
        { icon: '💡', title: 'How to Spot Fake Products', meta: 'Tips · 3 min' },
      ],
    },
  };

  const data = (articles[lang] || articles['ar'])[mode] || [];
  return data.map(a => `
    <div class="article-card">
      <div class="article-icon">${a.icon}</div>
      <div class="article-body">
        <div class="article-title">${a.title}</div>
        <div class="article-meta">${a.meta}</div>
      </div>
      <div class="article-arrow">←</div>
    </div>
  `).join('');
}

// ────────────────────────────────────
// Mode: shop / travel
// ────────────────────────────────────
function setMode(mode) {
  currentMode = mode;

  // UI cards
  document.getElementById('shopCard')?.classList.toggle('active-shop',   mode === 'shop');
  document.getElementById('travelCard')?.classList.toggle('active-travel', mode === 'travel');

  // Hero accent color + label
  const accent = document.getElementById('heroAccent');
  const label  = document.getElementById('chatModeLabel');
  const sendBtn = document.getElementById('sendBtn');
  if (accent) accent.style.color = mode === 'shop' ? 'var(--shop)' : 'var(--travel)';
  if (label)  label.textContent  = mode === 'shop' ? 'مساعد التسوق الذكي' : 'مساعد السفر الذكي';
  if (sendBtn) { sendBtn.classList.toggle('shop-send', mode === 'shop'); sendBtn.classList.toggle('travel-send', mode === 'travel'); }

  // Hero BG
  const bg = document.getElementById('heroBg');
  if (bg) { bg.className = 'hero-bg ' + mode; }

  // عنوان الأقسام
  const dealsTitle    = document.getElementById('deals-title');
  const articlesTitle = document.getElementById('articles-title');
  if (mode === 'travel') {
    if (dealsTitle)    dealsTitle.textContent    = '✈️ أفضل عروض السفر';
    if (articlesTitle) articlesTitle.textContent = '📖 مقالات السفر';
  } else {
    if (dealsTitle)    dealsTitle.textContent    = '🔥 أفضل العروض';
    if (articlesTitle) articlesTitle.textContent = '📖 من المدونة';
  }

  // Chips
  renderChips(mode);

  // إعادة عرض المحتوى حسب الـ mode الجديد
  loadContent();
}

// ────────────────────────────────────
// Chips (اقتراحات سريعة)
// ────────────────────────────────────
const CHIPS = {
  ar: {
    shop:   ['👟 أحذية نايك', '📱 آيفون ١٦', '👜 حقيبة فندي', '⌚ ساعة رولكس', '💄 باليت ظلال'],
    travel: ['🏖️ فنادق دبي', '✈️ رحلات بانكوك', '🏨 فنادق اسطنبول', '🚗 تأجير سيارات', '🌍 شرم الشيخ'],
  },
  en: {
    shop:   ['👟 Nike Shoes', '📱 iPhone 16', '👜 Fendi Bag', '⌚ Rolex Watch', '💄 Eye Palette'],
    travel: ['🏖️ Dubai Hotels', '✈️ Bangkok Flights', '🏨 Istanbul Hotels', '🚗 Car Rental', '🌍 Maldives'],
  },
  de: {
    shop:   ['👟 Nike Schuhe', '📱 iPhone 16', '👜 Handtasche', '⌚ Rolex Uhr', '💄 Lidschatten'],
    travel: ['🏖️ Dubai Hotels', '✈️ Bangkok Flüge', '🏨 Istanbul Hotels', '🚗 Auto mieten', '🌍 Malediven'],
  },
};

function renderChips(mode) {
  const row = document.getElementById('chipsRow');
  if (!row) return;
  const lang  = currentLang;
  const chips = CHIPS[lang]?.[mode] || CHIPS['ar'][mode];
  row.innerHTML = chips.map(c => `
    <button class="chip" onclick="handleSend('${c.replace(/^[^\s]+\s/, '')}')">
      ${c}
    </button>
  `).join('');
}

// ────────────────────────────────────
// إرسال رسالة
// ────────────────────────────────────
function handleSend(text) {
  const val = text || document.getElementById('msgInput')?.value?.trim();
  if (!val) return;
  sendMessage(val);
}

async function sendMessage(text, imageBase64 = null) {
  if (!text && !imageBase64) return;

  const wantCheaper = text && /أرخص|رخيص|بديل|أوفر|اقتصادي|cheaper|budget|alternative/i.test(text);

  addMessage('user', imageBase64 ? `📸 ${text || 'صورة منتج'}` : text);
  clearInput();
  showTyping('جاري تحليل طلبك...');

  try {
    // ── تحليل Claude ──
    const analyzeRes = await fetch(`${API}/api/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, imageBase64, wantCheaper, mode: currentMode }),
    });
    const analyzed = await analyzeRes.json();
    updateTyping('جاري البحث...');

    // ── بحث ──
    const searchRes = await fetch(`${API}/api/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ queries: analyzed.searchQueries || [text], market: userLocation.market || 'SA', wantCheaper }),
    });
    const { products, mock } = await searchRes.json();

    // ── تصفية ──
    let finalProducts = products;
    if (products?.length > 3 && analyzed.productType) {
      updateTyping('جاري اختيار الأفضل لك...');
      try {
        const filterRes = await fetch(`${API}/api/filter`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ products, originalAnalysis: analyzed, wantCheaper }),
        });
        const filtered = await filterRes.json();
        if (filtered.products?.length) finalProducts = filtered.products;
      } catch (e) {}
    }

    removeTyping();

    const confidence  = analyzed.confidence || 90;
    const reply       = analyzed.reply || `وجدت لك ${finalProducts.length} نتائج`;
    const detailLine  = analyzed.productType
      ? `\n🔍 ${analyzed.productType}${analyzed.brand ? ' • ' + analyzed.brand : ''}${analyzed.color ? ' • ' + analyzed.color : ''}`
      : '';
    const mockNote    = mock ? '\n\n_نتائج تجريبية_' : '';
    const accuracyNote = `\n✦ دقة التطابق: ${confidence}٪`;

    addMessage('ai', reply + detailLine + accuracyNote + mockNote);
    if (finalProducts?.length > 0) addProducts(finalProducts, wantCheaper);

  } catch (err) {
    removeTyping();
    addMessage('ai', 'حدث خطأ، حاول مرة ثانية 🙏');
    console.error(err);
  }
}

// ────────────────────────────────────
// رفع صورة
// ────────────────────────────────────
function handleImageUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result.split(',')[1];
    addImagePreview(e.target.result);
    sendMessage('أبي منتجات مشابهة', base64);
  };
  reader.readAsDataURL(file);
}

// ────────────────────────────────────
// DOM Helpers
// ────────────────────────────────────
function addMessage(role, text) {
  const chat = document.getElementById('chatArea');
  if (!chat) return;
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;
  row.innerHTML = `
    <div class="msg-avatar ${role}">${role === 'ai' ? '✦' : '👤'}</div>
    <div class="msg-bubble ${role}">${text}</div>
  `;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function addImagePreview(src) {
  const chat = document.getElementById('chatArea');
  if (!chat) return;
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="msg-avatar user">👤</div>
    <img src="${src}" class="img-preview" alt="صورة المنتج">
  `;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function addProducts(products, cheaper = false) {
  const chat = document.getElementById('chatArea');
  if (!chat) return;
  if (cheaper) {
    const label = document.createElement('div');
    label.className = 'cheaper-label';
    label.textContent = '💰 مرتبة من الأرخص للأغلى';
    chat.appendChild(label);
  }
  const grid = document.createElement('div');
  grid.className = 'products-grid';
  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-img-wrap">
        <img src="${p.image}" alt="${p.name}" class="product-img" loading="lazy">
        <span class="product-badge">${p.badge || ''}</span>
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-store">
          <span class="dot"></span>${p.store}
          ${p.rating ? `<span class="rating">⭐ ${p.rating}</span>` : ''}
        </div>
        <div class="product-price">${p.price}</div>
        <div class="product-actions">
          <button class="btn-details" onclick='openProduct(${JSON.stringify(p).replace(/"/g, "&quot;")})'>التفاصيل</button>
          <a class="btn-buy" href="${p.url}" target="_blank" rel="noopener">اشتري ←</a>
        </div>
      </div>
    </div>
  `).join('');
  chat.appendChild(grid);
  chat.scrollTop = chat.scrollHeight;
}

function openProduct(p) {
  document.getElementById('ms-name').textContent  = p.name;
  document.getElementById('ms-store').textContent = p.store;
  document.getElementById('ms-price').textContent = p.price;
  document.getElementById('ms-img').src           = p.image;
  document.getElementById('ms-link').href         = p.url;
  document.getElementById('ministore').style.display = 'flex';
}

function showTyping(msg = 'جاري البحث...') {
  const chat = document.getElementById('chatArea');
  if (!chat) return;
  const el = document.createElement('div');
  el.id = 'typing'; el.className = 'msg-row ai';
  el.innerHTML = `
    <div class="msg-avatar ai">✦</div>
    <div class="typing-wrap-inner">
      <div class="typing-bubble"><span></span><span></span><span></span></div>
      <div class="typing-label" id="typingLabel">${msg}</div>
    </div>
  `;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

function updateTyping(msg) {
  const label = document.getElementById('typingLabel');
  if (label) label.textContent = msg;
}

function removeTyping() { document.getElementById('typing')?.remove(); }
function clearInput()   { const i = document.getElementById('msgInput'); if (i) i.value = ''; }

// ────────────────────────────────────
// تبديل الصفحات
// ────────────────────────────────────
function showPage(page) {
  document.getElementById('home-content')?.style.setProperty('display', page === 'home' ? '' : 'none');
  ['privacy','terms','about','contact','blog'].forEach(p => {
    const el = document.getElementById(p + '-page');
    if (el) el.style.display = (p === page) ? 'block' : 'none';
  });
  window.scrollTo(0, 0);
}

// ────────────────────────────────────
// Init
// ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  detectLocation();
  loadContent();        // ← يجلب النصائح + العروض + المقالات
  setMode('shop');      // ← يضبط الـ mode الافتراضي ويرسم الـ chips

  // Input listeners
  document.getElementById('msgInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  document.getElementById('sendBtn')?.addEventListener('click', () => handleSend());

  document.getElementById('imageInput')?.addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0]);
  });

  // Ministore
  document.getElementById('ministore')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('ministore'))
      document.getElementById('ministore').style.display = 'none';
  });
  document.getElementById('ms-close')?.addEventListener('click', () => {
    document.getElementById('ministore').style.display = 'none';
  });
});
