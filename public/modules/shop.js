// ===================================
// fetchli.shop — ShopModule (فرونت)
// ===================================
// يُستدعى من app.js فقط عند currentMode === 'shop'

const ShopModule = (() => {

  // ── كلمات تدل على "أريد أرخص" ──
  const CHEAPER_REGEX = /أرخص|رخيص|بديل|أوفر|اقتصادي|cheaper|budget|alternative|dupe/i;

  /**
   * هل المستخدم يريد بديلاً أرخص؟
   */
  function detectCheaper(text) {
    return text ? CHEAPER_REGEX.test(text) : false;
  }

  /**
   * تحليل الصورة أو النص بـ Claude
   */
  async function analyze(text, imageBase64, wantCheaper) {
    const res = await fetch('/api/analyze', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, imageBase64, wantCheaper }),
    });
    return res.json();
  }

  /**
   * البحث في المتاجر
   */
  async function search(analyzed, market, wantCheaper) {
    const res = await fetch('/api/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        queries:    analyzed.searchQueries || [],
        market,
        wantCheaper,
      }),
    });
    return res.json();
  }

  /**
   * تصفية وترتيب النتائج
   */
  async function filter(products, analyzed, wantCheaper) {
    if (!products?.length) return [];
    try {
      const res = await fetch('/api/filter', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ products, originalAnalysis: analyzed, wantCheaper }),
      });
      const data = await res.json();
      return data.products?.length ? data.products : products;
    } catch {
      return products;
    }
  }

  /**
   * تنسيق السعر حسب عملة المستخدم
   */
  function formatPrice(priceStr, currency) {
    if (!priceStr) return '';
    // لو السعر فيه عملة مختلفة نعيده كما هو
    const currencySymbols = ['ر.س', 'SAR', '$', 'USD', 'AED', 'د.إ', 'EGP', 'ج.م', '¥', 'CNY'];
    for (const sym of currencySymbols) {
      if (String(priceStr).includes(sym)) return priceStr;
    }
    return priceStr;
  }

  return { detectCheaper, analyze, search, filter, formatPrice };

})();
