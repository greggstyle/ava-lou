import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Document — AVA',
  description: 'Document partagé via AVA',
  robots: 'noindex,nofollow',
};

export default function VoirLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          @page { margin: 18mm; size: A4; }
          html, body { background: white !important; }
          .ava-print-hide { display: none !important; }
          .ava-print-page { max-width: 100% !important; margin: 0 !important; }
        }
        .ava-print-page { max-width: 720px; margin: 24px auto; padding: 0 16px 60px; }
      `}</style>
      {children}
    </>
  );
}
