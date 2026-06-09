// ===================================
// fetchli.shop — app.js (travel mode)
// ===================================

const API = '';
let userLocation = { country:'SA', market:'SA', currency:'SAR', flag:'🇸🇦', name:'السعودية' };
let currentLang  = 'ar';
let currentMode  = 'travel';
let _contentData = null;

// ────────────────────────────────────
// i18n
// ────────────────────────────────────
const STRINGS = {
  ar: {
    'nav.home':'الرئيسية','nav.blog':'المدونة','nav.about':'من نحن','nav.contact':'تواصل معنا',
    'hero.badge':'✈️ سافر بذكاء وبأفضل سعر','hero.title1':'قارن. اختر.','hero.title2':'سافر أكثر',
    'hero.sub':'اكتب وجهتك ويساعدك المساعد الذكي في إيجاد أفضل رحلات وفنادق',
    'mode.shopLabel':'تسوق','mode.shopDesc':'منتجات، إلكترونيات، ملابس وأكثر',
    'mode.travelLabel':'سفر','mode.travelDesc':'فنادق، سيارات ورحلات حول العالم',
    'chat.placeholder':'اكتب وجهتك... مثال: أريد رحلة لإسطنبول',
    'stats.s1':'فندق ورحلة','stats.s2':'دولة','stats.s3':'متوسط التوفير','stats.s4':'مقارنة فورية',
    'trusted':'نقارن الأسعار من',
    'how.title':'كيف يعمل Fetchli سفر؟','how.sub':'ثلاث خطوات بسيطة',
    'footer.desc':'مساعدك الذكي للسفر والتنقل','footer.services':'الخدمات',
    'footer.company':'الشركة','footer.legal':'القانونية',
    'footer.copy':'© 2026 Fetchli','footer.tagline':'سافر بذكاء',
  },
  en: {
    'nav.home':'Home','nav.blog':'Blog','nav.about':'About','nav.contact':'Contact',
    'hero.badge':'✈️ Travel Smart','hero.title1':'Compare. Choose.','hero.title2':'Travel More',
    'hero.sub':'Tell us your destination and our AI finds the best flights and hotels',
    'mode.shopLabel':'Shop','mode.shopDesc':'Products, electronics, fashion and more',
    'mode.travelLabel':'Travel','mode.travelDesc':'Hotels, cars and trips worldwide',
    'chat.placeholder':'Where do you want to go?',
    'stats.s1':'Hotels & Flights','stats.s2':'Countries','stats.s3':'Average Savings','stats.s4':'Instant Compare',
    'trusted':'We compare prices from',
    'how.title':'How Fetchli Travel Works','how.sub':'Three simple steps',
    'footer.desc':'Your smart travel assistant','footer.services':'Services',
    'footer.company':'Company','footer.legal':'Legal',
    'footer.copy':'© 2026 Fetchli','footer.tagline':'Travel Smart',
  },
  de: {
    'nav.home':'Startseite','nav.blog':'Blog','nav.about':'Über uns','nav.contact':'Kontakt',
    'hero.badge':'✈️ Clever reisen','hero.title1':'Vergleichen. Wählen.','hero.title2':'Mehr reisen',
    'hero.sub':'Sag uns dein Ziel – unsere KI findet die besten Flüge und Hotels',
    'mode.shopLabel':'Einkaufen','mode.shopDesc':'Produkte, Elektronik, Mode und mehr',
    'mode.travelLabel':'Reisen','mode.travelDesc':'Hotels, Autos und Reisen weltweit',
    'chat.placeholder':'Wohin möchtest du reisen?',
    'stats.s1':'Hotels & Flüge','stats.s2':'Länder','stats.s3':'Ø Ersparnis','stats.s4':'Sofortvergleich',
    'trusted':'Wir vergleichen Preise von',
    'how.title':'Wie Fetchli Reisen funktioniert','how.sub':'Drei einfache Schritte',
    'footer.desc':'Dein smarter Reise-Assistent','footer.services':'Dienste',
    'footer.company':'Unternehmen','footer.legal':'Rechtliches',
    'footer.copy':'© 2026 Fetchli','footer.tagline':'Clever reisen',
  },
};

