import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";

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
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = getMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
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
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col transition-colors duration-200">
        <I18nProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
