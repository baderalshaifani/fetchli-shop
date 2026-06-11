// ===================================
// modules/shopping/helpers.js
// ===================================

// ترتيب المنتجات: تقييم + مبيعات + سعر
function sortProducts(products, wantCheaper) {
  return products.sort((a, b) => {
    if (wantCheaper) {
      return (a.priceRaw || 99999) - (b.priceRaw || 99999);
    }
    const scoreA = (parseFloat(a.rating) || 3.5) * 20 + Math.log1p(a.reviewCount || 0) * 5;
    const scoreB = (parseFloat(b.rating) || 3.5) * 20 + Math.log1p(b.reviewCount || 0) * 5;
    return scoreB - scoreA;
  });
}

// إزالة التكرار — نقارن بالرابط/الاسم لأن الـ id قد يحتوي timestamp متغيّر
function deduplicateProducts(products) {
  const seen = new Set();
  return products.filter(p => {
    const key = p.url || p.name || p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractPrice(priceStr) {
  return parseFloat(String(priceStr).replace(/[^\d.]/g, '')) || 999999;
}

module.exports = { sortProducts, deduplicateProducts, extractPrice };
