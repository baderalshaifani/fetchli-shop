// ===================================
// fetchli — app.js (المتحكم الرئيسي)
// ===================================

// ── الحالة العامة ──
let currentMode     = 'shop';   // shop | travel
let userLocation    = { country: 'SA', market: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'السعودية' };
let t               = {};       // ترجمات اللغة الحالية
window._fetchliProducts = [];   // مخزن المنتجات الآمن

// ══════════════════════════════════
// 1. تهيئة اللغة
// ══════════════════════════════════
async function initLanguage() {
  const lang = detectLanguage();
  try {
    const res = await fetch(`/i18n/${lang}.json`);
    t = await res.json();
  } catch {
    const res = await fetch('/i18n/en.json');
    t = await res.json();
  }
  applyLanguage();
}

function detectLanguage() {
  const nav = navigator.language || navigator.userLanguage || 'en';
  const code = nav.split('-')[0].toLowerCase();
  const map  = { ar: 'ar', ur: 'ur', de: 'de' };
  return map[code] || 'en';
}

function applyLanguage() {
  // اتجاه الصفحة
  document.documentElement.dir  = t.dir  || 'ltr';
  document.documentElement.lang = t.lang || 'en';

  // النصوص
  setText('modeSubtitle', currentMode === 'shop' ? t.shopSubtitle : t.travelSubtitle);
  setText('tabShop',   t.tabShop);
  setText('tabTravel', t.tabTravel);

  const input = document.getElementById('msgInput');
  if (input) input.placeholder = currentMode === 'shop' ? t.placeholderShop : t.placeholderTravel;

  // الـ chips
  renderChips();

  // رسالة الترحيب
  const welcome = document.getElementById('welcomeMsg');
  if (welcome) welcome.textContent = currentMode === 'shop' ? t.welcomeShop : t.welcomeTravel;

  // زر الشراء في الـ modal
  const msLink = document.getElementById('ms-link');
  if (msLink) msLink.textContent = t.buyNow;

  // الميزات
  setText('feat-delivery', t.features?.delivery);
  setText('feat-returns',  t.features?.returns);
  setText('feat-secure',   t.features?.secure);
  setText('feat-original', t.features?.original);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el && val) el.textContent = val;
}

// ══════════════════════════════════
// 2. تحديد الموقع
// ══════════════════════════════════
async function detectLocation() {
  try {
    const res  = await fetch('/api/location');
    const data = await res.json();
    userLocation = data;
    setText('locationFlag', data.flag);
    setText('locationName', data.name);
  } catch {}
}

// ══════════════════════════════════
// 3. تبديل الوضع
// ══════════════════════════════════
function switchMode(mode) {
  currentMode = mode;

  document.body.classList.toggle('travel-mode', mode === 'travel');
  document.getElementById('chipsShop')?.style.setProperty('display', mode === 'shop' ? 'flex' : 'none');
  document.getElementById('chipsTravel')?.style.setProperty('display', mode === 'travel' ? 'flex' : 'none');
  document.getElementById('tabShop')  ?.classList.toggle('active', mode === 'shop');
  document.getElementById('tabTravel')?.classList.toggle('active', mode === 'travel');

  applyLanguage();

  // مسح المحادثة
  const chat = document.getElementById('chatArea');
  if (chat) {
    chat.innerHTML = `
      <div class="msg-row ai">
        <div class="msg-avatar ai">✦</div>
        <div class="msg-bubble ai">${mode === 'shop' ? t.welcomeShop : t.welcomeTravel}</div>
      </div>`;
  }

  window._fetchliProducts = [];
}

// ══════════════════════════════════
// 4. رسم الـ Chips
// ══════════════════════════════════
function renderChips() {
  const shopEl   = document.getElementById('chipsShop');
  const travelEl = document.getElementById('chipsTravel');

  if (shopEl && t.chipsShop) {
    shopEl.innerHTML = t.chipsShop.map(c =>
      `<button class="chip" data-query="${c.query}">${c.label}</button>`
    ).join('');
    shopEl.querySelectorAll('.chip').forEach(chip =>
      chip.addEventListener('click', () => sendMessage(chip.dataset.query))
    );
  }

  if (travelEl && t.chipsTravel) {
    travelEl.innerHTML = t.chipsTravel.map(c =>
      `<button class="chip" data-query="${c.query}">${c.label}</button>`
    ).join('');
    travelEl.querySelectorAll('.chip').forEach(chip =>
      chip.addEventListener('click', () => sendMessage(chip.dataset.query))
    );
  }
}

