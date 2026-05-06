import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaLabel, AvaButton, C, SANS, SERIF } from '@/components/ava';

export const dynamic = 'force-dynamic';

interface VoiceExample {
  intent: string;
  label: string;
  examples: string[];
  description: string;
}

const VOICE_INTENTS: VoiceExample[] = [
  {
    intent: 'create_invoice',
    label: 'Créer une facture',
    examples: [
      'Facture pour Monsieur Payet, 3 heures de plomberie à 55 €',
      'Facture forfait 1 500 € pour Madame Grondin',
      'Facture Mme Hoarau, 25 m² de carrelage à 45 € plus déplacement 80 €',
    ],
    description: 'AVA prépare un brouillon de facture conforme aux mentions légales (L441-9). Multi-prestations supportées avec « plus », « et », « ainsi que ».',
  },
  {
    intent: 'create_quote',
    label: 'Créer un devis',
    examples: [
      'Devis pour M. Técher, fourniture chaudière 1 200 €',
      'Devis Mme Hoarau remplacement chaudière 1 800 €',
    ],
    description: 'Brouillon de devis avec validité 30 jours, ligne « Bon pour accord » signable par le client.',
  },
  {
    intent: 'mark_paid',
    label: 'Marquer une facture comme payée',
    examples: [
      'Monsieur Payet a payé la facture',
      'Mme Hoarau a réglé',
      'Encaissé par M. Técher',
    ],
    description: 'AVA trouve la facture en attente de ce client et la passe en statut payée.',
  },
  {
    intent: 'send_payment_link',
    label: 'Envoyer un lien de paiement',
    examples: [
      'Envoie le lien de paiement à M. Payet',
      'Lien Stripe pour Mme Hoarau',
    ],
    description: 'Email pré-rempli avec le lien public de la facture + votre lien de paiement Stripe/SumUp si configuré dans Paramètres.',
  },
  {
    intent: 'send_reminder',
    label: 'Relancer un client',
    examples: [
      'Relance Mme Hoarau',
      'Rappel à Monsieur Payet',
    ],
    description: 'Email pré-rempli avec un message poli listant les factures en attente du client.',
  },
  {
    intent: 'create_expense_note',
    label: 'Enregistrer une dépense',
    examples: [
      'J\'ai acheté du carrelage chez Point P pour 340 €',
      'Plein d\'essence 75 €',
      'Restaurant chantier 28 € au Rougail',
    ],
    description: 'Note de frais directe. Pour les tickets : photographiez plutôt sur la page Dépenses, AVA lit tout en 3 secondes.',
  },
  {
    intent: 'schedule_appointment',
    label: 'Programmer un rendez-vous',
    examples: [
      'RDV chez M. Payet vendredi à 14 heures',
      'Rendez-vous Mme Grondin lundi prochain 9 h, durée 2 heures',
      'Visite chantier Saint-Denis demain 16 h',
    ],
    description: 'AVA reconnaît les dates en français : demain, lundi prochain, vendredi en huit, etc.',
  },
  {
    intent: 'get_financial_status',
    label: 'Consulter votre trésorerie',
    examples: [
      'Qu\'est-ce qui rentre cette semaine ?',
      'Mes impayés',
      'Combien j\'ai en attente ?',
    ],
    description: 'AVA résume vos factures impayées, en retard, payées du mois, et devis en attente. Lecture vocale automatique.',
  },
  {
    intent: 'get_weekly_summary',
    label: 'Résumé de la semaine',
    examples: [
      'Résume ma semaine',
      'Bilan de la semaine',
      'Comment va l\'activité',
    ],
    description: 'Encaissé, dépensé, devis envoyés, RDV. Lu à voix haute en 8 secondes.',
  },
  {
    intent: 'list_relances',
    label: 'Voir vos relances',
    examples: [
      'Mes relances',
      'Qui me doit de l\'argent',
      'Les factures à relancer',
    ],
    description: 'Ouvre la page Relances avec la liste des factures en retard et celles à échéance proche.',
  },
  {
    intent: 'get_insights',
    label: 'Conseils stratégiques d\'AVA',
    examples: [
      'Tes conseils',
      'Tes recommandations',
      'Qu\'est-ce qu\'il faut surveiller',
    ],
    description: 'AVA Conseillère analyse vos 90 derniers jours et repère ce qui mérite votre attention. Génération automatique chaque dimanche soir.',
  },
  {
    intent: 'find_document',
    label: 'Chercher un document',
    examples: [
      'Trouve la facture de M. Técher du mois dernier',
      'Cherche le devis Mme Hoarau',
    ],
    description: 'Recherche dans factures, devis, dépenses.',
  },
];

