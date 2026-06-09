// ===================================
// fetchli.shop — shop.js
// مخصص لقسم التسوق فقط
// ===================================

const API        = '';
const TRAVEL_API = 'https://fetchli-shop.onrender.com';
let userLocation = { country: 'SA', market: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'السعودية' };

// ── سياق المحادثة ──
let conversationContext = {
  lastProductType: null,
  lastBrand: null,
  lastColor: null,
  lastQuery: null,
  history: [],
};

// ── حالة المحادثة الذكية ──
let _conv = {
  mode:    null,   // 'shop' | 'travel' | null
  history: [],     // { role, content }
  context: {},
};

function resetConv() {
  _conv = { mode: null, history: [], context: {} };
}

// ────────────────────────────────────
// تحديد الدولة
// ────────────────────────────────────
async function detectLocation() {
  try {
    const res  = await fetch(`${API}/api/location`);
    const data = await res.json();
    userLocation = data;
    const el = document.getElementById('locName');
    if (el) el.textContent = (data.flag || '') + ' ' + (data.name || '');
  } catch (e) {}
}

// ────────────────────────────────────
// إرسال رسالة
// ────────────────────────────────────
async function sendMessage(text, imageBase64 = null) {
  if (!text && !imageBase64) return;

  const wantCheaper = text && /أرخص|رخيص|بديل|أوفر|اقتصادي|cheaper|budget|alternative/i.test(text);

  addMessage('user', imageBase64 ? `📸 ${text || 'صورة منتج'}` : text);
  clearInput();
  showTyping('جاري التفكير...');

  // ── أضف للتاريخ الذكي ──
  _conv.history.push({ role: 'user', content: text || 'صورة' });

  // ── استدعاء smart-chat لتحديد النوع والسؤال ──
  try {
    const smartRes = await fetch(`${API}/api/smart-chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ history: _conv.history }),
    });
    const decision = await smartRes.json();

    if (decision.context) _conv.context = { ..._conv.context, ...decision.context };
    if (decision.mode)    _conv.mode    = decision.mode;

    // ── إذا يحتاج سؤال توضيحي ──
    if (decision.action === 'ask' && decision.question) {
      removeTyping();
      addMessage('ai', decision.question);
      _conv.history.push({ role: 'assistant', content: decision.question });
      return;
    }

    // ── إذا هو سفر → أرسل لـ fetchli-shop ──
    if (_conv.mode === 'travel') {
      updateTyping('جاري البحث عن أفضل الأسعار...');
      const searchRes = await fetch(`${TRAVEL_API}/api/travel/search`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          analysis: {
            type:        _conv.context.tripType || 'mixed',
            origin:      _conv.context.origin,
            destination: _conv.context.destination,
            checkIn:     _conv.context.checkIn,
            checkOut:    _conv.context.checkOut,
            adults:      _conv.context.adults || 2,
            currency:    userLocation.currency || 'SAR',
            reply:       '',
          },
          market: userLocation.market || 'SA',
        }),
      });
      const data  = await searchRes.json();
      const cards = (data.cards || []).map(c => ({
        id: c.id, name: c.name, price: c.price, store: c.platform,
        image: c.image, url: c.url, badge: c.badge, rating: c.rating,
      }));
      removeTyping();
      if (cards.length > 0) {
        addMessage('ai', `وجدت لك ${cards.length} خيار ✈️`);
        addTravelCards(cards);
      } else {
        addMessage('ai', 'ما وجدت نتائج، حدد التاريخ والمدينة بشكل أوضح 🗓️');
      }
      resetConv();
      return;
    }

  } catch (e) {
    console.warn('smart-chat failed, falling back to shop:', e.message);
  }

  // ── تسوق — نفس المنطق الأصلي ──
  updateTyping('جاري تحليل طلبك...');

  // بناء الرسالة مع السياق
  let fullMessage = text;
  if (conversationContext.lastProductType && text && text.length < 20) {
    fullMessage = `${conversationContext.lastProductType} ${text}`;
    if (conversationContext.lastBrand) fullMessage += ` ${conversationContext.lastBrand}`;
  }

  // تحديث التاريخ
  conversationContext.history.push({ role: 'user', text });
  if (conversationContext.history.length > 3) conversationContext.history.shift();

  try {
    // ── المرحلة ١: تحليل بـ Claude ──
    const analyzeRes = await fetch(`${API}/api/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message:     fullMessage,
        imageBase64,
        wantCheaper,
        context:     conversationContext,
      }),
    });
    const analyzed = await analyzeRes.json();

    // حفظ السياق
    if (analyzed.productType) conversationContext.lastProductType = analyzed.productType;
    if (analyzed.brand)       conversationContext.lastBrand       = analyzed.brand;
    if (analyzed.color)       conversationContext.lastColor       = analyzed.color;
    conversationContext.lastQuery = analyzed.searchQueries?.[0] || text;

    updateTyping('جاري البحث في Amazon و AliExpress...');

    // ── المرحلة ٢: بحث موحد ──
    const searchRes = await fetch(`${API}/api/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        queries:     analyzed.searchQueries || [fullMessage],
        market:      userLocation.market || 'SA',
        wantCheaper,
      }),
    });
    const { amazon = [], aliexpress = [], amazonMock, aliMock } = await searchRes.json();

    removeTyping();

    // ── عرض الرد ──
    const confidence  = analyzed.confidence || 90;
    const reply       = analyzed.reply || 'وجدت لك نتائج من Amazon و AliExpress';
    const detailLine  = analyzed.productType
      ? `\n🔍 ${analyzed.productType}${analyzed.brand ? ' • ' + analyzed.brand : ''}${analyzed.color ? ' • ' + analyzed.color : ''}`
      : '';
    const accuracyNote = `\n✦ دقة التطابق: ${confidence}٪`;

    addMessage('ai', reply + detailLine + accuracyNote);

    // ── عرض Amazon ──
    if (amazon.length > 0) {
      addStoreSection('amazon', amazon, wantCheaper, amazonMock);
    }

    // ── عرض AliExpress ──
    if (aliexpress.length > 0) {
      addStoreSection('aliexpress', aliexpress, wantCheaper, aliMock);
    }

    if (!amazon.length && !aliexpress.length) {
      addMessage('ai', 'لم أجد نتائج مطابقة، حاول بكلمات مختلفة 🙏');
    }

  } catch (err) {
    removeTyping();
    addMessage('ai', 'حدث خطأ، حاول مرة ثانية 🙏');
    console.error(err);
  }
}

// ────────────────────────────────────
// عرض بطاقات السفر — نفس تصميم التسوق
// ────────────────────────────────────
function addTravelCards(cards) {
  const chat = document.getElementById('chatArea');
  if (!chat) return;

  const header = document.createElement('div');
  header.className = 'store-section-header store-amazon';
  header.innerHTML = `<span style="color:#1a73e8;font-size:1.1rem">✈️</span> <span style="font-weight:800">نتائج السفر</span> <span class="store-sort-tag">⭐ أفضل الأسعار</span>`;
  chat.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'products-grid';
  grid.innerHTML = cards.map(p => {
    const safeP = JSON.stringify(p).replace(/'/g,"&#39;").replace(/"/g,"&quot;");
    return `
    <div class="product-card store-card-amazon">
      <div class="product-img-wrap">
        ${p.image
          ? `<img src="${p.image}" alt="${p.name}" class="product-img" loading="lazy" onerror="this.src='';this.parentElement.innerHTML='<div style=height:120px;display:flex;align-items:center;justify-content:center;font-size:48px>✈️</div>'">`
          : `<div style="height:120px;display:flex;align-items:center;justify-content:center;font-size:48px">✈️</div>`}
        ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-store">
          <span class="dot" style="background:#1a73e8"></span>
          ${p.store || 'Aviasales'}
          ${p.rating ? `<span class="rating">⭐ ${p.rating}</span>` : ''}
        </div>
        <div class="product-price">${p.price}</div>
        <div class="product-actions">
          <button class="btn-details" onclick='openProduct(${safeP})'>التفاصيل</button>
          <a class="btn-buy btn-buy-amazon" href="${p.url}" target="_blank" rel="noopener noreferrer">احجز الآن ←</a>
        </div>
      </div>
    </div>`;
  }).join('');

  chat.appendChild(grid);
  chat.scrollTop = chat.scrollHeight;
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
// عرض قسم متجر
// ────────────────────────────────────
function addStoreSection(storeKey, products, cheaper, isMock) {
  const chat = document.getElementById('chatArea');
  if (!chat) return;

  const storeInfo = {
    amazon:     { label: 'Amazon',     icon: '🛒', color: '#FF9900', btnText: 'Amazon ←' },
    aliexpress: { label: 'AliExpress', icon: '🏪', color: '#e62e04', btnText: 'Ali ←'    },
  };
  const info = storeInfo[storeKey];
  const sortLabel = cheaper ? '📈 من الأرخص' : '⭐ الأعلى تقييماً';

  // رأس القسم
  const header = document.createElement('div');
  header.className = `store-section-header store-${storeKey}`;
  header.innerHTML = `
    <span style="color:${info.color};font-size:1.1rem">${info.icon}</span>
    <span style="font-weight:800">${info.label}</span>
    <span class="store-sort-tag">${sortLabel}</span>
    ${isMock ? '<span class="mock-tag">تجريبي</span>' : ''}
  `;
  chat.appendChild(header);

  // شبكة المنتجات
  const grid = document.createElement('div');
  grid.className = 'products-grid';
  grid.innerHTML = products.map(p => `
    <div class="product-card store-card-${storeKey}">
      <div class="product-img-wrap">
        <img src="${p.image || ''}" alt="${p.name}" class="product-img" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop'">
        ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-store">
          <span class="dot" style="background:${info.color}"></span>
          ${p.store}
          ${p.rating ? `<span class="rating">⭐ ${p.rating}${p.reviewCount ? ` <small>(${formatCount(p.reviewCount)})</small>` : ''}</span>` : ''}
        </div>
        <div class="product-price">${p.price}</div>
        <div class="product-actions">
          <button class="btn-details" onclick='openProduct(${JSON.stringify(p).replace(/'/g,"&#39;").replace(/"/g,"&quot;")})'>
            التفاصيل
          </button>
          <a class="btn-buy btn-buy-${storeKey}" href="${p.url}" target="_blank" rel="noopener noreferrer">
            ${info.btnText}
          </a>
        </div>
      </div>
    </div>
  `).join('');

  chat.appendChild(grid);
  chat.scrollTop = chat.scrollHeight;
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
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
  row.innerHTML = `<div class="msg-avatar user">👤</div><img src="${src}" class="img-preview" alt="صورة المنتج">`;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function openProduct(p) {
  document.getElementById('ms-name').textContent  = p.name;
  document.getElementById('ms-store').textContent = p.store;
  document.getElementById('ms-price').textContent = p.price;
  document.getElementById('ms-img').src           = p.image || '';
  document.getElementById('ms-link').href         = p.url;
  document.getElementById('ministore').style.display = 'flex';
}

function showTyping(msg = 'جاري البحث...') {
  const chat = document.getElementById('chatArea');
  if (!chat) return;
  const el = document.createElement('div');
  el.id = 'typing';
  el.className = 'msg-row ai';
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
// Chips
// ────────────────────────────────────
function renderShopChips() {
  const chips = [
    { label: '👟 أحذية نايك', query: 'أحذية نايك' },
    { label: '📱 أيفون ١٦',   query: 'أيفون ١٦' },
    { label: '👜 حقيبة فندي', query: 'حقيبة فندي' },
    { label: '⌚ ساعة رولكس', query: 'ساعة رولكس' },
    { label: '🌙 بايلت ظلال', query: 'بايلت ظلال' },
  ];
  const container = document.getElementById('chipsContainer') || document.querySelector('.chips-row');
  if (!container) return;
  container.innerHTML = chips.map(c =>
    `<button class="chip" onclick="sendMessage('${c.query}')">${c.label}</button>`
  ).join('');
}

// ────────────────────────────────────
// Init
// ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  detectLocation();
  renderShopChips();

  document.getElementById('msgInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const val = document.getElementById('msgInput')?.value?.trim();
      if (val) sendMessage(val);
    }
  });

  document.getElementById('sendBtn')?.addEventListener('click', () => {
    const val = document.getElementById('msgInput')?.value?.trim();
    if (val) sendMessage(val);
  });

  document.getElementById('imageInput')?.addEventListener('change', e => {
    handleImageUpload(e.target.files[0]);
  });

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => sendMessage(chip.dataset.query));
  });

  document.getElementById('ministore')?.addEventListener('click', e => {
    if (e.target === document.getElementById('ministore'))
      document.getElementById('ministore').style.display = 'none';
  });

  document.getElementById('ms-close')?.addEventListener('click', () => {
    document.getElementById('ministore').style.display = 'none';
  });
});

// ────────────────────────────────────
// دوال مطلوبة من index.html
// ────────────────────────────────────
function handleSend(text) {
  const val = text || document.getElementById('msgInput')?.value?.trim();
  if (val) sendMessage(val);
}

function showPage(page) {
  ['privacy','terms','about','contact','blog'].forEach(p => {
    const el = document.getElementById(p+'-page');
    if (el) el.style.display = 'none';
  });
  const homeContent = document.getElementById('home-content');
  if (page === 'home') {
    if (homeContent) homeContent.style.display = '';
  } else {
    if (homeContent) homeContent.style.display = 'none';
    const el = document.getElementById(page+'-page');
    if (el) el.style.display = 'block';
  }
}

function setMode(mode) {
  document.getElementById('shopCard')?.classList.toggle('active-shop', mode === 'shop');
  document.getElementById('travelCard')?.classList.toggle('active-travel', mode === 'travel');
}

// I18n stub — لمنع أخطاء الـ console
const I18n = { set(lang) { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; } };
