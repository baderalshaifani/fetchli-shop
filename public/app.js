// ===================================
// fetchli.shop — منطق الفرونت
// ===================================

const API = '';

// ── CSS للـ store sections — يُحقن مرة واحدة ──
(function injectStoreCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .stores-wrapper { display: flex; flex-direction: column; gap: 20px; width: 100%; }

    .store-section { width: 100%; }

    .store-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      margin-bottom: 10px;
      background: rgba(255,255,255,0.04);
      border-radius: 10px;
      border-right: 3px solid rgba(255,255,255,0.15);
    }
    .store-header-icon { font-size: 18px; }
    .store-header-name {
      font-weight: 700;
      font-size: 14px;
      flex: 1;
      color: #fff;
    }
    .store-header-count {
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      background: rgba(255,255,255,0.08);
      padding: 2px 8px;
      border-radius: 20px;
    }
  `;
  document.head.appendChild(style);
})();
let userLocation = { country: 'SA', market: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'السعودية' };

// ────────────────────────────────────
// تحديد الدولة
// ────────────────────────────────────
async function detectLocation() {
  try {
    const res  = await fetch(`${API}/api/location`);
    const data = await res.json();
    userLocation = data;
    document.getElementById('locationFlag').textContent = data.flag;
    document.getElementById('locationName').textContent = data.name;
  } catch (e) {}
}

// ────────────────────────────────────
// إرسال رسالة نصية
// ────────────────────────────────────
async function sendMessage(text, imageBase64 = null) {
  if (!text && !imageBase64) return;

  // هل يريد أرخص؟
  const wantCheaper = text && /أرخص|رخيص|بديل|أوفر|اقتصادي|cheaper|budget|alternative/i.test(text);

  addMessage('user', imageBase64 ? `📸 ${text || 'صورة منتج'}` : text);
  clearInput();
  showTyping('جاري تحليل طلبك...');

  try {
    // ── المرحلة ١: تحليل عميق بـ Claude ──
    const analyzeRes = await fetch(`${API}/api/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, imageBase64, wantCheaper }),
    });
    const analyzed = await analyzeRes.json();

    updateTyping('جاري البحث في المتاجر...');

    // ── المرحلة ٢: بحث متعدد بـ 5 كلمات ──
    const searchRes = await fetch(`${API}/api/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        queries:     analyzed.searchQueries || [text],
        market:      userLocation.market || 'SA',
        wantCheaper,
        imageBase64, // ★ للـ Google Lens + Claude Visual Filter
        analysis:    analyzed, // ★ للـ title filter + visual filter
      }),
    });
    const { products, mock } = await searchRes.json();

    // ── المرحلة ٣: تصفية بـ Claude للدقة العالية ──
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

    // ── عرض النتائج ──
    const confidence = analyzed.confidence || 90;
    const reply = analyzed.reply || `وجدت لك ${finalProducts.length} منتجات مطابقة`;
    const detailLine = analyzed.productType
      ? `\n🔍 ${analyzed.productType}${analyzed.brand ? ` • ${analyzed.brand}` : ''}${analyzed.color ? ` • ${analyzed.color}` : ''}`
      : '';
    const mockNote = mock ? '\n\n_نتائج تجريبية — سيتم ربط Amazon قريباً_' : '';
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

  // عرض preview
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
  const row  = document.createElement('div');
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
  const row  = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="msg-avatar user">👤</div>
    <img src="${src}" class="img-preview" alt="صورة المنتج">
  `;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

// خريطة أيقونات المتاجر
const STORE_ICONS = {
  amazon:     '📦',
  aliexpress: '🛒',
  rainforest: '📦',
  noon:       '🌞',
  jarir:      '📚',
  extra:      '🔌',
  namshi:     '👗',
  default:    '🏪',
};

function getStoreIcon(source) {
  if (!source) return STORE_ICONS.default;
  const s = source.toLowerCase();
  for (const [key, icon] of Object.entries(STORE_ICONS)) {
    if (s.includes(key)) return icon;
  }
  return STORE_ICONS.default;
}

function productCardHTML(p) {
  const safeP = JSON.stringify(p).replace(/"/g, '&quot;');
  return `
    <div class="product-card">
      <div class="product-img-wrap">
        <img src="${p.image}" alt="${p.name}" class="product-img" loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop'">
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
          <button class="btn-details" onclick='openProduct(${safeP})'>التفاصيل</button>
          <a class="btn-buy" href="${p.url}" target="_blank" rel="noopener">اشتري ←</a>
        </div>
      </div>
    </div>`;
}

function addProducts(products, cheaper = false) {
  const chat = document.getElementById('chatArea');

  if (cheaper) {
    const label = document.createElement('div');
    label.className = 'cheaper-label';
    label.textContent = '💰 مرتبة من الأرخص للأغلى';
    chat.appendChild(label);
  }

  // ── تجميع المنتجات حسب المتجر ──
  const grouped = {};
  products.forEach(p => {
    const key = p.source || p.store || 'other';
    if (!grouped[key]) grouped[key] = { label: p.store, source: p.source, items: [] };
    grouped[key].items.push(p);
  });

  const sections = Object.values(grouped);

  // لو متجر واحد فقط — اعرض بدون header
  if (sections.length === 1) {
    const grid = document.createElement('div');
    grid.className = 'products-grid';
    grid.innerHTML = sections[0].items.map(productCardHTML).join('');
    chat.appendChild(grid);
    chat.scrollTop = chat.scrollHeight;
    return;
  }

  // لو أكثر من متجر — اعرض كل متجر في section منفصلة
  const wrapper = document.createElement('div');
  wrapper.className = 'stores-wrapper';

  sections.forEach(section => {
    const icon = getStoreIcon(section.source);
    const storeSection = document.createElement('div');
    storeSection.className = 'store-section';
    storeSection.innerHTML = `
      <div class="store-header">
        <span class="store-header-icon">${icon}</span>
        <span class="store-header-name">${section.label}</span>
        <span class="store-header-count">${section.items.length} منتج</span>
      </div>
      <div class="products-grid">
        ${section.items.map(productCardHTML).join('')}
      </div>`;
    wrapper.appendChild(storeSection);
  });

  chat.appendChild(wrapper);
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
  const el   = document.createElement('div');
  el.id        = 'typing';
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
function clearInput()   { document.getElementById('msgInput').value = ''; }

// ────────────────────────────────────
// Event Listeners
// ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  detectLocation();

  document.getElementById('msgInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const val = document.getElementById('msgInput').value.trim();
      if (val) sendMessage(val);
    }
  });

  document.getElementById('sendBtn').addEventListener('click', () => {
    const val = document.getElementById('msgInput').value.trim();
    if (val) sendMessage(val);
  });

  document.getElementById('imageInput').addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0]);
  });

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => sendMessage(chip.dataset.query));
  });

  document.getElementById('ministore').addEventListener('click', (e) => {
    if (e.target === document.getElementById('ministore'))
      document.getElementById('ministore').style.display = 'none';
  });

  document.getElementById('ms-close').addEventListener('click', () => {
    document.getElementById('ministore').style.display = 'none';
  });
});