const I18n = {
  set(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (STRINGS[lang]?.[key]) el.textContent = STRINGS[lang][key];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.dataset.i18nPh;
      if (STRINGS[lang]?.[key]) el.placeholder = STRINGS[lang][key];
    });
    if (_contentData) {
      renderTip(_contentData.tips);
      renderArticles(_contentData.blog);
      renderDeals(_contentData.manual_deals);
    }
    renderChips(currentMode);
    renderFooter();
    renderSteps();
  },
};

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
// جلب المحتوى
// ────────────────────────────────────
async function loadContent() {
  try {
    const res  = await fetch(`${API}/api/admin/content`);
    if (!res.ok) throw new Error('no content');
    _contentData = await res.json();
  } catch (e) {
    _contentData = { tips:{ar:[],en:[],de:[]}, blog:{ar:{travel:[],shop:[]},en:{travel:[],shop:[]},de:{travel:[],shop:[]}}, manual_deals:{travel:[],shop:[]} };
  }
  renderTip(_contentData.tips);
  renderDeals(_contentData.manual_deals);
  renderArticles(_contentData.blog);
}

function renderTip(tips) {
  const el = document.getElementById('tip-text');
  if (!el) return;
  const list = tips?.[currentLang] || tips?.ar || [];
  if (!list.length) {
    const fb = { ar:'احجز مبكراً وفّر حتى ٤٠٪ على الرحلات والفنادق!', en:'Book early and save up to 40% on flights and hotels!', de:'Früh buchen und bis zu 40% sparen!' };
    el.textContent = fb[currentLang] || fb.ar;
    return;
  }
  el.textContent = list[new Date().getDate() % list.length];
}

function renderDeals(deals) {
  const grid = document.getElementById('deals-grid');
  if (!grid) return;
  const items = deals?.['travel'] || [];
  if (!items.length) { grid.innerHTML = _fallbackDeals(); return; }
  grid.innerHTML = items.map(d => `
    <div class="deal-card" style="background:${d.bg||'#1a3a5c'};cursor:${d.url?'pointer':'default'}"
      onclick="${d.url ? `window.open('${d.url}','_blank')` : ''}">
      ${d.image ? `<img src="${d.image}" style="width:100%;height:100px;object-fit:cover;border-radius:8px 8px 0 0;display:block" onerror="this.style.display='none'">` : ''}
      <div style="padding:12px">
        <div class="deal-icon">${d.icon||'✈️'}</div>
        <div class="deal-body">
          <div class="deal-title">${d.title}</div>
          ${d.desc ? `<div style="font-size:11px;opacity:.7;margin-top:3px">${d.desc}</div>` : ''}
          <div class="deal-price">${d.price} ${d.savings?`<span class="deal-save">وفّر ${d.savings}</span>`:''}</div>
        </div>
      </div>
    </div>`).join('');
}

function _fallbackDeals() {
  return `
    <div class="deal-card" style="background:#1a3a5c;cursor:default"><div style="padding:12px"><div class="deal-icon">✈️</div><div class="deal-body"><div class="deal-title">تذاكر دبي</div><div class="deal-price">من ٢٩٩ ر.س <span class="deal-save">وفّر ٤٠٪</span></div></div></div></div>
    <div class="deal-card" style="background:#1a2d4a;cursor:default"><div style="padding:12px"><div class="deal-icon">🏨</div><div class="deal-body"><div class="deal-title">فنادق إسطنبول</div><div class="deal-price">من ١٩٩ ر.س <span class="deal-save">وفّر ٣٠٪</span></div></div></div></div>
    <div class="deal-card" style="background:#162040;cursor:default"><div style="padding:12px"><div class="deal-icon">🚗</div><div class="deal-body"><div class="deal-title">تأجير سيارات</div><div class="deal-price">من ٨٩ ر.س/يوم</div></div></div></div>`;
}

