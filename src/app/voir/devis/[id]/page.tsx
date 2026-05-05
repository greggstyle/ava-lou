import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { LegalMentions } from '@/components/legal-mentions';
import { C, SANS, SERIF } from '@/components/ava';
import { formatPriceFR, formatDateFR } from '@/lib/format';
import type { Client, Profile, Quote } from '@/lib/types';
import { PrintButton } from '@/components/print-button';
import { ShareButton } from '@/components/share-button';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VoirDevisPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, clients(id, name, email, phone, company_name, siret, vat_intra, address, postal_code, city, is_business)')
    .eq('id', id)
    .maybeSingle();

  if (!quote) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', quote.user_id)
    .maybeSingle();

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'ava-lou.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const publicUrl = `${proto}://${host}/voir/devis/${id}`;
  const clientObj = quote.clients as { name?: string | null; phone?: string | null } | null;
  const clientPhone = (quote as Quote & { clients?: { phone?: string | null } | null }).clients?.phone ?? null;

  return (
    <main className="ava-print-page" style={{ background: C.bone, minHeight: '100vh' }}>
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 0', borderBottom: `1px solid ${C.line}`, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="32" height="16" viewBox="0 0 56 28" aria-hidden="true">
            <g fill={C.ink}>
              <rect x="0" y="11" width="3" height="6" rx="1.5"/>
              <rect x="6" y="7" width="3" height="14" rx="1.5"/>
              <rect x="12" y="3" width="3" height="22" rx="1.5"/>
              <rect x="18" y="0" width="3" height="28" rx="1.5"/>
              <rect x="24" y="5" width="3" height="18" rx="1.5"/>
              <rect x="30" y="9" width="3" height="10" rx="1.5"/>
              <rect x="36" y="12" width="3" height="4" rx="1.5"/>
            </g>
          </svg>
          <span style={{ font: `600 14px/1 ${SANS}`, color: C.ink, letterSpacing: 0.4 }}>
            AVA · {profile?.company_name || profile?.full_name || 'Document'}
          </span>
        </div>
        <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          <ShareButton
            publicUrl={publicUrl}
            documentNumber={quote.number ?? null}
            amount={Number(quote.amount_ttc)}
            kind="devis"
            clientName={clientObj?.name ?? null}
            clientPhone={clientPhone}
          />
          <PrintButton pdfHref={`/api/devis/${id}/pdf?public=1`} />
        </span>
      </header>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ font: `400 36px/1.1 ${SERIF}`, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
          Devis <em style={{ fontStyle: 'italic', color: C.green }}>{quote.number ?? 'Brouillon'}</em>
        </h1>
        <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted, marginTop: 6 }}>
          Émis le {formatDateFR(quote.issue_date)}
          {quote.expiry_date && ` · Validité jusqu'au ${formatDateFR(quote.expiry_date)}`}
        </div>
        <div style={{ marginTop: 14, font: `600 28px/1 ${SERIF}`, color: C.ink }}>
          Total TTC : {formatPriceFR(Number(quote.amount_ttc))}
        </div>
      </div>

      <LegalMentions
        profile={profile as Partial<Profile> | null}
        client={quote.clients as Partial<Client> | null}
        doc={quote as Quote}
        kind="devis"
      />

      <footer style={{
        marginTop: 32, paddingTop: 16, borderTop: `1px solid ${C.line}`,
        font: `400 11px/1.5 ${SANS}`, color: C.muted, textAlign: 'center',
      }}>
        Document généré via AVA · ava-lou.vercel.app
      </footer>
    </main>
  );
}
