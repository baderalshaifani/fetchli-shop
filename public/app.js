// ===================================
// fetchli.shop — منطق الفرونت
// ===================================

const API = '';
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
// إرسال رسالة
// ────────────────────────────────────
async function sendMessage(text, imageBase64 = null) {
  if (!text && !imageBase64) return;

  const wantCheaper = text && /أرخص|رخيص|بديل|أوفر|اقتصادي|cheaper|budget|alternative/i.test(text);

  addMessage('user', imageBase64 ? `📸 ${text || 'صورة منتج'}` : text);
  clearInput();
  showTyping('جاري تحليل طلبك...');

  try {
    // ── المرحلة ١: تحليل Claude ──
    const analyzeRes = await fetch(`${API}/api/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, imageBase64, wantCheaper }),
    });
    const analyzed = await analyzeRes.json();
    const searchType = analyzed.searchType || 'product';

    // رسالة البحث حسب النوع
    const searchingMsg = {
      product: 'جاري البحث في المتاجر...',
      hotel:   'جاري البحث عن الفنادق...',
      flight:  'جاري البحث عن الرحلات...',
      other:   'جاري البحث...',
    }[searchType] || 'جاري البحث...';

    updateTyping(searchingMsg);

    // ── المرحلة ٢: البحث ──
    const searchRes = await fetch(`${API}/api/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        queries:    analyzed.searchQueries || [text],
        market:     userLocation.market || 'SA',
        wantCheaper,
        searchType,
        flightData: analyzed.flightData || null,
        hotelData:  analyzed.hotelData  || null,
      }),
    });
    const searchData = await searchRes.json();
    const { products, message: serverMsg } = searchData;

    // ── المرحلة ٣: تصفية (للمنتجات فقط) ──
    let finalProducts = products || [];
    if (searchType === 'product' && finalProducts.length > 0 && analyzed.productType) {
      updateTyping('جاري اختيار الأفضل لك...');
      try {
        const filterRes = await fetch(`${API}/api/filter`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ products: finalProducts, originalAnalysis: analyzed, wantCheaper }),
        });
        const filtered = await filterRes.json();
        if (filtered.products?.length >= 1) finalProducts = filtered.products;
      } catch (e) {}
    }

    removeTyping();

    // ── عرض الرد ──
    const reply = analyzed.reply || '';
    const detailLine = analyzed.productType
      ? `\n🔍 ${analyzed.productType}${analyzed.brand ? ` • ${analyzed.brand}` : ''}${analyzed.color ? ` • ${analyzed.color}` : ''}`
      : '';
    const confidenceLine = analyzed.confidence ? `\n✦ دقة التحليل: ${analyzed.confidence}٪` : '';

    // رسائل خاصة للرحلات والفنادق لو ما في API بعد
    if ((searchType === 'flight' || searchType === 'hotel') && finalProducts.length === 0) {
      const icon = searchType === 'flight' ? '✈️' : '🏨';
      const typeAr = searchType === 'flight' ? 'الرحلات' : 'الفنادق';
      addMessage('ai', `${reply || `فهمت طلبك!`}${detailLine}\n\n${icon} خاصية البحث عن ${typeAr} قادمة قريباً — سنضيفها في التحديث القادم!`);
      return;
    }

    addMessage('ai', reply + detailLine + confidenceLine);

    if (finalProducts.length > 0) {
      addProducts(finalProducts, wantCheaper);
    } else {
      addMessage('ai', '⚠️ لم أجد نتائج مطابقة، جرب وصفاً أكثر تفصيلاً أو صورة للمنتج.');
    }

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

// تخزين المنتجات بأمان
window._fetchliProducts = [];

function addProducts(products, cheaper = false) {
  const chat = document.getElementById('chatArea');

  if (cheaper) {
    const label = document.createElement('div');
    label.className = 'cheaper-label';
    label.textContent = '💰 مرتبة من الأرخص للأغلى';
    chat.appendChild(label);
  }

  // فصل Amazon و AliExpress
  const amazonItems = products.filter(p => p.source === 'amazon');
  const aliItems    = products.filter(p => p.source === 'aliexpress');
  const otherItems  = products.filter(p => p.source !== 'amazon' && p.source !== 'aliexpress');
  const allOrdered  = [...amazonItems, ...aliItems, ...otherItems];

  const startIdx = window._fetchliProducts.length;
  window._fetchliProducts.push(...allOrdered);

  const grid = document.createElement('div');
  grid.className = 'products-grid';
  grid.innerHTML = allOrdered.map((p, i) => {
    const idx = startIdx + i;
    const storeIcon = p.source === 'amazon' ? '🏪' : p.source === 'aliexpress' ? '🛒' : '🏬';
    return `
    <div class="product-card">
      <div class="product-img-wrap">
        <img src="${p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop'}"
             alt="${p.name}" class="product-img" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop'">
        ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-store">
          ${storeIcon} ${p.store}
          ${p.rating ? `<span class="rating">⭐ ${p.rating}</span>` : ''}
        </div>
        <div class="product-price">${p.price}</div>
        <div class="product-actions">
          <button class="btn-details" onclick="openProduct(${idx})">التفاصيل</button>
          <a class="btn-buy" href="${p.url}" target="_blank" rel="noopener">اشتري ←</a>
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
  document.getElementById('ms-name').textContent  = p.name;
  document.getElementById('ms-store').textContent = p.store;
  document.getElementById('ms-price').textContent = p.price;
  document.getElementById('ms-img').src           = p.image || '';
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