// ══════════════════════════════════
// 5. الإرسال الرئيسي
// ══════════════════════════════════
async function sendMessage(text, imageBase64 = null) {
  if (!text && !imageBase64) return;

  addMessage('user', imageBase64 ? `📸 ${text || t.imageProduct}` : text);
  clearInput();

  if (currentMode === 'shop') {
    await handleShop(text, imageBase64);
  } else {
    await handleTravel(text, imageBase64);
  }
}

// ══════════════════════════════════
// 6. منطق التسوق
// ══════════════════════════════════
async function handleShop(text, imageBase64) {
  const wantCheaper = ShopModule.detectCheaper(text);
  showTyping(t.analyzing);

  try {
    // تحليل
    const analyzed = await ShopModule.analyze(text, imageBase64, wantCheaper);
    updateTyping(t.searchingShops);

    // بحث
    const searchData = await ShopModule.search(analyzed, userLocation.market, wantCheaper);
    let products = searchData.products || [];

    // تصفية
    if (products.length > 0) {
      updateTyping(t.filtering);
      products = await ShopModule.filter(products, analyzed, wantCheaper);
    }

    removeTyping();

    // عرض
    const reply = analyzed.reply || '';
    const detailLine = analyzed.productType
      ? `\n🔍 ${analyzed.productType}${analyzed.brand ? ` • ${analyzed.brand}` : ''}${analyzed.color ? ` • ${analyzed.color}` : ''}`
      : '';
    const confidenceLine = analyzed.confidence ? `\n✦ ${analyzed.confidence}٪` : '';

    addMessage('ai', reply + detailLine + confidenceLine);

    if (products.length > 0) {
      // تحويل العملة
      products = products.map(p => ({
        ...p,
        price: ShopModule.formatPrice(p.price, userLocation.currency),
      }));
      addProducts(products, wantCheaper);
    } else {
      addMessage('ai', t.noResults);
    }

  } catch (err) {
    removeTyping();
    addMessage('ai', t.errorMsg);
    console.error('Shop error:', err);
  }
}

// ══════════════════════════════════
// 7. منطق السفر
// ══════════════════════════════════
async function handleTravel(text, imageBase64) {
  showTyping(t.analyzing);

  try {
    const analyzed = await TravelModule.analyze(text, imageBase64);
    const searchType = analyzed.searchType || 'hotel';

    updateTyping(searchType === 'flight' ? t.searchingFlights : t.searchingHotels);

    const searchData = await TravelModule.search(analyzed, userLocation.market);
    const products   = searchData.products || [];

    removeTyping();

    const reply = analyzed.reply || '';
    addMessage('ai', reply);

    if (products.length > 0) {
      addProducts(products, false);
    } else {
      // Deep Link fallback
      const msg    = searchType === 'flight' ? t.comingSoonFlights : t.comingSoonHotels;
      const link   = searchType === 'flight'
        ? TravelModule.buildTripLink('flight', analyzed.flightData || {})
        : TravelModule.buildTripLink('hotel', { ...analyzed.hotelData, currency: userLocation.currency });

      addMessage('ai', msg);
      addTravelLink(link, searchType);
    }

  } catch (err) {
    removeTyping();
    addMessage('ai', t.errorMsg);
    console.error('Travel error:', err);
  }
}

// ══════════════════════════════════
// 8. رفع صورة
// ══════════════════════════════════
function handleImageUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result.split(',')[1];
    addImagePreview(e.target.result);
    sendMessage(currentMode === 'shop' ? 'أبي منتجات مشابهة' : 'حلل هذه التذكرة', base64);
  };
  reader.readAsDataURL(file);
}

