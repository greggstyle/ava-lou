import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Export ICS d'un rendez-vous unique → Apple Calendar / Google Calendar /
 * Outlook le reconnaissent immédiatement quand l'artisan ouvre le fichier.
 *
 * Format ICS minimal mais complet : SUMMARY, DESCRIPTION, LOCATION,
 * DTSTART, DTEND (par défaut +1h si pas d'ends_at), UID stable, ORGANIZER.
 *
 * Auth-gated par RLS — l'artisan ne peut télécharger que ses propres RDV.
 */

function escapeIcs(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/** Date → "20260506T093000Z" (UTC) */
function toIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    'T',
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds()),
    'Z',
  ].join('');
}

/** Découpe la propriété en lignes ≤ 75 octets (norme RFC 5545). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const slice = line.slice(i, i + 75);
    parts.push(i === 0 ? slice : ' ' + slice);
    i += 75;
  }
  return parts.join('\r\n');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: apt, error } = await supabase
    .from('appointments')
    .select('id, title, starts_at, ends_at, location, notes, clients(name, phone)')
    .eq('id', id)
    .maybeSingle();
  if (error || !apt) return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle();
  const organizer = profile?.company_name || profile?.full_name || 'AVA';

  const start = new Date(apt.starts_at);
  const end = apt.ends_at ? new Date(apt.ends_at) : new Date(start.getTime() + 60 * 60 * 1000);
  const now = new Date();
  const client = Array.isArray(apt.clients) ? apt.clients[0] : apt.clients;

  // Build description : client + phone + notes
  const descParts: string[] = [];
  if (client?.name) descParts.push(`Client : ${client.name}`);
  if (client?.phone) descParts.push(`Téléphone : ${client.phone}`);
  if (apt.notes) descParts.push(apt.notes);
  descParts.push('—');
  descParts.push('Programmé via AVA');
  const description = descParts.join('\n');

  // Stable UID built from row id + production domain
  const uid = `${apt.id}@ava-lou.vercel.app`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AVA-Lou//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    fold(`UID:${uid}`),
    fold(`DTSTAMP:${toIcsDate(now)}`),
    fold(`DTSTART:${toIcsDate(start)}`),
    fold(`DTEND:${toIcsDate(end)}`),
    fold(`SUMMARY:${escapeIcs(apt.title)}`),
    fold(`DESCRIPTION:${escapeIcs(description)}`),
    apt.location ? fold(`LOCATION:${escapeIcs(apt.location)}`) : '',
    fold(`ORGANIZER;CN=${escapeIcs(organizer)}:mailto:noreply@ava-lou.vercel.app`),
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  const ics = lines.join('\r\n') + '\r\n';
  const safeTitle = (apt.title || 'rendez-vous').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
  const filename = `RDV-${safeTitle}.ics`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
