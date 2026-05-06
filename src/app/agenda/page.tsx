import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaButton, AvaLabel, AvaPill, C, SANS, SERIF } from '@/components/ava';

export const dynamic = 'force-dynamic';

interface AppointmentRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  client_id: string | null;
  clients: { name: string } | { name: string }[] | null;
}

function pickClientName(c: AppointmentRow['clients']): string | null {
  if (!c) return null;
  if (Array.isArray(c)) return c[0]?.name ?? null;
  return c.name ?? null;
}

function formatDay(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function groupByDay(appointments: AppointmentRow[]): Map<string, AppointmentRow[]> {
  const map = new Map<string, AppointmentRow[]>();
  for (const a of appointments) {
    const d = new Date(a.starts_at);
    const key = d.toISOString().slice(0, 10);
    const existing = map.get(key) ?? [];
    existing.push(a);
    map.set(key, existing);
  }
  return map;
}

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const startWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000); // include yesterday for context

  const { data } = await supabase
    .from('appointments')
    .select('id, title, starts_at, ends_at, location, notes, status, client_id, clients(name)')
    .gte('starts_at', startWindow.toISOString())
    .order('starts_at', { ascending: true })
    .limit(100);
  const appointments = (data ?? []) as unknown as AppointmentRow[];

  const grouped = groupByDay(appointments);
  const sortedDays = Array.from(grouped.keys()).sort();

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Agenda" />

      <div style={{ padding: '8px 20px 60px', flex: 1 }}>
        <h1 style={{ font: `600 26px/1.15 ${SERIF}`, color: C.ink, marginTop: 6 }}>
          Vos <em style={{ fontStyle: 'italic' }}>rendez-vous</em>
        </h1>

        {appointments.length === 0 ? (
          <AvaCard padding={20} style={{ marginTop: 20 }}>
            <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted, marginBottom: 12 }}>
              Aucun rendez-vous planifié. Utilisez le micro et dites par exemple :
            </div>
            <div style={{ font: `400 14px/1.5 ${SERIF}`, color: C.ink, fontStyle: 'italic' }}>
              « RDV chantier Marie vendredi 14 heures, 4 rue des Lilas »
            </div>
          </AvaCard>
        ) : (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {sortedDays.map((day) => {
              const items = grouped.get(day)!;
              const d = new Date(day);
              const isToday = day === todayIso;
              const isPast = day < todayIso;
              return (
                <div key={day}>
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8,
                  }}>
                    <span style={{
                      font: `600 11px/1 ${SANS}`,
                      textTransform: 'uppercase', letterSpacing: 1.2,
                      color: isToday ? C.green : isPast ? C.muted : C.ink2,
                    }}>
                      {isToday ? "Aujourd'hui" : formatDay(d)}
                    </span>
                    {isToday && <span style={{ width: 4, height: 4, borderRadius: 2, background: C.green }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map((a) => {
                      const start = new Date(a.starts_at);
                      const clientName = pickClientName(a.clients);
                      return (
                        <AvaCard key={a.id} padding={14} style={{
                          opacity: isPast ? 0.6 : 1,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ font: `600 13px/1 ${SANS}`, color: C.ink, ...{ fontVariantNumeric: 'tabular-nums' } }}>
                                {formatTime(start)}
                              </div>
                              <div style={{ font: `500 16px/1.3 ${SANS}`, color: C.ink, marginTop: 4 }}>
                                {a.title}
                              </div>
                              {clientName && (
                                <div style={{ font: `400 13px/1.3 ${SANS}`, color: C.muted, marginTop: 2 }}>
                                  {clientName}
                                </div>
                              )}
                              {a.location && (
                                <div style={{ font: `400 12px/1.4 ${SANS}`, color: C.muted, marginTop: 4 }}>
                                  {a.location}
                                </div>
                              )}
                            </div>
                            <AvaPill kind={a.status === 'effectué' ? 'success' : a.status === 'annulé' ? 'warn' : 'neutral'} style={{ padding: '2px 8px', fontSize: 10 }}>
                              {a.status}
                            </AvaPill>
                          </div>
                          {!isPast && a.status !== 'annulé' && (
                            <div style={{ marginTop: 10 }}>
                              <a
                                href={`/api/agenda/${a.id}/ics`}
                                download
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  padding: '6px 10px', borderRadius: 8,
                                  background: C.soft, border: `1px solid ${C.line}`,
                                  font: `500 12px/1 ${SANS}`, color: C.ink2,
                                  textDecoration: 'none',
                                }}
                              >
                                Ajouter à mon agenda
                              </a>
                            </div>
                          )}
                        </AvaCard>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/agenda/nouveau" style={{ textDecoration: 'none' }}>
            <AvaButton kind="primary" full>Nouveau RDV</AvaButton>
          </Link>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <AvaButton kind="light" full>Retour à l&apos;accueil</AvaButton>
          </Link>
        </div>
      </div>
    </main>
  );
}
