import { Html, Head, Main, NextScript } from 'next/document'

const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme')||'dark';var r=document.documentElement;if(t==='dark')r.classList.add('dark');else r.classList.remove('dark');}catch(e){}})();"

export default function Document() {
  return (
    <Html lang="ar" dir="rtl" className="dark">
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Nutri" />
        <meta name="theme-color" content="#081c44" />
        <meta name="application-name" content="Nutri" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
