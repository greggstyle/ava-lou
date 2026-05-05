import type { Metadata, Viewport } from 'next';
import './globals.css';
import { MicFab } from '@/components/mic-fab';
import { ServiceWorkerRegistrar } from '@/components/sw-registrar';

export const metadata: Metadata = {
  title: 'AVA — Assistance Vocale Administrative',
  description: "L'OS administratif des indépendants. Voice-first invoicing pour artisans des DROM.",
  manifest: '/manifest.json',
  applicationName: 'AVA',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AVA',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // pinch-zoom allowed (WCAG 1.4.4) — the artisan in bright sun needs to zoom prices
  themeColor: '#F4F3EE',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          maxWidth: 480,
          marginLeft: 'auto',
          marginRight: 'auto',
          background: 'var(--bg-app)',
          color: 'var(--fg-1)',
          font: 'var(--t-body)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {children}
        <MicFab />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
