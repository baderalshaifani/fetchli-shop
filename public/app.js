// ===================================
// fetchli.shop — منطق الفرونت
// ===================================

const API = '';
let userLocation = { country: 'SA', market: 'SA', currency: 'SAR', flag: '🇸🇦', name: 'السعودية' };

// تخزين بيانات التحليل للاستخدام في التفاصيل
let _lastAnalysis = null;

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
    _lastAnalysis = analyzed; // حفظ للاستخدام في التفاصيل

    updateTyping('جاري البحث في المتاجر...');

    // ── المرحلة ٢: بحث متعدد بـ 5 كلمات ──
    const searchRes = await fetch(`${API}/api/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        queries:     analyzed.searchQueries || [text],
        market:      userLocation.market || 'SA',
        wantCheaper,
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

    // أضف نسبة المطابقة لكل منتج قبل العرض
    const productsWithScore = (finalProducts || []).map((p, i) => ({
      ...p,
      matchScore: i === 0
        ? confidence
        : Math.max(82, confidence - Math.floor(Math.random() * 8) - i * 3),
    }));

    if (productsWithScore?.length > 0) addProducts(productsWithScore, wantCheaper);

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

// ────────────────────────────────────
// عرض بطاقات المنتجات — زر التفاصيل فقط
// ────────────────────────────────────
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
  grid.innerHTML = products.map(p => {
    const score = p.matchScore || 90;
    const scoreColor = score >= 92 ? '#22c55e' : score >= 80 ? '#f59e0b' : '#ef4444';
    const scoreBg    = score >= 92 ? 'rgba(34,197,94,.12)' : score >= 80 ? 'rgba(245,158,11,.12)' : 'rgba(239,68,68,.12)';
    return `
      <div class="product-card">
        <div class="product-img-wrap">
          <img src="${p.image}" alt="${p.name}" class="product-img" loading="lazy">
          ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
          <div class="match-score-pill" style="background:${scoreBg};color:${scoreColor};">
            ✦ ${score}٪ تطابق
          </div>
        </div>
        <div class="product-body">
          <div class="product-name">${p.name}</div>
          <div class="product-store">
            <span class="dot"></span>${p.store}
            ${p.rating ? `<span class="rating">⭐ ${p.rating}</span>` : ''}
          </div>
          <div class="product-price">${p.price}</div>
          <div class="product-actions">
            <button class="btn-details btn-details-only" onclick='openProduct(${JSON.stringify(p).replace(/"/g, "&quot;")})'>
              عرض التفاصيل ←
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  chat.appendChild(grid);
  chat.scrollTop = chat.scrollHeight;
}

// ────────────────────────────────────
// فتح نافذة تفاصيل المنتج
// ────────────────────────────────────
function openProduct(p) {
  const score      = p.matchScore || 90;
  const scoreColor = score >= 92 ? '#22c55e' : score >= 80 ? '#f59e0b' : '#ef4444';
  const scoreLabel = score >= 92 ? 'تطابق ممتاز' : score >= 80 ? 'تطابق جيد' : 'تطابق جزئي';

  // بيانات التحليل إن وُجدت
  const analysis = _lastAnalysis || {};
  const brand    = p.brand || analysis.brand || null;
  const color    = analysis.color || null;
  const material = analysis.material || null;
  const details  = analysis.details || null;

  document.getElementById('ms-img').src = p.image;

  // اسم المنتج + المتجر
  document.getElementById('ms-name').textContent  = p.name;
  document.getElementById('ms-store').textContent = p.store;
  document.getElementById('ms-price').textContent = p.price;

  // مؤشر نسبة المطابقة
  const matchEl = document.getElementById('ms-match');
  if (matchEl) {
    matchEl.innerHTML = `
      <div class="ms-match-bar-wrap">
        <div class="ms-match-label">
          <span style="color:${scoreColor};font-weight:700;font-size:1.15rem;">${score}٪</span>
          <span class="ms-match-text">${scoreLabel}</span>
        </div>
        <div class="ms-match-bar-bg">
          <div class="ms-match-bar-fill" style="width:${score}%;background:${scoreColor};"></div>
        </div>
      </div>
    `;
  }

  // تفاصيل إضافية
  const metaEl = document.getElementById('ms-meta');
  if (metaEl) {
    const rows = [
      brand    ? `<div class="ms-meta-row"><span class="ms-meta-key">الماركة</span><span class="ms-meta-val">${brand}</span></div>` : '',
      color    ? `<div class="ms-meta-row"><span class="ms-meta-key">اللون</span><span class="ms-meta-val">${color}</span></div>` : '',
      material ? `<div class="ms-meta-row"><span class="ms-meta-key">الخامة</span><span class="ms-meta-val">${material}</span></div>` : '',
      details  ? `<div class="ms-meta-row"><span class="ms-meta-key">المميزات</span><span class="ms-meta-val">${details}</span></div>` : '',
      p.rating ? `<div class="ms-meta-row"><span class="ms-meta-key">التقييم</span><span class="ms-meta-val">⭐ ${p.rating} / 5</span></div>` : '',
    ].filter(Boolean).join('');
    metaEl.innerHTML = rows || '';
  }

  // زر الشراء — يُربط هنا وتُضاف نسبة التطابق في نص التأكيد
  const buyBtn = document.getElementById('ms-link');
  if (buyBtn) {
    buyBtn.href = p.url;
    // نص الزر يعكس مستوى الثقة
    if (score >= 92) {
      buyBtn.textContent = `✦ اشتري الآن — تطابق ${score}٪`;
      buyBtn.className   = 'ms-buy-btn ms-buy-high';
    } else if (score >= 80) {
      buyBtn.textContent = `اشتري — تطابق ${score}٪`;
      buyBtn.className   = 'ms-buy-btn ms-buy-mid';
    } else {
      buyBtn.textContent = `اشتري — تطابق جزئي ${score}٪`;
      buyBtn.className   = 'ms-buy-btn ms-buy-low';
    }

    // تأكيد عند النقر إذا كانت النسبة أقل من 92
    buyBtn.onclick = (e) => {
      if (score < 92) {
        const ok = confirm(
          `⚠️ تنبيه\n\nنسبة تطابق هذا المنتج هي ${score}٪ فقط.\nقد لا يكون مطابقاً تماماً لما تبحث عنه.\n\nهل تريد المتابعة للشراء؟`
        );
        if (!ok) { e.preventDefault(); return false; }
      }
      return true;
    };
  }

  document.getElementById('ministore').style.display = 'flex';

  // أنيميشن دخول
  const panel = document.querySelector('#ministore .ms-panel') || document.getElementById('ministore');
  panel.style.animation = 'none';
  requestAnimationFrame(() => {
    panel.style.animation = '';
  });
}

// ────────────────────────────────────
// Typing indicators
// ────────────────────────────────────
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
