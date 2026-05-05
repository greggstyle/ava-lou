import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { LegalMentions } from '@/components/legal-mentions';
import { C, SANS, SERIF } from '@/components/ava';
import { formatPriceFR, formatDateFR } from '@/lib/format';
import type { Client, Invoice, Profile } from '@/lib/types';
import { PrintButton } from '@/components/print-button';
import { ShareButton } from '@/components/share-button';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VoirFacturePage({ params }: PageProps) {
  const { id } = await params;
  // Public view: bypass RLS using admin client. UUIDs are unguessable.
  const supabase = createAdminClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(id, name, email, phone, company_name, siret, vat_intra, address, postal_code, city, is_business)')
    .eq('id', id)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', invoice.user_id)
    .maybeSingle();

  // Need the absolute public URL so WhatsApp share works correctly
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'ava-lou.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const publicUrl = `${proto}://${host}/voir/facture/${id}`;
  const clientObj = invoice.clients as { name?: string | null; phone?: string | null } | null;
  const clientPhone = (invoice as Invoice & { clients?: { phone?: string | null } | null }).clients?.phone ?? null;

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
            documentNumber={invoice.number ?? null}
            amount={Number(invoice.amount_ttc)}
            kind="facture"
            clientName={clientObj?.name ?? null}
            clientPhone={clientPhone}
          />
          <PrintButton pdfHref={`/api/factures/${id}/pdf?public=1`} />
        </span>
      </header>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ font: `400 36px/1.1 ${SERIF}`, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
          Facture <em style={{ fontStyle: 'italic', color: C.green }}>{invoice.number ?? 'Brouillon'}</em>
        </h1>
        <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted, marginTop: 6 }}>
          Émise le {formatDateFR(invoice.issue_date)}
          {invoice.due_date && ` · Échéance ${formatDateFR(invoice.due_date)}`}
        </div>
        <div style={{ marginTop: 14, font: `600 28px/1 ${SERIF}`, color: C.ink }}>
          Total TTC : {formatPriceFR(Number(invoice.amount_ttc))}
        </div>
      </div>

      <LegalMentions
        profile={profile as Partial<Profile> | null}
        client={invoice.clients as Partial<Client> | null}
        doc={invoice as Invoice}
        kind="facture"
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
