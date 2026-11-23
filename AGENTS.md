# AGENTS.md — نيوتريا (Nutriaa)

دليل لأي وكيل ذكاء اصطناعي يشتغل على هذا المستودع. كل ما هنا مأخوذ من الكود الحالي؛ وما لم يُتحقق منه مكتوب «غير مؤكد».

## 1) المشروع
- **ما هو:** نظام طلبات وجبات المرضى والمرافقين لـ«قسم خدمات التغذية» في «مستشفى الولادة والأطفال ببريدة» (`APP_TITLE` و`APP_SUBTITLE` في `lib/constants.js`): إدخال الطلبات، طباعة بطاقات الوجبات، لوحة المؤشرات والتقارير، القائمة الأسبوعية، الملاحظات، وإشعارات الجوال (Web Push).
- **الإنتاج:** https://nutriaa.vercel.app — المستودع `muhammedalrubaish/nutriaa`.
- **الأدوار** (`lib/roles.js`، من الأعلى): `sysadmin` مدير النظام (حساب واحد فقط، فهرس فريد) ← `manager` مدير ← `supervisor` مشرف ← `specialist` أخصائية / `distributor` موظفة موزّعة (نفس الرتبة). كل مستخدم يدير فقط من هم أقل منه رتبة (`canManageUser`، ويُفرض في `/api/users`). الصلاحيات في `PERMS` (`create_orders`, `view_dashboard`, `view_reports`, `export_reports`, `delete_orders`, `manage_users`, `edit_menu`, `send_notes`).
- **التقنيات:** Next.js 15.5.28 (Pages Router) + React 18 + JavaScript (`jsconfig.json`، alias `@/`) + Tailwind 3 (`darkMode: 'class'`) + framer-motion + lucide-react + خط Cairo محلي (`public/fonts`). قاعدة Postgres على Supabase عبر `pg` من الخادم فقط. PDF: html2canvas-pro + jsPDF. Excel: exceljs. الإشعارات: web-push + `public/sw.js`.
- **هيكل المجلدات:**
  - `pages/` الشاشات (`index`, `orders`, `list`, `menu`, `departments`, `import`, `users`, `login`, `about`) و`pages/api/` (كل الوصول للقاعدة، و`api/push/*`، و`api/app-version`، و`api/version` للتحديث اللحظي).
  - `components/` (`Nav`, `Footer`, `PullToRefresh`, `notifications`, `BedMap`, `MealLibraryManager` …).
  - `lib/` المنطق المشترك (`db.js` اتصال الخادم، `session.js`، `roles.js`، `orderRules.js`، `stats.js`، `push.js`، `printView.js`، `xlsx.js` فيه `saveFile`، `time.js` بتوقيت `Asia/Riyadh`) و`lib/report/` (بطاقات وتقارير A4 وPDF).
  - `db/migrations/` ملفات SQL، `deploy/` سكربتات إطلاق/تراجع على قاعدة الإنتاج + `DEPLOY-PLAN.md`، `scripts/` (migrate, create-admin)، `tests/` (vitest).

## 2) الأوامر والنشر
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest run — قاعدة وهمية، لا تحتاج اتصال
npm run build      # next build
npm run db:migrate # ⚠️ يطبّق الترحيلات على DATABASE_URL — إن كان يشير للإنتاج فهو تعديل على القاعدة الحية
npm run db:create-admin  # ⚠️ يكتب في القاعدة (مدير النظام)
```
- **النشر:** Vercel مربوط بـ GitHub؛ أي دمج في `main` يُنشر تلقائيًا على nutriaa.vercel.app. لذلك **الدمج في main = نشر** ويحتاج موافقة عبدالله.
- **التحقق من النشر:** `GET https://nutriaa.vercel.app/api/app-version` يرجع `{ version }` = `VERCEL_GIT_COMMIT_SHA`؛ قارنه بالـcommit المدموج. التبويبات المفتوحة تعيد التحميل تلقائيًا عند تغيّره (`lib/useAppUpdate.js`).
- مشروع Vercel نفسه (الفريق/الإعدادات) غير ظاهر لنا — غير مؤكد.

