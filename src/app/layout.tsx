import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";
import { getMessages, translate } from "@/lib/i18n/messages";
import { getImpersonationState } from "@/lib/auth";

export const metadata: Metadata = {
  title: "GastroMap - Gestor Gastronómico",
  description: "App privada para guardar, descubrir y decidir sitios donde comer",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GastroMap",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, impersonation] = await Promise.all([
    getLocale(),
    getImpersonationState(),
  ]);
  const messages = getMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var saved = localStorage.getItem('gastromap_theme');
                var isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col overflow-x-hidden transition-colors duration-200">
        <I18nProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <ToastProvider>
              {impersonation && (
                <ImpersonationBanner
                  bannerText={translate(messages, "impersonation.banner_text", {
                    user: impersonation.targetUsername
                      ? `${impersonation.targetName} (@${impersonation.targetUsername})`
                      : impersonation.targetName,
                  })}
                  stopLabel={translate(messages, "impersonation.stop_btn")}
                />
              )}
              {children}
            </ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
