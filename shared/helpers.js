// ===================================
// fetchli.shop — دوال مشتركة
// ===================================
// تُستخدم من أي موديول (تسوق، سفر، إلخ)

/**
 * إزالة التكرار من قائمة المنتجات حسب الـ id
 */
function deduplicateProducts(products) {
  const seen = new Set();
  return products.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/**
 * استخراج الرقم من نص السعر مثل "299 ر.س" → 299
 */
function extractPrice(priceStr) {
  return parseFloat(String(priceStr).replace(/[^\d.]/g, '')) || 999999;
}

/**
 * تحويل قيم RGB إلى اسم لون مقروء
 */
function rgbToColorName(r, g, b) {
  if (r > 200 && g > 200 && b > 200) return 'white';
  if (r < 50  && g < 50  && b < 50 ) return 'black';
  if (r > 150 && g < 100 && b < 100) return 'red';
  if (r < 100 && g < 100 && b > 150) return 'blue';
  if (r < 100 && g > 150 && b < 100) return 'green';
  if (r > 150 && g > 150 && b < 100) return 'yellow';
  if (r > 150 && g > 100 && b < 80 ) return 'orange';
  if (r > 120 && g < 80  && b > 120) return 'purple';
  if (r > 150 && g > 100 && b > 150) return 'pink';
  if (r > 100 && g > 80  && b < 60 ) return 'brown';
  if (r > 150 && g > 150 && b > 150) return 'gray';
  if (r < 30  && g < 50  && b > 80 ) return 'navy';
  return `rgb(${r},${g},${b})`;
}

module.exports = { deduplicateProducts, extractPrice, rgbToColorName };
