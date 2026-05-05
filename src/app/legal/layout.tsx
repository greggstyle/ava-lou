import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales — AVA',
  robots: 'index,follow',
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
      {children}
    </div>
  );
}
