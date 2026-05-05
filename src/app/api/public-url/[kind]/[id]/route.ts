import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { signPublicId } from '@/lib/public-url';

/**
 * Returns a signed token for a public document URL.
 *
 * Auth: the requester must own the document (RLS does the check). Without
 * this we'd be willing to sign any UUID anyone hands us, defeating the point.
 *
 * Used by:
 *   - factures/[id] page (mailto + share dialogs)
 *   - devis/[id] page
 *   - any client-side place that needs a forwardable public URL
 *
 * Response: { token: "abc123…" } or 404 if the user doesn't own the row.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  if (kind !== 'facture' && kind !== 'devis') {
    return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // RLS check: only owner sees the row, so a successful select == ownership confirmed
  const table = kind === 'facture' ? 'invoices' : 'quotes';
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const token = signPublicId(kind, id);
  return NextResponse.json({ token, kind, id });
}