## 3) قاعدة البيانات
- **Supabase:** المشروع `zzvkiqjjwqvzjhhayhrt` في منظمة NAQLA (حساب عبدالله الأول). *(المرجع من ملاحظات المشروع؛ لم يُتحقق منه بأداة Supabase في هذه الجولة.)*
- **الاتصال:** من الخادم فقط (`lib/db.js`) عبر `DATABASE_URL` (Transaction pooler، منفذ 6543). لا Supabase Auth ولا مفتاح anon؛ تسجيل الدخول بكوكي موقّعة (`SESSION_SECRET`، كلمات المرور bcrypt).
- **RLS:** مفعّل على كل الجداول **بدون أي سياسات** عمدًا (واجهة Supabase العامة لا تكشف شيئًا). لا تطفئ RLS ولا تضف سياسات للعموم.
- **الترحيلات:** `db/migrations/NNN_name.sql` بترقيم ثلاثي متسلسل (`001_schema` … `008_orders_unique_slot_no_name`)، idempotent، ويتتبعها `npm run db:migrate` في جدول `schema_migrations`. الإطلاق على الإنتاج تم بملفات `deploy/*.sql` في Supabase SQL Editor (انظر `deploy/DEPLOY-PLAN.md`).
- **الجداول الرئيسية:** `users`, `departments`, `menu`, `orders`, `meal_library`, `notes`, `note_recipients`, `note_reads`, `push_subscriptions`, `settings` (منها المفتاح `menu_changes` لآخر 20 تعديل على القائمة).
- **قيود مهمة:** `orders.meal_date` عمود مولَّد (أقرب تاريخ بتوقيت الرياض يوافق `day`)؛ منع التكرار بـ`orders_unique_slot` (005) و`orders_unique_bed_slot` (008: نفس السرير والوجبة باسم آخر = تكرار من 2026-11-19). التطبيق يطبّق نفس القاعدة قبل الحفظ.

## 4) متغيرات البيئة (أسماء فقط)
`DATABASE_URL`, `SESSION_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME` (للسكربت المحلي فقط)، و`VERCEL_GIT_COMMIT_SHA` / `NEXT_PUBLIC_APP_VERSION` (رقم النسخة). القالب في `.env.example`.
`VAPID_SUBJECT` يجب أن يكون `mailto:` أو `https:` (آبل ترفض غير ذلك؛ القيمة غير الصالحة تُستبدل برابط التطبيق في `lib/push.js`).
**لا تطبع ولا ترفع** `.env` أو `.env.local` أو أي ملف حسابات/أسرار، ولا تكتب أي قيمة في الكود أو الـPR.

## 5) قواعد عبدالله الثابتة
- **اللغة والخط:** عربي RTL (`<Html lang="ar" dir="rtl">` في `pages/_document.js`)، خط Cairo.
- **الألوان:** الكحلي `#081c44` (`navy` في `tailwind.config.js`، و`theme-color`) والسماوي `#0284c7` / `#0ea5e9` (فئات `emerald-*` مربوطة بلوحة `sky` عمدًا؛ `green-*` محجوز للوجبات الرئيسية). وضع فاتح وداكن (`ThemeToggle`، الافتراضي داكن).
- **العنوان والفوتر و«عن النظام»** — انسخ الصيغة كما هي ولا تعدّلها:
  - `APP_TITLE = 'قسم خدمات التغذية'`, `APP_SUBTITLE = 'مستشفى الولادة والأطفال ببريدة'`.
  - `COPYRIGHT = '© 2026 جميع الحقوق محفوظة — تصميم وتطوير عبدالله الربيش، أخصائي تغذية'`.
  - الفوتر (`components/Footer.js`): سطر الحقوق ثم رابط «عن النظام»، مثبّت أسفل الشاشة في كل الصفحات وهو آخر شيء على الشاشة، وشريط التبويبات فوقه مباشرة (اختبار `tests/fixedFooter.test.js`).
  - صفحة `/about` (`pages/about.js`، عامة بدون دخول): «ما هو النظام؟» ← «الملكية الفكرية» ← «الحقوق».