function renderArticles(blog) {
  const list = document.getElementById('articles-list');
  if (!list) return;
  const langData = blog?.[currentLang] || blog?.ar || {};
  const items    = (langData['travel'] || []).slice(0,4);
  if (!items.length) { list.innerHTML = _fallbackArticles(); return; }
  list.innerHTML = items.map((a,i) => `
    <div class="article-card" onclick="openArticle(${i})" style="cursor:pointer">
      ${a.image ? `<img src="${a.image}" class="article-thumb" onerror="this.style.display='none'">` : `<div class="article-icon">${a.icon||'✈️'}</div>`}
      <div class="article-body">
        <div class="article-title">${a.title}</div>
        <div class="article-meta">${a.cat||''} ${a.read?'· '+a.read:''}</div>
        ${a.excerpt ? `<div class="article-excerpt">${a.excerpt}</div>` : ''}
      </div>
      <div class="article-arrow">←</div>
    </div>`).join('');
}

function _fallbackArticles() {
  const fb = {
    ar:[{icon:'✈️',title:'أفضل ١٠ وجهات سياحية في ٢٠٢٦',meta:'سفر · ٥ دقائق'},{icon:'🏨',title:'كيف تختار الفندق المثالي',meta:'فنادق · ٣ دقائق'},{icon:'💳',title:'نصائح توفير المال في السفر',meta:'نصائح · ٤ دقائق'}],
    en:[{icon:'✈️',title:'Top 10 Travel Destinations 2026',meta:'Travel · 5 min'},{icon:'🏨',title:'How to Pick the Perfect Hotel',meta:'Hotels · 3 min'}],
  };
  const data = (fb[currentLang]||fb.ar);
  return data.map(a=>`
    <div class="article-card" style="cursor:default">
      <div class="article-icon">${a.icon}</div>
      <div class="article-body"><div class="article-title">${a.title}</div><div class="article-meta">${a.meta||a.meta}</div></div>
      <div class="article-arrow">←</div>
    </div>`).join('');
}

function openArticle(index) {
  if (!_contentData) return;
  const langData = _contentData.blog?.[currentLang] || _contentData.blog?.ar || {};
  const article  = (langData['travel'] || [])[index];
  if (!article) return;
  if (article.url) { window.open(article.url, '_blank'); return; }
  showPage('blog');
  const page = document.getElementById('blog-page');
  page.innerHTML = `
    <button onclick="showPage('home')" style="background:none;border:1px solid #444;color:#aaa;padding:8px 16px;border-radius:8px;cursor:pointer;margin-bottom:24px;font-size:13px">← رجوع</button>
    ${article.image ? `<img src="${article.image}" style="width:100%;max-height:340px;object-fit:cover;border-radius:16px;margin-bottom:28px;display:block">` : ''}
    <div style="font-size:13px;color:#888;margin-bottom:8px">${article.cat||''} ${article.read?'· '+article.read:''}</div>
    <h1 style="font-size:clamp(22px,4vw,36px);font-weight:700;margin-bottom:16px;line-height:1.3">${article.title}</h1>
    <div style="font-size:15px;line-height:1.9;color:#ddd;white-space:pre-line">${article.content||''}</div>`;
}

