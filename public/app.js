// ===================================
// fetchli.shop — منطق الفرونت
// ===================================

const API = ''; // فارغ = نفس السيرفر

let userLocation = { country: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'السعودية' };

// ────────────────────────────────────
// تحديد الدولة عند تحميل الصفحة
// ────────────────────────────────────
async function detectLocation() {
  try {
    const res  = await fetch(`${API}/api/location`);
    const data = await res.json();
    userLocation = data;
    document.getElementById('locationFlag').textContent  = data.flag;
    document.getElementById('locationName').textContent  = data.name;
  } catch (e) {
    console.log('Location fallback to SA');
  }
}

// ────────────────────────────────────
// إرسال رسالة
// ────────────────────────────────────
async function sendMessage(text, imageBase64 = null) {
  if (!text && !imageBase64) return;

  // أضف رسالة المستخدم
  addMessage('user', text || '📸 صورة منتج');
  clearInput();
  showTyping();

  try {
    // 1. تحليل الطلب عبر Claude
    const analyzeRes = await fetch(`${API}/api/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, imageBase64 }),
    });
    const analyzed = await analyzeRes.json();

    // 2. البحث عن المنتجات
    const searchRes = await fetch(`${API}/api/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        query:  analyzed.searchQueryEn || text,
        market: userLocation.market || 'SA',
      }),
    });
    const { products, mock } = await searchRes.json();

    removeTyping();

    // 3. عرض الرد
    const reply = analyzed.reply || `وجدت لك ${products.length} نتائج 👇`;
    addMessage('ai', reply + (mock ? '\n\n_نتائج تجريبية — سيتم ربط Amazon قريباً_' : ''));

    if (products?.length > 0) {
      addProducts(products);
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

function addProducts(products) {
  const chat = document.getElementById('chatArea');
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
          <button class="btn-details" onclick="openProduct(${JSON.stringify(p).replace(/"/g, '&quot;')})">
            التفاصيل
          </button>
          <a class="btn-buy" href="${p.url}" target="_blank" rel="noopener">
            اشتري على Amazon
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

function showTyping() {
  const chat = document.getElementById('chatArea');
  const el   = document.createElement('div');
  el.id        = 'typing';
  el.className = 'msg-row ai';
  el.innerHTML = `
    <div class="msg-avatar ai">✦</div>
    <div class="typing-bubble">
      <span></span><span></span><span></span>
    </div>
  `;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

function removeTyping() {
  document.getElementById('typing')?.remove();
}

function clearInput() {
  document.getElementById('msgInput').value = '';
}

// ────────────────────────────────────
// Event Listeners
// ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  detectLocation();

  // إرسال بالضغط على Enter
  document.getElementById('msgInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const val = document.getElementById('msgInput').value.trim();
      sendMessage(val);
    }
  });

  // زر الإرسال
  document.getElementById('sendBtn').addEventListener('click', () => {
    const val = document.getElementById('msgInput').value.trim();
    sendMessage(val);
  });

  // رفع صورة
  document.getElementById('imageInput').addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0]);
  });

  // اقتراحات سريعة
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      sendMessage(chip.dataset.query);
    });
  });

  // إغلاق المتجر المصغر
  document.getElementById('ministore').addEventListener('click', (e) => {
    if (e.target === document.getElementById('ministore')) {
      document.getElementById('ministore').style.display = 'none';
    }
  });
  document.getElementById('ms-close').addEventListener('click', () => {
    document.getElementById('ministore').style.display = 'none';
  });
});
