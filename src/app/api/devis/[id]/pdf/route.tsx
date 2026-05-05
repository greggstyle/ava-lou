import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { InvoicePDF } from '@/lib/pdf/invoice-pdf';
import type { Quote, Client, Profile } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const isPublic = url.searchParams.get('public') === '1';

  let quote: (Quote & { clients: Partial<Client> | null }) | null = null;
  let profile: Partial<Profile> | null = null;

  if (isPublic) {
    const admin = createAdminClient();
    const { data: qData } = await admin
      .from('quotes')
      .select('*, clients(id, name, email, company_name, siret, vat_intra, address, postal_code, city, is_business)')
      .eq('id', id)
      .maybeSingle();
    if (!qData) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    quote = qData as Quote & { clients: Partial<Client> | null };
    const { data: prof } = await admin
      .from('profiles')
      .select('*')
      .eq('id', quote.user_id)
      .maybeSingle();
    profile = prof as Partial<Profile> | null;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const { data: qData } = await supabase
      .from('quotes')
      .select('*, clients(id, name, email, company_name, siret, vat_intra, address, postal_code, city, is_business)')
      .eq('id', id)
      .maybeSingle();
    if (!qData) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    quote = qData as Quote & { clients: Partial<Client> | null };
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
        doc={quote}
        client={quote.clients ?? null}
        profile={profile}
        kind="devis"
      />,
    );
    const filename = `Devis-${quote.number ?? 'brouillon'}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (err) {
    console.error('[quote pdf] render error', err);
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF.' }, { status: 500 });
  }
}
