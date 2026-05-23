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
    // ── المرحلة ١: تحليل بـ Claude + Vision ──
    let analyzed = null;
    try {
      const analyzeRes = await fetch(`${API}/api/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, imageBase64, wantCheaper }),
      });
      analyzed = await analyzeRes.json();
    } catch (e) {
      console.error('Analyze failed:', e);
    }

    // ── بناء كلمات البحث بشكل موثوق ──
    let searchQueries = [];

    // أولاً من Claude
    if (analyzed?.searchQueries?.length > 0) {
      searchQueries = analyzed.searchQueries.filter(q => q && q.trim().length > 1);
    }

    // ثانياً من Vision data لو Claude فشل
    if (searchQueries.length === 0 && analyzed?.visionData) {
      const v = analyzed.visionData;
      const brand = v.logos?.[0] || '';
      const guess = v.bestGuess || '';
      const obj   = v.objects?.[0] || '';
      const q = [brand, guess, obj].filter(Boolean).join(' ').trim();
      if (q) searchQueries = [q, brand || guess, guess || obj].filter(Boolean);
    }

    // ثالثاً من النص المدخل
    if (searchQueries.length === 0 && text && text.trim().length > 1) {
      searchQueries = [text.trim()];
    }

    // رابعاً emergency fallback
    if (searchQueries.length === 0) {
      searchQueries = ['trending products'];
    }

    console.log('Final search queries:', searchQueries);
    updateTyping('جاري البحث في المتاجر...');

    // ── المرحلة ٢: بحث في المتاجر ──
    const searchRes = await fetch(`${API}/api/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        queries:     searchQueries,
        market:      userLocation.market || 'SA',
        wantCheaper,
      }),
    });
    const { products, mock } = await searchRes.json();

    // ── المرحلة ٣: تصفية بـ Claude ──
    let finalProducts = products;
    if (products?.length > 3 && analyzed?.productType) {
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
    const confidence = analyzed?.confidence || 85;
    const reply = analyzed?.reply || `وجدت ${finalProducts?.length || 0} منتجات`;
    const detailLine = analyzed?.productType
      ? `\n🔍 ${analyzed.productType}${analyzed.brand ? ' • ' + analyzed.brand : ''}${analyzed.color ? ' • ' + analyzed.color : ''}`
      : '';
    const mockNote = mock ? '\n\n_نتائج تجريبية — سيتم ربط المتاجر قريباً_' : '';
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
    sendMessage('', base64);
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

function addProducts(products, cheaper = false) {
  const chat = document.getElementById('chatArea');
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
          <button class="btn-details" onclick='openProduct(${JSON.stringify(p).replace(/"/g, "&quot;")})'>
            التفاصيل
          </button>
          <a class="btn-buy" href="${p.url}" target="_blank" rel="noopener">
            اشتري ←
          </a>
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
