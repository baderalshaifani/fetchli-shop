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
// فتح الرابط داخل التطبيق
// Custom Tabs (Android) / SFSafariViewController (iOS)
// ────────────────────────────────────
function openInApp(url) {
  // ── ١. كشف البيئة ──
  const ua        = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS     = /iPhone|iPad|iPod/i.test(ua);
  const isMobile  = isAndroid || isIOS;

  // ── ٢. إذا الموقع مفتوح داخل تطبيق fetchli ──
  //    التطبيق يحقن fetchli_app=true في الـ UA أو window
  const insideApp = window.fetchli_app === true
    || /FetchliApp/i.test(ua);

  if (insideApp) {
    // أرسل الرابط للتطبيق عبر postMessage ليفتحه في Custom Tab / SFSafari
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'OPEN_URL', url }));
    // أو Flutter
    window.flutter_inappwebview?.callHandler?.('openUrl', url);
    return;
  }

  // ── ٣. على موبايل خارج التطبيق ──
  //    نفتح في نفس النافذة (يتحول تلقائياً لـ Custom Tab في Chrome Android
  //    أو SFSafariViewController في Safari iOS عند استدعاء window.open بدون _blank)
  if (isMobile) {
    window.location.href = url;
    return;
  }

  // ── ٤. ديسكتوب ← نافذة منبثقة أنيقة ──
  const w = Math.min(window.innerWidth * 0.85, 1100);
  const h = Math.min(window.innerHeight * 0.9, 800);
  const left = (window.innerWidth  - w) / 2 + window.screenX;
  const top  = (window.innerHeight - h) / 2 + window.screenY;
  window.open(
    url,
    'fetchli_store',
    `width=${Math.round(w)},height=${Math.round(h)},left=${Math.round(left)},top=${Math.round(top)},toolbar=0,location=1,scrollbars=1,resizable=1`
  );
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

  // ── التغيير الرئيسي: btn-buy يستخدم openInApp بدل target="_blank" ──
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
          <button class="btn-details" onclick='openProduct(${JSON.stringify(p).replace(/"/g, "&quot;")})'>
            التفاصيل
          </button>
          <button class="btn-buy" onclick="openInApp('${p.url.replace(/'/g, "\\'")}')">
            اشتري ←
          </button>
        </div>
      </div>
    </div>
  `).join('');

  chat.appendChild(grid);
  chat.scrollTop = chat.scrollHeight;
}

// ────────────────────────────────────
// Image Slider للمنتج
// ────────────────────────────────────
let msCurrentImg = 0;
let msImages     = [];

function msGoTo(index) {
  const track = document.getElementById('msImgsTrack');
  const dots  = document.querySelectorAll('.ms-img-dot');
  if (!track) return;
  msCurrentImg = Math.max(0, Math.min(index, msImages.length - 1));
  track.style.transform = `translateX(${msCurrentImg * 100}%)`;
  dots.forEach((d, i) => d.classList.toggle('active', i === msCurrentImg));
}

function msInitSlider(images) {
  msImages     = images;
  msCurrentImg = 0;
  const track  = document.getElementById('msImgsTrack');
  const dots   = document.getElementById('msImgDots');
  const prev   = document.getElementById('msImgPrev');
  const next   = document.getElementById('msImgNext');

  // بناء الـ slides
  track.innerHTML = images.map(src => `
    <div class="ms-img-slide">
      <img src="${src}" alt="" loading="lazy">
    </div>
  `).join('');
  track.style.transform = 'translateX(0)';

  // dots
  dots.innerHTML = images.length > 1
    ? images.map((_, i) => `<div class="ms-img-dot ${i === 0 ? 'active' : ''}" onclick="msGoTo(${i})"></div>`).join('')
    : '';

  // أزرار
  prev.style.display = images.length > 1 ? 'flex' : 'none';
  next.style.display = images.length > 1 ? 'flex' : 'none';
  prev.onclick = () => msGoTo(msCurrentImg - 1);
  next.onclick = () => msGoTo(msCurrentImg + 1);

  // swipe
  let startX = 0;
  track.parentElement.ontouchstart = (e) => { startX = e.touches[0].clientX; };
  track.parentElement.ontouchend   = (e) => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) msGoTo(diff > 0 ? msCurrentImg + 1 : msCurrentImg - 1);
  };
}

function openProduct(p) {
  // الصور — نبني قائمة من الصور المتاحة
  const imgs = [];
  if (p.image)  imgs.push(p.image);
  if (p.images?.length) p.images.forEach(i => { if (i && !imgs.includes(i)) imgs.push(i); });
  if (!imgs.length) imgs.push('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop');

  msInitSlider(imgs);
  document.getElementById('ms-img').src = imgs[0]; // fallback للـ img الأصلي

  // الاسم والمتجر
  document.getElementById('ms-name').textContent      = p.name;
  document.getElementById('ms-store').textContent     = p.store;
  document.getElementById('ms-store-val').textContent = p.store;
  document.getElementById('ms-price').textContent     = p.price;

  // البادج
  const badge = document.getElementById('ms-badge');
  badge.textContent   = p.badge || '';
  badge.style.display = p.badge ? 'block' : 'none';

  // التقييم
  const rating = document.getElementById('ms-rating');
  const stars  = Math.round(parseFloat(p.rating) || 5);
  document.querySelector('.ms-stars').textContent = '⭐'.repeat(Math.min(stars, 5));
  rating.textContent = p.rating ? `${p.rating} / 5${p.reviews ? ` • ${p.reviews}` : ''}` : '';

  // الخصم
  const discount = document.getElementById('ms-discount');
  const priceNum  = parseFloat(p.price.replace(/[^\d.]/g, ''));
  if (priceNum > 0 && !p.oldPrice) {
    const currency = p.price.replace(/[\d.,]/g, '').trim();
    discount.textContent   = `وفّر ${Math.round(priceNum * 0.2)} ${currency}`;
    discount.style.display = 'inline';
  } else if (p.oldPrice) {
    discount.textContent   = `السعر القديم: ${p.oldPrice}`;
    discount.style.display = 'inline';
  } else {
    discount.style.display = 'none';
  }

  // زر الشراء
  const link = document.getElementById('ms-link');
  const buyUrl = p.buyNowUrl || p.url;
  link.onclick   = (e) => { e.preventDefault(); openInApp(buyUrl); };
  link.href      = buyUrl;
  link.innerHTML = `اشتري الآن على ${p.store} <span class="arrow">←</span>`;

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
