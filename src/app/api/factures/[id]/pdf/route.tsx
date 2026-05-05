import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { InvoicePDF } from '@/lib/pdf/invoice-pdf';
import type { Invoice, Client, Profile } from '@/lib/types';
import { verifyPublicId, publicUrlRequiresToken } from '@/lib/public-url';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Server-rendered invoice PDF.
 *
 * Two access modes:
 *  - Authenticated owner via /factures/[id]/pdf  → returns the PDF directly
 *  - Public via /voir/facture/[id]/pdf?token=…   → bypasses RLS, validates ownership through join
 *
 * For V0, the public route reads via admin client similar to /voir/...; the
 * UUID is unguessable. Real signed-URL flow (with expiry) belongs to V9.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const isPublic = url.searchParams.get('public') === '1';
  const token = url.searchParams.get('t');

  let invoice: (Invoice & { clients: Partial<Client> | null }) | null = null;
  let profile: Partial<Profile> | null = null;

  if (isPublic) {
    // Public mode — UUID + signed token. See src/lib/public-url.ts.
    const verdict = verifyPublicId('facture', id, token);
    if (verdict === 'invalid') {
      return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
    }
    if (verdict === 'missing' && publicUrlRequiresToken()) {
      return NextResponse.json({ error: 'Lien non signé' }, { status: 404 });
    }
    const admin = createAdminClient();
    const { data: invData } = await admin
      .from('invoices')
      .select('*, clients(id, name, email, company_name, siret, vat_intra, address, postal_code, city, is_business)')
      .eq('id', id)
      .maybeSingle();
    if (!invData) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    invoice = invData as Invoice & { clients: Partial<Client> | null };
    const { data: prof } = await admin
      .from('profiles')
      .select('*')
      .eq('id', invoice.user_id)
      .maybeSingle();
    profile = prof as Partial<Profile> | null;
  } else {
    // Auth mode — RLS scopes the row to the current user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const { data: invData } = await supabase
      .from('invoices')
      .select('*, clients(id, name, email, company_name, siret, vat_intra, address, postal_code, city, is_business)')
      .eq('id', id)
      .maybeSingle();
    if (!invData) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    invoice = invData as Invoice & { clients: Partial<Client> | null };
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    profile = prof as Partial<Profile> | null;
  }

  try {
    const buffer = await renderToBuffer(
      <InvoicePDF
        doc={invoice}
        client={invoice.clients ?? null}
        profile={profile}
        kind="facture"
      />,
    );
    const filename = `Facture-${invoice.number ?? 'brouillon'}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (err) {
    console.error('[invoice pdf] render error', err);
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF.' }, { status: 500 });
  }
}
