import { AvaCard, C, SANS, SERIF } from '@/components/ava';
import { formatPriceFR } from '@/lib/format';

interface SmartGreetingProps {
  greeting: string;
  invoicesPending: { count: number; total: number };
  invoicesOverdue: { count: number; total: number };
  paidThisWeek: { count: number; total: number };
  pendingQuotes: number;
  upcomingAppointmentsToday: number;
}

/**
 * Contextual one-liner under the home page hero — what should Lou know right
 * now? Picks the most relevant phrase based on time of day + recent activity.
 *
 * No Claude/LLM call : deterministic rules so the home loads in <100ms and
 * we don't burn budget on a UX micro-detail. The rules below are tuned for
 * the artisan workflow:
 *   - Morning : focus sur ce qui rentre (factures payées hier, RDV du jour)
 *   - Midi   : ce qui pourrait coincer (devis qui dorment)
 *   - Après-midi : pousser la fin de semaine
 *   - Soir   : bilan + ce qui attend demain
 *   - Week-end : ton plus léger, prépare lundi
 *
 * Si rien d'intéressant à dire, tombe sur un message neutre + tip.
 */
export function SmartGreeting({
  greeting,
  invoicesPending,
  invoicesOverdue,
  paidThisWeek,
  pendingQuotes,
  upcomingAppointmentsToday,
}: SmartGreetingProps) {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = dim, 6 = sam

  // Derive time-of-day salutation
  let salutation: string;
  if (hour < 6) salutation = 'Tôt ce matin';
  else if (hour < 11) salutation = 'Bonne matinée';
  else if (hour < 14) salutation = 'Bonjour';
  else if (hour < 18) salutation = 'Bel après-midi';
  else if (hour < 22) salutation = 'Bonne soirée';
  else salutation = 'Belle nuit';

  // Pick the most relevant fact to surface
  const lines: { kind: 'urgent' | 'good' | 'neutral'; text: string }[] = [];

  if (invoicesOverdue.count > 0) {
    lines.push({
      kind: 'urgent',
      text: `${invoicesOverdue.count} facture${invoicesOverdue.count > 1 ? 's' : ''} en retard, ${formatPriceFR(invoicesOverdue.total)} à relancer.`,
    });
  }

  if (upcomingAppointmentsToday > 0 && hour < 19) {
    lines.push({
      kind: 'neutral',
      text: `${upcomingAppointmentsToday} rendez-vous prévu${upcomingAppointmentsToday > 1 ? 's' : ''} aujourd'hui.`,
    });
  }

  if (paidThisWeek.count > 0) {
    lines.push({
      kind: 'good',
      text: `Cette semaine : ${formatPriceFR(paidThisWeek.total)} encaissé${paidThisWeek.count > 1 ? 's' : ''} sur ${paidThisWeek.count} facture${paidThisWeek.count > 1 ? 's' : ''}.`,
    });
  }

  if (pendingQuotes > 0 && (hour >= 14 || dayOfWeek === 5)) {
    // Push devis suivi en fin d'après-midi ou vendredi
    lines.push({
      kind: 'neutral',
      text: `${pendingQuotes} devis envoyé${pendingQuotes > 1 ? 's' : ''} en attente de retour.`,
    });
  }

  if (invoicesPending.count > 0 && lines.length === 0) {
    lines.push({
      kind: 'neutral',
      text: `${invoicesPending.count} facture${invoicesPending.count > 1 ? 's' : ''} envoyée${invoicesPending.count > 1 ? 's' : ''} en attente de paiement, total ${formatPriceFR(invoicesPending.total)}.`,
    });
  }

  // Weekend tone
  if ((dayOfWeek === 0 || dayOfWeek === 6) && lines.length === 0) {
    lines.push({
      kind: 'neutral',
      text: dayOfWeek === 6
        ? 'Bon samedi. Lundi : pré-déclaration TVA disponible dans Comptabilité.'
        : 'Bon dimanche. Lundi matin, AVA vous prépare le récap de la semaine.',
    });
  }

  // Fallback
  if (lines.length === 0) {
    lines.push({ kind: 'neutral', text: 'Tout est à jour. Belle journée.' });
  }

  // Pick top 1 (urgent first, then good, then neutral)
  const order = { urgent: 0, good: 1, neutral: 2 };
  lines.sort((a, b) => order[a.kind] - order[b.kind]);
  const top = lines[0];

  const accent = top.kind === 'urgent' ? C.warn : top.kind === 'good' ? C.green : C.muted;

  return (
    <AvaCard padding={14} style={{ marginTop: 12, background: C.paper, border: `1px solid ${C.line}` }}>
      <div style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>
        {salutation}, {greeting}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 6, height: 6, marginTop: 8, borderRadius: 3, background: accent, flexShrink: 0 }} />
        <div style={{ font: `500 15px/1.45 ${SERIF}`, color: C.ink, flex: 1 }}>
          {top.text}
        </div>
      </div>
    </AvaCard>
  );
}
