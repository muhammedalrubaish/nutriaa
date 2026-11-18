import Head from 'next/head'
import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { APP_SUBTITLE, APP_TITLE, COPYRIGHT } from '@/lib/constants'

// «عن النظام»: what the system is, the intellectual-property note and the fixed copyright line.
// Public (no sign-in needed) so it can be linked from the login page and every footer.
export default function About() {
  return (
    <div className="min-h-screen app-bg" dir="rtl">
      <Head>
        <title>عن النظام | {APP_TITLE}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header className="sticky top-0 z-30 bg-gradient-to-l from-navy to-navy-700 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/qhc-logo.jpeg" alt="تجمع القصيم الصحي" className="h-9 w-9 rounded-lg object-cover shrink-0 bg-white" />
            <div className="leading-tight min-w-0">
              <p className="text-[13px] sm:text-sm font-extrabold break-words">{APP_TITLE}</p>
              <p className="text-[10px] text-sky-200 truncate">{APP_SUBTITLE}</p>
            </div>
          </div>
          <div className="[&_button]:text-sky-100">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-8 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-sky-600/15 text-sky-500 rounded-xl flex items-center justify-center">
              <Info size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">عن النظام</h2>
              <p className="text-sm muted">نظام إدارة طلبات وجبات المرضى والمرافقين</p>
            </div>
          </div>
          <Link href="/" className="card-2 rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-1.5">
            <ArrowRight size={16} /> رجوع
          </Link>
        </div>
        <section className="card rounded-3xl p-5 space-y-2 leading-7">
          <h3 className="font-bold text-lg">ما هو النظام؟</h3>
          <p>
            النظام يساعد قسم خدمات التغذية على إدخال طلبات وجبات المرضى والمرافقين، وطباعة بطاقات الوجبات، ومتابعة
            المؤشرات والتقارير وقائمة الوجبات الأسبوعية، مع تحديث لحظي وإشعارات للفريق.
          </p>
        </section>
        <section className="card rounded-3xl p-5 space-y-2 leading-7">
          <h3 className="font-bold text-lg">الملكية الفكرية</h3>
          <p>
            النظام — فكرةً وتصميماً وبرمجةً وهويةً — عمل فكري أصيل من تصميم وتطوير <b>عبدالله الربيش، أخصائي تغذية</b>،
            وجميع حقوق الملكية الفكرية فيه محفوظة له.
          </p>
          <p>
            استخدام النظام داخل قسم خدمات التغذية لا ينقل ملكيته ولا يمنح أي جهة حق نسخه أو تعديله أو إعادة توزيعه أو بناء
            أعمال مشتقة منه دون إذن خطي مسبق من المالك.
          </p>
          <p>البيانات التشغيلية المدخلة (الطلبات والأقسام والقوائم) تخص جهة العمل وتُعامل بسرية، ولا تُستخدم خارج غرض النظام.</p>
        </section>
        <section className="card rounded-3xl p-5 space-y-2">
          <h3 className="font-bold text-lg">الحقوق</h3>
          <p>{COPYRIGHT}</p>
        </section>
      </main>
    </div>
  )
}
