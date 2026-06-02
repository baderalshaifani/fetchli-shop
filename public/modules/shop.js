// ===================================
// fetchli — وحدة التسوق
// ===================================

const ShopModule = (() => {

  // ── إعدادات البحث ──
  const CONFIG = {
    maxResults:     8,
    maxQueries:     3,
    timeoutMs:      12000,
    retryOnFail:    true,
    filterMinCount: 1,
  };

  // ── تحليل الطلب ──
  async function analyze(message, imageBase64, wantCheaper) {
    const res = await fetchWithTimeout('/api/analyze', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message, imageBase64, wantCheaper, mode: 'shop' }),
    });
    return res.json();
  }

  // ── البحث في المتاجر ──
  async function search(analyzed, market, wantCheaper) {
    const res = await fetchWithTimeout('/api/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        queries:    analyzed.searchQueries || [],
        market,
        wantCheaper,
        searchType: 'product',
      }),
    });
    return res.json();
  }

  // ── تصفية النتائج ──
  async function filter(products, analyzed, wantCheaper) {
    if (products.length < CONFIG.filterMinCount) return products;
    try {
      const res = await fetchWithTimeout('/api/filter', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ products, originalAnalysis: analyzed, wantCheaper }),
      });
      const data = await res.json();
      return data.products?.length >= 1 ? data.products : products;
    } catch {
      return products;
    }
  }

  // ── تحديد "يريد أرخص" ──
  function detectCheaper(text) {
    return /أرخص|رخيص|بديل|أوفر|اقتصادي|cheaper|budget|alternative|günstig|سستا/i.test(text || '');
  }

  // ── fetch مع timeout ──
  async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // ── تنسيق السعر حسب العملة ──
  function formatPrice(price, currency) {
    if (!price || price === 'تحقق من السعر') return price;
    // لو السعر بالدولار وعملة المستخدم مختلفة
    const rates = { SAR: 3.75, AED: 3.67, EGP: 48, KWD: 0.31, QAR: 3.64 };
    if (currency === 'USD' || !rates[currency]) return price;
    const num = parseFloat(String(price).replace(/[^\d.]/g, ''));
    if (!num) return price;
    const converted = (num * rates[currency]).toFixed(0);
    const symbols = { SAR:'ر.س', AED:'د.إ', EGP:'ج.م', KWD:'د.ك', QAR:'ر.ق' };
    return `${converted} ${symbols[currency] || currency}`;
  }

  return { analyze, search, filter, detectCheaper, formatPrice, CONFIG };

})();

window.ShopModule = ShopModule;