// ══════════════════════════════════
// 9. DOM Helpers
// ══════════════════════════════════
function addMessage(role, text) {
  const chat = document.getElementById('chatArea');
  const row  = document.createElement('div');
  row.className = `msg-row ${role}`;
  row.innerHTML = `
    <div class="msg-avatar ${role}">${role === 'ai' ? '✦' : '👤'}</div>
    <div class="msg-bubble ${role}">${escapeHtml(text)}</div>
  `;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function addImagePreview(src) {
  const chat = document.getElementById('chatArea');
  const row  = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="msg-avatar user">👤</div>
    <img src="${src}" class="img-preview" alt="product">
  `;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function addTravelLink(url, type) {
  const chat = document.getElementById('chatArea');
  const icon = type === 'flight' ? '✈️' : '🏨';
  const wrap = document.createElement('div');
  wrap.className = 'msg-row ai';
  wrap.innerHTML = `
    <div class="msg-avatar ai">✦</div>
    <div class="msg-bubble ai">
      <a href="${url}" target="_blank" rel="noopener" class="travel-deep-link">
        ${icon} ${type === 'flight' ? 'ابحث عن رحلات' : 'ابحث عن فنادق'} على Trip.com ←
      </a>
    </div>
  `;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function addProducts(products, cheaper = false) {
  const chat = document.getElementById('chatArea');

  if (cheaper) {
    const label = document.createElement('div');
    label.className = 'cheaper-label';
    label.textContent = t.cheapestFirst;
    chat.appendChild(label);
  }

  const startIdx = window._fetchliProducts.length;
  window._fetchliProducts.push(...products);

  const grid = document.createElement('div');
  grid.className = 'products-grid';
  grid.innerHTML = products.map((p, i) => {
    const idx       = startIdx + i;
    const storeIcon = p.source === 'amazon' ? '🏪' : p.source === 'aliexpress' ? '🛒' : '🏬';
    const imgSrc    = p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop';
    return `
    <div class="product-card">
      <div class="product-img-wrap">
        <img src="${imgSrc}" alt="${escapeHtml(p.name)}" class="product-img" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop'">
        ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
      </div>
      <div class="product-body">
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-store">
          ${storeIcon} ${escapeHtml(p.store)}
          ${p.rating ? `<span class="rating">⭐ ${p.rating}</span>` : ''}
        </div>
        <div class="product-price">${escapeHtml(p.price)}</div>
        <div class="product-actions">
          <button class="btn-details" onclick="openProduct(${idx})">${t.details}</button>
          <a class="btn-buy" href="${p.url}" target="_blank" rel="noopener">${t.buyNow}</a>
        </div>
      </div>
    </div>`;
  }).join('');

  chat.appendChild(grid);
  chat.scrollTop = chat.scrollHeight;
}

function openProduct(idx) {
  const p = window._fetchliProducts[idx];
  if (!p) return;
  setText('ms-store',     p.store);
  setText('ms-store-val', p.store);
  setText('ms-name',      p.name);
  setText('ms-price',     p.price);
  setText('ms-rating',    p.rating || '');
  document.getElementById('ms-img').src  = p.image || '';
  document.getElementById('ms-link').href = p.url;
  document.getElementById('ms-link').textContent = t.buyNow;
  document.getElementById('ministore').classList.add('open');
}

function showTyping(msg = '...') {
  const chat = document.getElementById('chatArea');
  const el   = document.createElement('div');
  el.id        = 'typing';
  el.className = 'msg-row ai';
  el.innerHTML = `
    <div class="msg-avatar ai">✦</div>
    <div class="typing-wrap-inner">
      <div class="typing-bubble"><span></span><span></span><span></span></div>
      <div class="typing-label" id="typingLabel">${msg}</div>
    </div>`;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

function updateTyping(msg) {
  const el = document.getElementById('typingLabel');
  if (el) el.textContent = msg;
}

function removeTyping() { document.getElementById('typing')?.remove(); }
function clearInput()   { document.getElementById('msgInput').value = ''; }

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ══════════════════════════════════
// 10. Bootstrap
// ══════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {

  // تهيئة اللغة والموقع بالتوازي
  await Promise.all([initLanguage(), detectLocation()]);

  // Input
  document.getElementById('msgInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const val = document.getElementById('msgInput').value.trim();
      if (val) sendMessage(val);
    }
  });

  document.getElementById('sendBtn')?.addEventListener('click', () => {
    const val = document.getElementById('msgInput').value.trim();
    if (val) sendMessage(val);
  });

  document.getElementById('imageInput')?.addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0]);
  });

  // Modal
  document.getElementById('ministore')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('ministore'))
      document.getElementById('ministore').classList.remove('open');
  });

  document.getElementById('ms-close')?.addEventListener('click', () => {
    document.getElementById('ministore').classList.remove('open');
  });
});
