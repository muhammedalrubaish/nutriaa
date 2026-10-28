# Nutri — نظام إدارة التغذية

<div dir="rtl">

نظام طلبات وجبات المرضى والمرافقين لقسم التغذية (تجمع القصيم الصحي). مبني على Next.js 14 (Pages Router) و React 18 و Tailwind، وقاعدة البيانات **Supabase Postgres**.

## ⚙️ الإعداد المحلي

1. `npm install`
2. انسخ `.env.example` إلى `.env.local` واملأ القيم (انظر الجدول أدناه).
3. نفّذ ملفات `db/migrations/*.sql` بالترتيب (إما بلصقها في **Supabase → SQL Editor**، أو بالأمر `npm run db:migrate`).
4. أنشئ أول مشرف: ضع `ADMIN_USERNAME` و `ADMIN_PASSWORD` في `.env.local` ثم `npm run db:create-admin` (لا توجد أي كلمة مرور في المستودع).
5. `npm run dev` ثم افتح http://localhost:3000

## 🗄️ إعداد Supabase

1. أنشئ مشروعاً جديداً في Supabase.
2. **SQL Editor**: الصق وشغّل الملفات بالترتيب: `001_schema.sql` ← `002_seed_departments.sql` ← `003_seed_menu.sql` (كل ملف أقل من 20 KB فيمكن لصقه من الجوال).
3. **Project Settings → Database → Connection string → Transaction pooler** (المنفذ 6543): انسخ الرابط، واستبدل `[YOUR-PASSWORD]` بكلمة مرور قاعدة البيانات، وضعه في `DATABASE_URL`.
4. التطبيق يتصل بقاعدة البيانات من الخادم فقط (مسارات API)، ولا يستخدم مفتاح `anon` ولا Supabase Auth. كل الجداول مفعّل عليها RLS بدون أي سياسات، فلا يمكن قراءة شيء عبر واجهة Supabase العامة.

## 🔐 متغيرات البيئة

| المتغير | الوصف |
|---|---|
| `DATABASE_URL` | رابط Supabase (Transaction pooler) — إلزامي |
| `SESSION_SECRET` | سلسلة عشوائية طويلة (16 حرفاً على الأقل) لتوقيع ملف الجلسة — إلزامي |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | إشعارات الجوال (اختياري؛ تُولَّد بـ `npx web-push generate-vapid-keys`). بدونها يختفي زر الإشعارات بهدوء |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME` | تُستخدم محلياً فقط مع `npm run db:create-admin` |

## 🚀 النشر على Vercel

1. استورد المستودع في Vercel (الإطار: Next.js، بدون إعدادات بناء خاصة).
2. **Settings → Environment Variables**: أضف `DATABASE_URL` و `SESSION_SECRET` (ومفاتيح VAPID إن أردت الإشعارات).
3. انشر. شغّل ملفات SQL مرة واحدة في Supabase قبل أول دخول، ثم أنشئ المشرف محلياً بالأمر أعلاه.

## 🧪 الأوامر

- `npm run build` — بناء الإنتاج
- `npm test` — اختبارات vitest (قاعدة بيانات وهمية)
- `npm run db:migrate` — تطبيق ملفات الترحيل غير المطبّقة (يتتبعها في جدول `schema_migrations`)
- `npm run db:create-admin` — إنشاء/إعادة تعيين مشرف من متغيرات البيئة

</div>

---

## English

Hospital meal-ordering app (Arabic, RTL) rebuilt from the production site. Stack: Next.js 14 Pages Router, React 18, Tailwind 3, framer-motion, lucide-react, Cairo font, Supabase Postgres via `pg`.

### Setup
1. `npm install`, copy `.env.example` → `.env.local` and fill it in.
2. Apply `db/migrations/*.sql` in order — paste each into **Supabase → SQL Editor**, or run `npm run db:migrate`.
3. Create the first supervisor: set `ADMIN_USERNAME` / `ADMIN_PASSWORD` and run `npm run db:create-admin`. No credentials are stored in the repo.
4. `npm run dev`.

### Supabase
- Use **Project Settings → Database → Connection string → Transaction pooler** (port 6543) as `DATABASE_URL`, with your database password filled in.
- The app talks to Postgres only from API routes, keeps its own signed-cookie login (no Supabase Auth, no anon key), and every table has RLS enabled with no policies, so the public API exposes nothing.

### Environment variables
`DATABASE_URL` (required), `SESSION_SECRET` (required, ≥16 chars), `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (optional web push; the UI hides the push toggle when missing), `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NAME` (only for the create-admin script).

### Deploy on Vercel
Import the repo (framework preset: Next.js), add `DATABASE_URL` and `SESSION_SECRET` (plus VAPID keys if wanted) under **Settings → Environment Variables**, and deploy. Run the SQL migrations in Supabase once beforehand.

### Scripts
`npm run build`, `npm test`, `npm run db:migrate`, `npm run db:create-admin`.
