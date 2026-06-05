// ===================================
// fetchli.shop — app.js (complete)
// ===================================

const API = '';
let userLocation = { country:'SA', market:'SA', currency:'SAR', flag:'🇸🇦', name:'السعودية' };
let currentLang  = 'ar';
let currentMode  = 'shop';
let _contentData = null; // cache المحتوى

// ────────────────────────────────────
// i18n — النصوص
// ────────────────────────────────────
const STRINGS = {
  ar: {
    'nav.home':'الرئيسية','nav.blog':'المدونة','nav.about':'من نحن','nav.contact':'تواصل معنا',
    'hero.badge':'🌟 تسوق وسافر بذكاء','hero.title1':'قارن. اختر.','hero.title2':'وفّر أكثر',
    'hero.sub':'اختر ما تريد ويساعدك المساعد الذكي في إيجاد أفضل الأسعار',
    'mode.shopLabel':'تسوق','mode.shopDesc':'منتجات، إلكترونيات، ملابس وأكثر',
    'mode.travelLabel':'سفر','mode.travelDesc':'فنادق، سيارات ورحلات حول العالم',
    'chat.placeholder':'اكتب اسم المنتج أو الوجهة...',
    'stats.s1':'منتج وفندق','stats.s2':'دولة','stats.s3':'متوسط التوفير','stats.s4':'مقارنة فورية',
    'trusted':'نقارن الأسعار من',
    'how.title':'كيف يعمل Fetchli؟','how.sub':'ثلاث خطوات بسيطة',
    'footer.desc':'مساعدك الذكي للتسوق والسفر','footer.services':'الخدمات',
    'footer.company':'الشركة','footer.legal':'القانونية',
    'footer.copy':'© 2026 Fetchli','footer.tagline':'تسوق وسفر بذكاء',
  },
  en: {
    'nav.home':'Home','nav.blog':'Blog','nav.about':'About','nav.contact':'Contact',
    'hero.badge':'🌟 Shop & Travel Smart','hero.title1':'Compare. Choose.','hero.title2':'Save More',
    'hero.sub':'Tell us what you want and our AI finds the best prices',
    'mode.shopLabel':'Shop','mode.shopDesc':'Products, electronics, fashion and more',
    'mode.travelLabel':'Travel','mode.travelDesc':'Hotels, cars and trips worldwide',
    'chat.placeholder':'Search for a product or destination...',
    'stats.s1':'Products & Hotels','stats.s2':'Countries','stats.s3':'Average Savings','stats.s4':'Instant Compare',
    'trusted':'We compare prices from',
    'how.title':'How Fetchli Works','how.sub':'Three simple steps',
    'footer.desc':'Your smart shopping and travel assistant','footer.services':'Services',
    'footer.company':'Company','footer.legal':'Legal',
    'footer.copy':'© 2026 Fetchli','footer.tagline':'Shop & Travel Smart',
  },
  de: {
    'nav.home':'Startseite','nav.blog':'Blog','nav.about':'Über uns','nav.contact':'Kontakt',
    'hero.badge':'🌟 Clever einkaufen & reisen','hero.title1':'Vergleichen. Wählen.','hero.title2':'Mehr sparen',
    'hero.sub':'Sag uns was du suchst – unsere KI findet die besten Preise',
    'mode.shopLabel':'Einkaufen','mode.shopDesc':'Produkte, Elektronik, Mode und mehr',
    'mode.travelLabel':'Reisen','mode.travelDesc':'Hotels, Autos und Reisen weltweit',
    'chat.placeholder':'Produkt oder Reiseziel suchen...',
    'stats.s1':'Produkte & Hotels','stats.s2':'Länder','stats.s3':'Ø Ersparnis','stats.s4':'Sofortvergleich',
    'trusted':'Wir vergleichen Preise von',
    'how.title':'Wie Fetchli funktioniert','how.sub':'Drei einfache Schritte',
    'footer.desc':'Dein smarter Shopping- & Reise-Assistent','footer.services':'Dienste',
    'footer.company':'Unternehmen','footer.legal':'Rechtliches',
    'footer.copy':'© 2026 Fetchli','footer.tagline':'Clever einkaufen & reisen',
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
    // إعادة رسم المحتوى باللغة الجديدة
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
// جلب المحتوى من السيرفر
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

// ── نصيحة اليوم ──
function renderTip(tips) {
  const el = document.getElementById('tip-text');
  if (!el) return;
  const list = tips?.[currentLang] || tips?.ar || [];
  if (!list.length) {
    const fb = { ar:'قارن الأسعار دائماً قبل الشراء — وفّر حتى ٤٠٪!', en:'Always compare prices — save up to 40%!', de:'Preise vergleichen und bis zu 40% sparen!' };
    el.textContent = fb[currentLang] || fb.ar;
    return;
  }
  el.textContent = list[new Date().getDate() % list.length];
}

// ── العروض ──
function renderDeals(deals) {
  const grid = document.getElementById('deals-grid');
  if (!grid) return;
  const items = deals?.[currentMode] || [];
  if (!items.length) { grid.innerHTML = _fallbackDeals(currentMode); return; }
  grid.innerHTML = items.map(d => `
    <div class="deal-card" style="background:${d.bg||'#1a2a4a'};cursor:${d.url?'pointer':'default'}"
      onclick="${d.url ? `window.open('${d.url}','_blank')` : ''}">
      ${d.image ? `<img src="${d.image}" style="width:100%;height:100px;object-fit:cover;border-radius:8px 8px 0 0;display:block" onerror="this.style.display='none'">` : ''}
      <div style="padding:12px">
        <div class="deal-icon">${d.icon||'🏷️'}</div>
        <div class="deal-body">
          <div class="deal-title">${d.title}</div>
          ${d.desc ? `<div style="font-size:11px;opacity:.7;margin-top:3px">${d.desc}</div>` : ''}
          <div class="deal-price">${d.price} ${d.savings?`<span class="deal-save">وفّر ${d.savings}</span>`:''}</div>
        </div>
      </div>
    </div>`).join('');
}

function _fallbackDeals(mode) {
  if (mode==='travel') return `
    <div class="deal-card" style="background:#1a3a5c;cursor:default"><div style="padding:12px"><div class="deal-icon">✈️</div><div class="deal-body"><div class="deal-title">تذاكر دبي</div><div class="deal-price">من ٢٩٩ ر.س <span class="deal-save">وفّر ٤٠٪</span></div></div></div></div>
    <div class="deal-card" style="background:#1a2d4a;cursor:default"><div style="padding:12px"><div class="deal-icon">🏨</div><div class="deal-body"><div class="deal-title">فنادق القاهرة</div><div class="deal-price">من ١٩٩ ر.س <span class="deal-save">وفّر ٣٠٪</span></div></div></div></div>
    <div class="deal-card" style="background:#162040;cursor:default"><div style="padding:12px"><div class="deal-icon">🚗</div><div class="deal-body"><div class="deal-title">تأجير سيارات</div><div class="deal-price">من ٨٩ ر.س/يوم</div></div></div></div>`;
  return `
    <div class="deal-card" style="background:#1a2a4a;cursor:default"><div style="padding:12px"><div class="deal-icon">📱</div><div class="deal-body"><div class="deal-title">إلكترونيات</div><div class="deal-price">خصم حتى ٥٠٪</div></div></div></div>
    <div class="deal-card" style="background:#1a1e3a;cursor:default"><div style="padding:12px"><div class="deal-icon">👗</div><div class="deal-body"><div class="deal-title">ملابس وأزياء</div><div class="deal-price">خصم حتى ٤٠٪</div></div></div></div>
    <div class="deal-card" style="background:#1e1a3a;cursor:default"><div style="padding:12px"><div class="deal-icon">🏠</div><div class="deal-body"><div class="deal-title">أثاث وديكور</div><div class="deal-price">خصم حتى ٣٠٪</div></div></div></div>`;
}

// ── مقالات الرئيسية (preview) ──
function renderArticles(blog) {
  const list = document.getElementById('articles-list');
  if (!list) return;
  const langData = blog?.[currentLang] || blog?.ar || {};
  const items    = (langData[currentMode] || []).slice(0,4);
  if (!items.length) { list.innerHTML = _fallbackArticles(); return; }
  list.innerHTML = items.map((a,i) => `
    <div class="article-card" onclick="openArticle(${i},'${currentMode}')" style="cursor:pointer">
      ${a.image ? `<img src="${a.image}" class="article-thumb" onerror="this.style.display='none'">` : `<div class="article-icon">${a.icon||'📄'}</div>`}
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
    ar:{ travel:[{icon:'✈️',title:'أفضل ١٠ وجهات سياحية في ٢٠٢٦',meta:'سفر · ٥ دقائق'},{icon:'🏨',title:'كيف تختار الفندق المثالي',meta:'فنادق · ٣ دقائق'},{icon:'💳',title:'نصائح توفير المال في السفر',meta:'نصائح · ٤ دقائق'}],
       shop:[{icon:'📱',title:'أفضل هواتف ٢٠٢٦ بالمقارنة',meta:'إلكترونيات · ٦ دقائق'},{icon:'👟',title:'دليل شراء الأحذية الرياضية',meta:'أزياء · ٤ دقائق'},{icon:'💡',title:'كيف تتجنب المنتجات المقلدة',meta:'نصائح · ٣ دقائق'}] },
    en:{ travel:[{icon:'✈️',title:'Top 10 Travel Destinations 2026',meta:'Travel · 5 min'},{icon:'🏨',title:'How to Pick the Perfect Hotel',meta:'Hotels · 3 min'}],
       shop:[{icon:'📱',title:'Best Phones of 2026',meta:'Tech · 6 min'},{icon:'👟',title:'Sneaker Buying Guide',meta:'Fashion · 4 min'}] },
  };
  const data = (fb[currentLang]||fb.ar)[currentMode]||[];
  return data.map(a=>`
    <div class="article-card" style="cursor:default">
      <div class="article-icon">${a.icon}</div>
      <div class="article-body"><div class="article-title">${a.title}</div><div class="article-meta">${a.meta}</div></div>
      <div class="article-arrow">←</div>
    </div>`).join('');
}

// ── فتح مقال منفرد ──
function openArticle(index, mode) {
  if (!_contentData) return;
  const langData = _contentData.blog?.[currentLang] || _contentData.blog?.ar || {};
  const article  = (langData[mode] || [])[index];
  if (!article) return;

  // لو فيه رابط → افتحه في تاب جديد
  if (article.url) { window.open(article.url, '_blank'); return; }

  // عرض المقال في صفحة المدونة
  showPage('blog');
  const page = document.getElementById('blog-page');
  page.innerHTML = `
    <button onclick="showPage('home')" style="background:none;border:1px solid #444;color:#aaa;padding:8px 16px;border-radius:8px;cursor:pointer;margin-bottom:24px;font-size:13px">← رجوع</button>
    ${article.image ? `<img src="${article.image}" style="width:100%;max-height:340px;object-fit:cover;border-radius:16px;margin-bottom:28px;display:block">` : ''}
    <div style="font-size:13px;color:#888;margin-bottom:8px">${article.cat||''} ${article.read?'· '+article.read:''} · ${article.date||''}</div>
    <h1 style="font-size:clamp(22px,4vw,36px);font-weight:700;margin-bottom:16px;line-height:1.3">${article.title}</h1>
    ${article.excerpt ? `<p style="font-size:16px;color:#aaa;margin-bottom:24px;line-height:1.7">${article.excerpt}</p>` : ''}
    <div style="font-size:15px;line-height:1.9;color:#ddd;white-space:pre-line">${article.content||''}</div>`;
}

// ────────────────────────────────────
// صفحة المدونة الكاملة
// ────────────────────────────────────
function renderBlogPage() {
  const page = document.getElementById('blog-page');
  if (!page) return;

  const blog = _contentData?.blog || {};
  const langData = blog[currentLang] || blog.ar || {};
  const travel = langData.travel || [];
  const shop   = langData.shop   || [];
  const all    = [...travel.map(a=>({...a,_type:'travel'})), ...shop.map(a=>({...a,_type:'shop'}))];

  if (!all.length) {
    page.innerHTML = `<h2 style="margin-bottom:32px">${currentLang==='ar'?'المدونة':'Blog'}</h2>
      <p style="color:#888">${currentLang==='ar'?'لا توجد مقالات بعد.':'No articles yet.'}</p>`;
    return;
  }

  page.innerHTML = `
    <h2 style="font-size:28px;font-weight:700;margin-bottom:32px">${currentLang==='ar'?'المدونة':'Blog'}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px">
      ${all.map((a,i) => `
        <div onclick="openArticle(${i},'${a._type}')" style="background:#16161f;border:1px solid #1e1e2e;border-radius:14px;overflow:hidden;cursor:pointer;transition:.2s" onmouseover="this.style.borderColor='#7c6af7'" onmouseout="this.style.borderColor='#1e1e2e'">
          ${a.image ? `<img src="${a.image}" style="width:100%;height:160px;object-fit:cover;display:block" onerror="this.style.display='none'">` : `<div style="height:80px;background:#1e1e2e;display:flex;align-items:center;justify-content:center;font-size:36px">${a.icon||'📄'}</div>`}
          <div style="padding:16px">
            <div style="font-size:11px;color:#7c6af7;margin-bottom:6px">${a._type==='travel'?'✈️ سفر':'🛍️ تسوق'}</div>
            <div style="font-weight:600;font-size:14px;margin-bottom:6px;line-height:1.4">${a.title}</div>
            ${a.excerpt ? `<div style="font-size:12px;color:#888;line-height:1.5;margin-bottom:8px">${a.excerpt.slice(0,80)}${a.excerpt.length>80?'...':''}</div>` : ''}
            <div style="font-size:11px;color:#555">${a.cat||''} ${a.read?'· '+a.read:''}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

// ────────────────────────────────────
// صفحة من نحن
// ────────────────────────────────────
function renderAboutPage() {
  const page = document.getElementById('about-page');
  if (!page) return;
  const ar = currentLang === 'ar';
  page.innerHTML = `
    <div style="max-width:800px;margin:90px auto 60px;padding:0 20px">
      <h1 style="font-size:clamp(28px,5vw,48px);font-weight:700;margin-bottom:16px">${ar?'من نحن':'About Us'}</h1>
      <p style="font-size:16px;color:#aaa;line-height:1.8;margin-bottom:32px">
        ${ar
          ? 'Fetchli هو مساعدك الذكي للتسوق والسفر — يقارن الأسعار من عشرات المتاجر والمنصات ليوفّر عليك الوقت والمال. نؤمن بأن كل شخص يستحق أفضل صفقة.'
          : 'Fetchli is your smart shopping and travel assistant — comparing prices from dozens of stores and platforms to save you time and money. We believe everyone deserves the best deal.'}
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:40px">
        ${[
          {icon:'🎯', title: ar?'مهمتنا':'Our Mission',   desc: ar?'تبسيط قرار الشراء والسفر لكل إنسان':'Making shopping & travel decisions simple for everyone'},
          {icon:'🤖', title: ar?'تقنيتنا':'Our Tech',      desc: ar?'نستخدم الذكاء الاصطناعي لتحليل آلاف الأسعار فورياً':'AI-powered to analyze thousands of prices in real time'},
          {icon:'🌍', title: ar?'تغطيتنا':'Our Coverage',  desc: ar?'أكثر من ١٩٠ دولة وعشرات المتاجر العالمية':'190+ countries and dozens of global stores'},
        ].map(c=>`
          <div style="background:#16161f;border:1px solid #1e1e2e;border-radius:14px;padding:24px;text-align:center">
            <div style="font-size:36px;margin-bottom:12px">${c.icon}</div>
            <div style="font-weight:600;margin-bottom:8px">${c.title}</div>
            <div style="font-size:13px;color:#888;line-height:1.6">${c.desc}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ────────────────────────────────────
// صفحة تواصل معنا
// ────────────────────────────────────
function renderContactPage() {
  const page = document.getElementById('contact-page');
  if (!page) return;
  const ar = currentLang === 'ar';
  page.innerHTML = `
    <div style="max-width:600px;margin:90px auto 60px;padding:0 20px">
      <h1 style="font-size:clamp(28px,5vw,48px);font-weight:700;margin-bottom:8px">${ar?'تواصل معنا':'Contact Us'}</h1>
      <p style="color:#888;margin-bottom:36px">${ar?'نحن هنا للمساعدة — أرسل لنا رسالة':'We\'re here to help — send us a message'}</p>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <label style="font-size:13px;color:#aaa;display:block;margin-bottom:6px">${ar?'الاسم':'Name'}</label>
          <input id="ct-name" placeholder="${ar?'اسمك الكريم':'Your name'}"
            style="width:100%;background:#16161f;border:1px solid #1e1e2e;border-radius:10px;padding:12px 14px;color:#fff;font-size:14px;outline:none;font-family:inherit">
        </div>
        <div>
          <label style="font-size:13px;color:#aaa;display:block;margin-bottom:6px">${ar?'البريد الإلكتروني':'Email'}</label>
          <input id="ct-email" type="email" placeholder="example@email.com"
            style="width:100%;background:#16161f;border:1px solid #1e1e2e;border-radius:10px;padding:12px 14px;color:#fff;font-size:14px;outline:none;font-family:inherit">
        </div>
        <div>
          <label style="font-size:13px;color:#aaa;display:block;margin-bottom:6px">${ar?'الرسالة':'Message'}</label>
          <textarea id="ct-msg" rows="5" placeholder="${ar?'اكتب رسالتك هنا...':'Write your message...'}"
            style="width:100%;background:#16161f;border:1px solid #1e1e2e;border-radius:10px;padding:12px 14px;color:#fff;font-size:14px;outline:none;font-family:inherit;resize:vertical"></textarea>
        </div>
        <button onclick="submitContact()" style="background:#7c6af7;color:#fff;border:none;border-radius:10px;padding:14px;font-size:15px;cursor:pointer;font-weight:600;font-family:inherit;transition:.2s" onmouseover="this.style.background='#6a58e5'" onmouseout="this.style.background='#7c6af7'">
          ${ar?'إرسال الرسالة ←':'Send Message →'}
        </button>
        <div id="ct-status" style="text-align:center;font-size:14px;color:#4ade80;display:none">${ar?'✅ تم الإرسال! سنرد عليك قريباً':'✅ Sent! We\'ll get back to you soon'}</div>
      </div>

      <div style="margin-top:48px;padding-top:32px;border-top:1px solid #1e1e2e">
        <div style="display:flex;flex-direction:column;gap:12px">
          <a href="mailto:hello@fetchli.shop" style="display:flex;align-items:center;gap:12px;color:#aaa;text-decoration:none;font-size:14px">
            <span style="font-size:20px">📧</span> hello@fetchli.shop
          </a>
          <a href="https://twitter.com/fetchli" target="_blank" style="display:flex;align-items:center;gap:12px;color:#aaa;text-decoration:none;font-size:14px">
            <span style="font-size:20px">𝕏</span> @fetchli
          </a>
        </div>
      </div>
    </div>`;
}

function submitContact() {
  const name  = document.getElementById('ct-name')?.value?.trim();
  const email = document.getElementById('ct-email')?.value?.trim();
  const msg   = document.getElementById('ct-msg')?.value?.trim();
  if (!name || !email || !msg) return;
  // هنا تقدر تضيف fetch لـ API لاحقاً
  document.getElementById('ct-status').style.display = 'block';
  document.getElementById('ct-name').value  = '';
  document.getElementById('ct-email').value = '';
  document.getElementById('ct-msg').value   = '';
}

// ────────────────────────────────────
// تبديل الصفحات
// ────────────────────────────────────
function showPage(page) {
  // إخفاء الكل
  const home = document.getElementById('home-content');
  if (home) home.style.display = page === 'home' ? '' : 'none';

  ['privacy','terms','about','contact','blog'].forEach(p => {
    const el = document.getElementById(p + '-page');
    if (el) el.style.display = p === page ? 'block' : 'none';
  });

  // بناء محتوى الصفحة
  if (page === 'blog')    renderBlogPage();
  if (page === 'about')   renderAboutPage();
  if (page === 'contact') renderContactPage();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ────────────────────────────────────
// Mode: shop / travel
// ────────────────────────────────────
function setMode(mode) {
  currentMode = mode;
  document.getElementById('shopCard')?.classList.toggle('active-shop',    mode==='shop');
  document.getElementById('travelCard')?.classList.toggle('active-travel', mode==='travel');

  const accent  = document.getElementById('heroAccent');
  const label   = document.getElementById('chatModeLabel');
  const sendBtn = document.getElementById('sendBtn');
  const bg      = document.getElementById('heroBg');

  if (accent)  accent.style.color   = mode==='shop' ? 'var(--shop)' : 'var(--travel)';
  if (label)   label.textContent    = mode==='shop' ? (currentLang==='ar'?'مساعد التسوق الذكي':'Smart Shopping Assistant') : (currentLang==='ar'?'مساعد السفر الذكي':'Smart Travel Assistant');
  if (sendBtn) { sendBtn.className  = 'send-btn ' + (mode==='shop'?'shop-send':'travel-send'); }
  if (bg)      bg.className         = 'hero-bg ' + mode;

  const dt = document.getElementById('deals-title');
  const at = document.getElementById('articles-title');
  if (mode==='travel') { if(dt) dt.textContent='✈️ أفضل عروض السفر'; if(at) at.textContent='📖 مقالات السفر'; }
  else                 { if(dt) dt.textContent='🔥 أفضل العروض';      if(at) at.textContent='📖 من المدونة'; }

  renderChips(mode);
  if (_contentData) { renderDeals(_contentData.manual_deals); renderArticles(_contentData.blog); }
}

// ────────────────────────────────────
// Chips
// ────────────────────────────────────
const CHIPS = {
  ar:{ shop:['👟 أحذية نايك','📱 آيفون ١٦','👜 حقيبة فندي','⌚ ساعة رولكس','💄 باليت ظلال'], travel:['🏖️ فنادق دبي','✈️ رحلات بانكوك','🏨 فنادق اسطنبول','🚗 تأجير سيارات','🌍 شرم الشيخ'] },
  en:{ shop:['👟 Nike Shoes','📱 iPhone 16','👜 Fendi Bag','⌚ Rolex Watch','💄 Eye Palette'],    travel:['🏖️ Dubai Hotels','✈️ Bangkok Flights','🏨 Istanbul Hotels','🚗 Car Rental','🌍 Maldives'] },
  de:{ shop:['👟 Nike Schuhe','📱 iPhone 16','👜 Handtasche','⌚ Rolex Uhr','💄 Lidschatten'],   travel:['🏖️ Dubai Hotels','✈️ Bangkok Flüge','🏨 Istanbul Hotels','🚗 Auto mieten','🌍 Malediven'] },
};
function renderChips(mode) {
  const row = document.getElementById('chipsRow');
  if (!row) return;
  const chips = CHIPS[currentLang]?.[mode] || CHIPS.ar[mode];
  row.innerHTML = chips.map(c=>`<button class="chip" onclick="handleSend('${c.replace(/^[^\s]+\s/,'')}')">${c}</button>`).join('');
}

// ────────────────────────────────────
// Footer
// ────────────────────────────────────
function renderFooter() {
  const ar = currentLang==='ar';
  const services = ar
    ? ['🛍️ تسوق ذكي','✈️ مقارنة سفر','🤖 مساعد AI','💰 أفضل أسعار']
    : ['🛍️ Smart Shopping','✈️ Travel Compare','🤖 AI Assistant','💰 Best Prices'];
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
    ? [{icon:'💬',t:'أخبرنا بما تريد',d:'اكتب اسم المنتج أو وجهة السفر أو ارفع صورة'},{icon:'🔍',t:'نبحث في الكل',d:'نقارن آلاف الأسعار من عشرات المصادر في ثوانٍ'},{icon:'✅',t:'اختر الأفضل',d:'نرتّب النتائج بذكاء لتختار بثقة'}]
    : [{icon:'💬',t:'Tell us what you need',d:'Type a product, destination, or upload an image'},{icon:'🔍',t:'We search everything',d:'Comparing thousands of prices from dozens of sources in seconds'},{icon:'✅',t:'Pick the best',d:'Results ranked smartly so you choose with confidence'}];
  grid.innerHTML = steps.map((s,i)=>`
    <div class="step-card">
      <div class="step-num">${i+1}</div>
      <div class="step-icon">${s.icon}</div>
      <div class="step-title">${s.t}</div>
      <div class="step-desc">${s.d}</div>
    </div>`).join('');
}

// ────────────────────────────────────
// Chat
// ────────────────────────────────────
function handleSend(text) {
  const val = text || document.getElementById('msgInput')?.value?.trim();
  if (val) sendMessage(val);
}

async function sendMessage(text, imageBase64 = null) {
  if (!text && !imageBase64) return;
  const wantCheaper = text && /أرخص|رخيص|بديل|أوفر|اقتصادي|cheaper|budget|alternative/i.test(text);
  addMessage('user', imageBase64 ? `📸 ${text||'صورة'}` : text);
  clearInput();
  showTyping('جاري تحليل طلبك...');
  try {
    const analyzeRes = await fetch(`${API}/api/analyze`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:text,imageBase64,wantCheaper,mode:currentMode}) });
    const analyzed   = await analyzeRes.json();
    updateTyping('جاري البحث...');
    const searchRes  = await fetch(`${API}/api/search`,  { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({queries:analyzed.searchQueries||[text],market:userLocation.market||'SA',wantCheaper}) });
    const {products,mock} = await searchRes.json();
    let finalProducts = products;
    if (products?.length > 3 && analyzed.productType) {
      updateTyping('جاري اختيار الأفضل...');
      try {
        const filterRes = await fetch(`${API}/api/filter`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({products,originalAnalysis:analyzed,wantCheaper}) });
        const filtered  = await filterRes.json();
        if (filtered.products?.length) finalProducts = filtered.products;
      } catch(e){}
    }
    removeTyping();
    const reply       = analyzed.reply || `وجدت لك ${finalProducts.length} نتيجة`;
    const detailLine  = analyzed.productType ? `\n🔍 ${analyzed.productType}${analyzed.brand?' • '+analyzed.brand:''}${analyzed.color?' • '+analyzed.color:''}` : '';
    const mockNote    = mock ? '\n\n_نتائج تجريبية_' : '';
    const accuracyNote = `\n✦ دقة التطابق: ${analyzed.confidence||90}٪`;
    addMessage('ai', reply + detailLine + accuracyNote + mockNote);
    if (finalProducts?.length > 0) addProducts(finalProducts, wantCheaper);
  } catch(err) {
    removeTyping();
    addMessage('ai', 'حدث خطأ، حاول مرة ثانية 🙏');
    console.error(err);
  }
}

function handleImageUpload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { const b=e.target.result.split(',')[1]; addImagePreview(e.target.result); sendMessage('أبي منتجات مشابهة',b); };
  reader.readAsDataURL(file);
}

function addMessage(role, text) {
  const chat = document.getElementById('chatArea'); if(!chat) return;
  const row  = document.createElement('div'); row.className = `msg-row ${role}`;
  row.innerHTML = `<div class="msg-avatar ${role}">${role==='ai'?'✦':'👤'}</div><div class="msg-bubble ${role}">${text}</div>`;
  chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
}
function addImagePreview(src) {
  const chat = document.getElementById('chatArea'); if(!chat) return;
  const row  = document.createElement('div'); row.className = 'msg-row user';
  row.innerHTML = `<div class="msg-avatar user">👤</div><img src="${src}" class="img-preview">`;
  chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
}
function addProducts(products, cheaper=false) {
  const chat = document.getElementById('chatArea'); if(!chat) return;
  if (cheaper) { const l=document.createElement('div'); l.className='cheaper-label'; l.textContent='💰 مرتبة من الأرخص للأغلى'; chat.appendChild(l); }
  const grid = document.createElement('div'); grid.className='products-grid';
  grid.innerHTML = products.map(p=>`
    <div class="product-card">
      <div class="product-img-wrap"><img src="${p.image}" alt="${p.name}" class="product-img" loading="lazy"><span class="product-badge">${p.badge||''}</span></div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-store"><span class="dot"></span>${p.store}${p.rating?`<span class="rating">⭐ ${p.rating}</span>`:''}</div>
        <div class="product-price">${p.price}</div>
        <div class="product-actions">
          <button class="btn-details" onclick='openProduct(${JSON.stringify(p).replace(/"/g,"&quot;")})'>التفاصيل</button>
          <a class="btn-buy" href="${p.url}" target="_blank" rel="noopener">اشتري ←</a>
        </div>
      </div>
    </div>`).join('');
  chat.appendChild(grid); chat.scrollTop = chat.scrollHeight;
}
function openProduct(p) {
  document.getElementById('ms-name').textContent  = p.name;
  document.getElementById('ms-store').textContent = p.store;
  document.getElementById('ms-price').textContent = p.price;
  document.getElementById('ms-img').src           = p.image;
  document.getElementById('ms-link').href         = p.url;
  document.getElementById('ministore').style.display = 'flex';
}
function showTyping(msg) {
  const chat=document.getElementById('chatArea'); if(!chat) return;
  const el=document.createElement('div'); el.id='typing'; el.className='msg-row ai';
  el.innerHTML=`<div class="msg-avatar ai">✦</div><div class="typing-wrap-inner"><div class="typing-bubble"><span></span><span></span><span></span></div><div class="typing-label" id="typingLabel">${msg}</div></div>`;
  chat.appendChild(el); chat.scrollTop=chat.scrollHeight;
}
function updateTyping(msg) { const l=document.getElementById('typingLabel'); if(l) l.textContent=msg; }
function removeTyping() { document.getElementById('typing')?.remove(); }
function clearInput()   { const i=document.getElementById('msgInput'); if(i) i.value=''; }

// ────────────────────────────────────
// Init
// ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // إخفاء صفحات الـ pages الثانوية
  ['privacy','terms','about','contact','blog'].forEach(p => {
    const el = document.getElementById(p+'-page');
    if (el) el.style.display = 'none';
  });

  detectLocation();
  I18n.set('ar');
  setMode('shop');
  loadContent();
  renderFooter();
  renderSteps();

  document.getElementById('msgInput')?.addEventListener('keydown', e => {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  document.getElementById('sendBtn')?.addEventListener('click', () => handleSend());
  document.getElementById('imageInput')?.addEventListener('change', e => handleImageUpload(e.target.files[0]));
  document.getElementById('ministore')?.addEventListener('click', e => {
    if (e.target===document.getElementById('ministore')) document.getElementById('ministore').style.display='none';
  });
  document.getElementById('ms-close')?.addEventListener('click', () => {
    document.getElementById('ministore').style.display='none';
  });
});
