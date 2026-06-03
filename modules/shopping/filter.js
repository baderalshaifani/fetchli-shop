// ===================================
// fetchli.shop — فلترة نتائج التسوق
// ===================================
// Claude يرتب المنتجات حسب الدقة أو السعر

const { callClaude } = require('../../shared/claude');

/**
 * يرتب المنتجات بـ Claude حسب مدى تطابقها مع طلب المستخدم
 * @param {Array}   products         — قائمة المنتجات من البحث
 * @param {object}  originalAnalysis — نتيجة تحليل Claude الأولي
 * @param {boolean} wantCheaper      — هل يريد الأرخص؟
 * @returns {Array} المنتجات مرتبة
 */
async function filterProducts(products, originalAnalysis, wantCheaper) {
  if (!products?.length) return [];

  try {
    const text = await callClaude({
      system: 'You are a shopping filter. Respond with JSON only: { "rankedIndices": [0,1,2,3] }',
      messages: [{
        role:    'user',
        content: `خبير تسوق. العميل يبحث عن:
النوع: ${originalAnalysis.productType}
الماركة: ${originalAnalysis.brand || 'أي ماركة'}
اللون: ${originalAnalysis.color || 'أي لون'}
${wantCheaper ? 'يريد: الأرخص مع التشابه' : ''}

النتائج المتاحة:
${products.map((p, i) => `${i}: ${p.name} - ${p.price}`).join('\n')}

رتّب أفضل 4 حسب ${wantCheaper ? 'السعر الأرخص' : 'الدقة في التطابق'}.
JSON فقط: { "rankedIndices": [0,1,2,3] }`,
      }],
      maxTokens: 200,
    });

    const clean  = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const ranked = parsed.rankedIndices?.map(i => products[i]).filter(Boolean);

    return ranked?.length ? ranked : products;

  } catch (err) {
    console.error('Filter error:', err.message);
    return products; // fallback: إرجاع الكل بدون ترتيب
  }
}

module.exports = { filterProducts };