export default async function AidePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar title="Aide & commandes vocales" />

      <div style={{ padding: '8px 20px 60px', flex: 1 }}>
        <h1 style={{ font: `600 26px/1.2 ${SERIF}`, color: C.ink, marginTop: 6, letterSpacing: '-0.01em' }}>
          Que pouvez-vous dire à <em style={{ fontStyle: 'italic' }}>AVA</em> ?
        </h1>
        <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted, marginTop: 8, marginBottom: 18 }}>
          Tap le micro 🎙️ et parlez naturellement. Pas besoin de phrases magiques —
          AVA comprend le français parlé d&apos;artisan, avec abréviations, prix au choix
          et accents DROM.
        </div>

        {/* Quick start tile */}
        <AvaCard padding={16} style={{ marginBottom: 18, background: C.warmYellow, borderColor: C.line }}>
          <AvaLabel style={{ marginBottom: 6 }}>Pour commencer</AvaLabel>
          <div style={{ font: `500 16px/1.4 ${SERIF}`, color: C.ink, marginBottom: 4 }}>
            <em style={{ fontStyle: 'italic' }}>« Facture pour Monsieur Payet, 3 heures à 55 € »</em>
          </div>
          <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink2 }}>
            Tap le micro depuis n&apos;importe quel écran, dites cette phrase. Vous voyez
            le brouillon, vous validez, AVA crée la facture conforme.
          </div>
          <div style={{ marginTop: 12 }}>
            <Link href="/listen" style={{ textDecoration: 'none' }}>
              <AvaButton kind="primary">Essayer maintenant</AvaButton>
            </Link>
          </div>
        </AvaCard>

        {/* Voice intents list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {VOICE_INTENTS.map((intent) => (
            <AvaCard key={intent.intent} padding={14}>
              <div style={{ font: `600 15px/1.3 ${SANS}`, color: C.ink, marginBottom: 6 }}>
                {intent.label}
              </div>
              <div style={{ font: `400 13px/1.5 ${SANS}`, color: C.ink2, marginBottom: 10 }}>
                {intent.description}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {intent.examples.map((ex, i) => (
                  <div key={i} style={{
                    font: `400 13px/1.45 ${SERIF}`,
                    fontStyle: 'italic',
                    color: C.ink2,
                    padding: '4px 10px',
                    background: C.soft,
                    borderRadius: 6,
                  }}>
                    « {ex} »
                  </div>
                ))}
              </div>
            </AvaCard>
          ))}
        </div>

        {/* Tips */}
        <AvaCard padding={16} style={{ marginTop: 18 }}>
          <AvaLabel style={{ marginBottom: 8 }}>Astuces</AvaLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, font: `400 13px/1.5 ${SANS}`, color: C.ink2 }}>
            <div>
              <strong>Vous pouvez parler comme à une personne.</strong> AVA gère « plus », « et », « ainsi que », « ensuite » pour combiner plusieurs prestations.
            </div>
            <div>
              <strong>Les noms de clients sont mémorisés.</strong> Une fois M. Payet créé, AVA le retrouve même si vous dictez juste « Payet ».
            </div>
            <div>
              <strong>TVA DROM 8,5 % par défaut.</strong> Si vous êtes basé à La Réunion, Mayotte, Guadeloupe, Martinique ou Guyane, cochez la case dans Paramètres.
            </div>
            <div>
              <strong>Rien n&apos;est envoyé sans votre accord.</strong> Tout passe par un écran de confirmation où vous pouvez modifier avant validation.
            </div>
            <div>
              <strong>Si AVA ne comprend pas</strong>, le formulaire manuel s&apos;ouvre avec ce qu&apos;elle a quand même réussi à extraire. Vous complétez et validez.
            </div>
          </div>
        </AvaCard>

        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <Link href="/" style={{ font: `500 13px/1 ${SANS}`, color: C.muted, textDecoration: 'underline' }}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