function renderBlogPage() {
  const page = document.getElementById('blog-page');
  if (!page) return;
  const blog     = _contentData?.blog || {};
  const langData = blog[currentLang] || blog.ar || {};
  const items    = langData.travel || [];
  if (!items.length) {
    page.innerHTML = `<h2 style="margin-bottom:32px">${currentLang==='ar'?'مقالات السفر':'Travel Blog'}</h2><p style="color:#888">${currentLang==='ar'?'لا توجد مقالات بعد.':'No articles yet.'}</p>`;
    return;
  }
  page.innerHTML = `
    <h2 style="font-size:28px;font-weight:700;margin-bottom:32px">${currentLang==='ar'?'مقالات السفر':'Travel Blog'}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px">
      ${items.map((a,i) => `
        <div onclick="openArticle(${i})" style="background:#16161f;border:1px solid #1e1e2e;border-radius:14px;overflow:hidden;cursor:pointer">
          ${a.image ? `<img src="${a.image}" style="width:100%;height:160px;object-fit:cover;display:block">` : `<div style="height:80px;background:#1e1e2e;display:flex;align-items:center;justify-content:center;font-size:36px">${a.icon||'✈️'}</div>`}
          <div style="padding:16px">
            <div style="font-weight:600;font-size:14px;margin-bottom:6px">${a.title}</div>
            ${a.excerpt ? `<div style="font-size:12px;color:#888;line-height:1.5">${a.excerpt.slice(0,80)}...</div>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

function renderAboutPage() {
  const page = document.getElementById('about-page');
  if (!page) return;
  const ar = currentLang === 'ar';
  page.innerHTML = `
    <div style="max-width:800px;margin:90px auto 60px;padding:0 20px">
      <h1 style="font-size:clamp(28px,5vw,48px);font-weight:700;margin-bottom:16px">${ar?'من نحن':'About Us'}</h1>
      <p style="font-size:16px;color:#aaa;line-height:1.8;margin-bottom:32px">
        ${ar ? 'Fetchli هو مساعدك الذكي للسفر — يقارن أسعار الرحلات والفنادق من عشرات المنصات.' : 'Fetchli is your smart travel assistant — comparing flight and hotel prices from dozens of platforms.'}
      </p>
    </div>`;
}

function renderContactPage() {
  const page = document.getElementById('contact-page');
  if (!page) return;
  const ar = currentLang === 'ar';
  page.innerHTML = `
    <div style="max-width:600px;margin:90px auto 60px;padding:0 20px">
      <h1 style="font-size:clamp(28px,5vw,48px);font-weight:700;margin-bottom:8px">${ar?'تواصل معنا':'Contact Us'}</h1>
      <p style="color:#888;margin-bottom:36px">${ar?'نحن هنا للمساعدة':'We\'re here to help'}</p>
      <a href="mailto:hello@fetchli.shop" style="color:#7c6af7;font-size:15px">hello@fetchli.shop</a>
    </div>`;
}

function showPage(page) {
  const home = document.getElementById('home-content');
  if (home) home.style.display = page === 'home' ? '' : 'none';
  ['privacy','terms','about','contact','blog'].forEach(p => {
    const el = document.getElementById(p + '-page');
    if (el) el.style.display = p === page ? 'block' : 'none';
  });
  if (page === 'blog')    renderBlogPage();
  if (page === 'about')   renderAboutPage();
  if (page === 'contact') renderContactPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ────────────────────────────────────
// Mode — السفر دائماً active
// ────────────────────────────────────
function setMode(mode) {
  currentMode = 'travel';
  document.getElementById('shopCard')?.classList.remove('active-shop');
  document.getElementById('travelCard')?.classList.add('active-travel');

  const accent  = document.getElementById('heroAccent');
  const label   = document.getElementById('chatModeLabel');
  const sendBtn = document.getElementById('sendBtn');
  const bg      = document.getElementById('heroBg');

  if (accent)  accent.style.color  = 'var(--travel)';
  if (label)   label.textContent   = currentLang==='ar' ? 'مساعد السفر الذكي' : 'Smart Travel Assistant';
  if (sendBtn) sendBtn.className   = 'send-btn travel-send';
  if (bg)      bg.className        = 'hero-bg travel';

  const dt = document.getElementById('deals-title');
  const at = document.getElementById('articles-title');
  if (dt) dt.textContent = '✈️ أفضل عروض السفر';
  if (at) at.textContent = '📖 مقالات السفر';

  renderChips('travel');
  if (_contentData) { renderDeals(_contentData.manual_deals); renderArticles(_contentData.blog); }

  // لو المستخدم ضغط على التسوق → وجّهه
  if (mode === 'shop') {
    window.location.href = 'https://fetchli.shop';
  }
}

// ────────────────────────────────────
// Chips
// ────────────────────────────────────
const CHIPS = {
  ar:  ['🏖️ فنادق دبي','✈️ رحلات بانكوك','🏨 فنادق اسطنبول','🚗 تأجير سيارات','🏝️ المالديف'],
  en:  ['🏖️ Dubai Hotels','✈️ Bangkok Flights','🏨 Istanbul Hotels','🚗 Car Rental','🏝️ Maldives'],
  de:  ['🏖️ Dubai Hotels','✈️ Bangkok Flüge','🏨 Istanbul Hotels','🚗 Auto mieten','🏝️ Malediven'],
};
function renderChips(mode) {
  const row = document.getElementById('chipsRow');
  if (!row) return;
  const chips = CHIPS[currentLang] || CHIPS.ar;
  row.innerHTML = chips.map(c=>`<button class="chip" onclick="handleSend('${c.replace(/^[^\s]+\s/,'')}')">${c}</button>`).join('');
}

// ────────────────────────────────────
// Footer
// ────────────────────────────────────
function renderFooter() {
  const ar = currentLang==='ar';
  const services = ar
    ? ['✈️ تذاكر طيران','🏨 فنادق','🚗 تأجير سيارات','🤖 مساعد AI']
    : ['✈️ Flights','🏨 Hotels','🚗 Car Rental','🤖 AI Assistant'];
  const company = ar
    ? ['من نحن|about','المدونة|blog','الشروط|terms','الخصوصية|privacy']
    : ['About Us|about','Blog|blog','Terms|terms','Privacy|privacy'];

  const sList = document.getElementById('footer-services');
  const cList = document.getElementById('footer-company');
  const lList = document.getElementById('footer-legal');
  if (sList) sList.innerHTML = services.map(s=>`<li>${s}</li>`).join('');
  if (cList) cList.innerHTML = company.map(c=>{ const[t,p]=c.split('|'); return `<li><a href="#" onclick="showPage('${p}')" style="color:#888;text-decoration:none">${t}</a></li>`; }).join('');
  if (lList) lList.innerHTML = (ar?['سياسة الخصوصية|privacy','شروط الاستخدام|terms']:['Privacy Policy|privacy','Terms of Use|terms']).map(c=>{ const[t,p]=c.split('|'); return `<li><a href="#" onclick="showPage('${p}')" style="color:#888;text-decoration:none">${t}</a></li>`; }).join('');
}

// ────────────────────────────────────
// Steps
// ────────────────────────────────────
function renderSteps() {
  const grid = document.getElementById('steps-grid');
  if (!grid) return;
  const ar = currentLang==='ar';
  const steps = ar
    ? [{icon:'💬',t:'أخبرنا بوجهتك',d:'اكتب اسم المدينة أو الفندق'},{icon:'🔍',t:'نبحث في الكل',d:'نقارن الرحلات والفنادق من عشرات المصادر'},{icon:'✅',t:'احجز الأفضل',d:'أسعار حقيقية مع رابط حجز مباشر'}]
    : [{icon:'💬',t:'Tell us your destination',d:'Type a city or hotel name'},{icon:'🔍',t:'We search everything',d:'Comparing flights and hotels from dozens of sources'},{icon:'✅',t:'Book the best',d:'Real prices with direct booking link'}];
  grid.innerHTML = steps.map((s,i)=>`
    <div class="step-card">
      <div class="step-num">${i+1}</div>
      <div class="step-icon">${s.icon}</div>
      <div class="step-title">${s.t}</div>
      <div class="step-desc">${s.d}</div>
    </div>`).join('');
}

// ────────────────────────────────────
// Chat — يتصل بـ /api/travel/*
// ────────────────────────────────────
function handleSend(text) {
  const val = text || document.getElementById('msgInput')?.value?.trim();
  if (val) sendMessage(val);
}

async function sendMessage(text, imageBase64 = null) {
  if (!text && !imageBase64) return;
  addMessage('user', imageBase64 ? `📸 ${text||'صورة'}` : text);
  clearInput();
  showTyping('جاري تحليل طلبك...');
  try {
    // ── تحليل الطلب ──
    const analyzeRes = await fetch(`${API}/api/travel/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, imageBase64 }),
    });
    const analyzed = await analyzeRes.json();

    updateTyping('جاري البحث عن أفضل الأسعار...');

    // ── البحث ──
    const searchRes = await fetch(`${API}/api/travel/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis: analyzed, market: userLocation.market || 'SA' }),
    });
    const data = await searchRes.json();

    // تحويل بطاقات السفر لنفس شكل المنتجات
    const cards = (data.cards || []).map(card => ({
      id:      card.id,
      name:    card.name,
      price:   card.price,
      store:   card.platform,
      image:   card.image,
      url:     card.url,
      badge:   card.badge,
      rating:  card.rating,
      details: card.details,
      source:  card.source,
    }));

    removeTyping();

    const reply = analyzed.reply || `وجدت لك ${cards.length} خيار`;
    addMessage('ai', reply);
    if (cards.length > 0) addProducts(cards);
    else addMessage('ai', 'لم أجد نتائج، جرّب تحديد المدينة والتاريخ بشكل أوضح 🗓️');

  } catch(err) {
    removeTyping();
    addMessage('ai', 'حدث خطأ، حاول مرة ثانية 🙏');
    console.error(err);
  }
}

function addMessage(role, text) {
  const chat = document.getElementById('chatArea'); if(!chat) return;
  const row  = document.createElement('div'); row.className = `msg-row ${role}`;
  row.innerHTML = `<div class="msg-avatar ${role}">${role==='ai'?'✦':'👤'}</div><div class="msg-bubble ${role}">${text}</div>`;
  chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
}

function addProducts(products) {
  const chat = document.getElementById('chatArea'); if(!chat) return;
  const grid = document.createElement('div'); grid.className='products-grid';
  grid.innerHTML = products.map(p=>`
    <div class="product-card">
      <div class="product-img-wrap">
        ${p.image ? `<img src="${p.image}" alt="${p.name}" class="product-img" loading="lazy" onerror="this.style.display='none'">` : `<div style="height:120px;background:#1e1e2e;display:flex;align-items:center;justify-content:center;font-size:48px">${p.source==='hotellook'?'🏨':'✈️'}</div>`}
        <span class="product-badge">${p.badge||''}</span>
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-store"><span class="dot"></span>${p.store||''}${p.rating?`<span class="rating">⭐ ${p.rating}</span>`:''}</div>
        ${p.details ? `<div style="font-size:11px;color:#888;margin:4px 0">${p.details}</div>` : ''}
        <div class="product-price">${p.price}</div>
        <div class="product-actions">
          <a class="btn-buy" href="${p.url}" target="_blank" rel="noopener">احجز الآن ←</a>
        </div>
      </div>
    </div>`).join('');
  chat.appendChild(grid); chat.scrollTop = chat.scrollHeight;
}

function showTyping(msg) {
  const chat=document.getElementById('chatArea'); if(!chat) return;
  const el=document.createElement('div'); el.id='typing'; el.className='msg-row ai';
  el.innerHTML=`<div class="msg-avatar ai">✦</div><div class="typing-wrap-inner"><div class="typing-bubble"><span></span><span></span><span></span></div><div class="typing-label" id="typingLabel">${msg}</div></div>`;
  chat.appendChild(el); chat.scrollTop=chat.scrollHeight;
}
function updateTyping(msg) { const l=document.getElementById('typingLabel'); if(l) l.textContent=msg; }
function removeTyping()    { document.getElementById('typing')?.remove(); }
function clearInput()      { const i=document.getElementById('msgInput'); if(i) i.value=''; }

// ────────────────────────────────────
// Init
// ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ['privacy','terms','about','contact','blog'].forEach(p => {
    const el = document.getElementById(p+'-page');
    if (el) el.style.display = 'none';
  });

  detectLocation();
  I18n.set('ar');
  setMode('travel');
  loadContent();
  renderFooter();
  renderSteps();

  document.getElementById('msgInput')?.addEventListener('keydown', e => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  document.getElementById('sendBtn')?.addEventListener('click', () => handleSend());
  document.getElementById('imageInput')?.addEventListener('change', e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const b=ev.target.result.split(',')[1]; sendMessage('أبي رحلات مشابهة',b); };
    reader.readAsDataURL(file);
  });
});
