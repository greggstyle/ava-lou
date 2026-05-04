import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaButton, C, SERIF, SANS, TNUM } from '@/components/ava';
import { formatPriceFR } from '@/lib/format';
import { SuccessRedirect } from '@/components/success-redirect';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function SuccessPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { type } = await searchParams;
  const docType = type === 'devis' ? 'devis' : type === 'client' ? 'client' : 'facture';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let title = '';
  let amountStr: string | null = null;
  let backHref = '/';

  if (docType === 'facture') {
    const { data: inv } = await supabase
      .from('invoices')
      .select('number, amount_ttc')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!inv) notFound();
    title = `Facture ${inv.number ?? ''} créée.`;
    amountStr = formatPriceFR(Number(inv.amount_ttc));
    backHref = `/factures/${id}`;
  } else if (docType === 'devis') {
    const { data: q } = await supabase
      .from('quotes')
      .select('number, amount_ttc')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!q) notFound();
    title = `Devis ${q.number ?? ''} créé.`;
    amountStr = formatPriceFR(Number(q.amount_ttc));
    backHref = `/devis/${id}`;
  } else {
    const { data: c } = await supabase
      .from('clients')
      .select('name')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!c) notFound();
    title = `Client ${c.name} ajouté.`;
    backHref = `/clients/${id}`;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: C.bone,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        gap: 24,
      }}
    >
      <SuccessRedirect />

      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: C.greenSoft,
          color: C.green,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
        <div style={{ font: `400 26px/1.25 ${SERIF}`, color: C.ink, letterSpacing: '-0.01em' }}>
          {title}
        </div>
        {amountStr && (
          <div style={{ font: `500 18px/1 ${SANS}`, color: C.ink2, ...TNUM }}>{amountStr}</div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', marginTop: 8 }}>
        <Link href={backHref} style={{ textDecoration: 'none' }}>
          <AvaButton kind="primary">
            {docType === 'facture' ? 'Voir la facture' : docType === 'devis' ? 'Voir le devis' : 'Voir le client'}
          </AvaButton>
        </Link>
        <Link
          href="/"
          style={{ font: `500 13px/1 ${SANS}`, color: C.muted, textDecoration: 'underline' }}
        >
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
