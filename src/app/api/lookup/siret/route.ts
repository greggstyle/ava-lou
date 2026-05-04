import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { lookupBySiret, searchByName } from '@/lib/sirene';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siret = searchParams.get('siret');
  const q = searchParams.get('q');

  try {
    if (siret) {
      const result = await lookupBySiret(siret);
      if (!result) {
        return NextResponse.json({ error: 'SIRET introuvable' }, { status: 404 });
      }
      return NextResponse.json(result);
    }
    if (q) {
      const results = await searchByName(q);
      return NextResponse.json({ results });
    }
    return NextResponse.json({ error: 'Précisez ?siret= ou ?q=' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Service Sirene indisponible' }, { status: 503 });
  }
}
