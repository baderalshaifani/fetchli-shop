# Fetchli — منصة مقارنة الأسعار (تسوق + سفر)

ريبو واحد موحّد يخدم خدمتي Render: التسوق والسفر.

## الهيكل

```
fetchli-shop/
├── server.js                  ← راوتر خفيف (يركّب الوحدات + الملفات الثابتة)
├── config.js                  ← كل الإعدادات والمفاتيح (من env)
├── shared/
│   ├── claude.js              ← استدعاء Claude API
│   ├── location.js            ← تحديد الدولة (ip-api → ipwho → ipapi)
│   └── adminStore.js          ← حفظ إعدادات لوحة التحكم في Supabase
├── modules/
│   ├── shopping/              ← analyze, search (Amazon/AliExpress), smart-chat, sync, stores
│   └── travel/                ← analyze, search (رحلات/فنادق/سيارات/نقل), suggest
└── public/
    ├── index.html             ← يحمّل app.js فقط
    ├── app.js                 ← الواجهة الموحّدة (i18n + مدونة + محادثة ذكية)
    ├── style.css
    ├── admin.html             ← لوحة التحكم (الرابط: /admin.html — بدون الامتداد يرجع 404)
    └── verify-admitad.txt
```

## التشغيل محلياً

```bash
npm install
cp _env .env        # أعد تسمية ملف المفاتيح إلى .env بالضبط (gitignore يغطي الاسمين)
node server.js
```

## متغيرات البيئة على Render

| المتغير | الوصف |
|---|---|
| `CLAUDE_API_KEY` | مفتاح Anthropic |
| `RAINFOREST_API_KEY` | بحث Amazon |
| `ALIEXPRESS_APP_KEY` / `APP_SECRET` / `ACCESS_TOKEN` / `TRACKING_ID` | AliExpress Affiliate |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | قاعدة البيانات |
| `OPENAI_API_KEY` | embeddings للبحث الدلالي |
| `GOOGLE_VISION_KEY` | تحليل الصور |
| `SYNC_SECRET` | حماية `/api/sync` و `/api/aliexpress/callback` (إجباري — بدونه المساران مقفلان) |
| `ADMIN_PASSWORD` | **جديد** — حماية حفظ المتاجر والمحتوى من لوحة التحكم |
| `TRAVELPAYOUTS_TOKEN` / `TRAVELPAYOUTS_MARKER` | السفر |
| `HOTEL_DEEPLINK_TEMPLATE` | **جديد** — رابط الفنادق (Hotellook توقفت). ضع deeplink الشريك من لوحة Travelpayouts مع المتغيرات `{destination}` `{checkIn}` `{checkOut}` `{adults}` |
| `ENABLE_SHOPPING` / `ENABLE_TRAVEL` | اختياري — `false` لتعطيل وحدة في خدمة معينة |

## جدول Supabase الجديد (لإعدادات لوحة التحكم)

شغّل هذا في SQL Editor مرة واحدة:

```sql
create table if not exists app_config (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);
```

يخزّن: `stores` (مصادر البحث)، `content_tips`، `content_blog`، `content_deals`.
القراءة عامة عبر `/api/admin/content`، والكتابة محمية بـ `ADMIN_PASSWORD`
(لوحة التحكم ترسلها في الهيدر `x-admin-token` أو `x-admin-password`).

## النشر على Render (خدمتان، ريبو واحد)

1. **fetchli-shop-final** (التسوق — الدومين fetchli.shop): `node server.js` مع كل المتغيرات.
2. **fetchli-shop** (السفر — fetchli-shop.onrender.com): نفس الأمر؛ يكفي متغيرات السفر + `CLAUDE_API_KEY`.
   اختيارياً أضف `ENABLE_SHOPPING=false` لها لعزلها تماماً.

الواجهة لا تتغير: التسوق على نفس الأصل، والسفر على `TRAVEL_API` في `app.js`.

⚠️ بما أن الريبو موحّد، أي push يعيد نشر الخدمتين معاً. لو تريد عزلاً كاملاً
في النشر استخدم فرعين (branch لكل خدمة) أو فعّل "Manual Deploy" لخدمة السفر.

## قواعد ثابتة (لا تُكسر)

- **Amazon لا يُلمس عند إصلاح AliExpress** — ملفان منفصلان عمداً.
- **روابط الأفلييت تضاف وقت العرض لا وقت التخزين**.
- **استعلامات AliExpress ≤ 3 كلمات** وإلا خطأ 405.
- **لا HTTP داخلي بين endpoints على Render** — استدعاء الدوال مباشرة.
- **لا نتائج وهمية أبداً** — حالة فارغة مع اقتراحات.