- **الملكية:** النظام ملك عبدالله الربيش (أخصائي تغذية) وليس المستشفى؛ البيانات التشغيلية فقط تخص جهة العمل.
- **الطباعة:** A4 وبنفس الشكل من الجوال، ولا ينقسم أي صف أو بطاقة بين صفحتين (`break-inside: avoid` / `page-break-inside: avoid`، وتوزيع الجداول بالقياس `lib/report/measure.js` / `packTables`). مقاس ورقة الطباعة الأساسي 192×242mm (`PRINT_SHEET` في `lib/report/doc.js`) ليناسب منطقة طباعة سفاري على الآيفون.
- **بطاقات الوجبات** (`lib/report/cards.js`، الاختبارات في `tests/cards.test.js`): 8 بطاقات أفقية في كل صفحة A4 (4 صفوف × 2)، صفحات من 8 بطاقات حتى لا تنقسم بطاقة (سفاري يتجاهل `break-inside` على عناصر الـgrid). الترتيب: القسم ثم الغرفة ثم السرير. نوع الوجبة من `order.mealType` (`main` / `optional` / `custom`؛ النوع غير المعروف يُعامل كأساسية). البطاقة لا تُظهر من أدخل الطلب ولا التاريخ/الوقت، وتطبع النوع `PATIENT` / `MORAFEQ`. صُممت للتمييز على طابعة أبيض وأسود، **ولا تُغيَّر ألوان البطاقة** (رأس الأساسية `#15803d`، الاختيارية `#0284c7`، المخصصة `#7c3aed`).
  - الوجبة الأساسية فقط: 20 خطاً مائلاً رفيعاً (`#777`، سُمك 0.4mm) داخل SVG ثابت 80×4.5mm في المساحة البيضاء تحت صندوق الوجبة (وتحت الملاحظة إن وُجدت) وفوق التذييل، في وسط العرض، مع `print-color-adjust: exact`. إذا ضاق المكان يُنقَص ارتفاع الكتلة (حتى 3mm) لا عدد الخطوط. الاختيارية والمخصصة بدون خطوط.
  - تسميات النوع («الوجبة الأساسية»، «الوجبة الاختيارية»، «وجبة مخصصة») بخط عريض 11pt في حبة الرأس والتسمية الصغيرة فوق نص الوجبة؛ الملاحظات بخط عريض 12.5pt.
  - النص لا يُقصّ أبدًا (الحساسية مثلاً يجب ألا تضيع): النص الطويل يلتف، ثم يُصغَّر جسم البطاقة (`--s` عبر `cardScale` ثم `fitCards` بعد تحميل الخط) حتى يدخل في المقاس الثابت. لا `ellipsis` ولا `line-clamp`.
- **لا صفحة ولا تبويب جديد في الطباعة والتصدير:** عرض A4 داخل نفس الصفحة (`lib/printView.js`) و`window.print`؛ PDF/Excel كـBlob عبر `saveFile` (`navigator.share({ files })` مع بديل تنزيل). ممنوع `window.open` و`target="_blank"`.
- **لا نشر ولا تعديل على القاعدة الحية بدون موافقة عبدالله الصريحة.**
- **قواعد خاصة بنيوتريا:**
  - الوجبات المخصصة (`meal_type = 'custom'`) تُستبعد من ترتيب الوجبات والنسب والمقارنات، وتبقى في الإجماليات (`tests/customMealsExcluded.test.js`).
  - الجرسان في الهيدر مقصودان: واحد لقائمة التنبيهات، والثاني لتفعيل/إيقاف إشعارات الجوال. لا تدمجهما.
  - تعديل القائمة يرسل تنبيه جرس (أسبوع) وإشعار جوال لمن يُدخل الطلبات عدا من عدّلها؛ ومرسل الملاحظة لا يصله إشعارها.
  - كل التواريخ و«اليوم» بتوقيت `Asia/Riyadh` (`lib/time.js`).

## 6) طريقة العمل
- اشتغل على فرع جديد وPR؛ شغّل `npm test` و`npm run build` قبل أي PR، وأضف اختبارًا لأي قاعدة جديدة.
- لا تدمج PRs **#5 و#6 و#8** (قرار عبدالله) — اتركها كما هي.
- لا تشغّل `db:migrate` أو ملفات `deploy/*.sql` على الإنتاج، ولا تدمج في `main`، إلا بعد موافقة عبدالله.
- لا تلمس مشروع `nutriaa-meals` (منفصل).
