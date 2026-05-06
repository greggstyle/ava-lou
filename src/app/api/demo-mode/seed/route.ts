import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeTotals } from '@/lib/format';
import { insertWithNumbering } from '@/lib/numbering';
import type { LineItem } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Seed démo — peuple le compte avec un jeu cohérent de données fictives
 * (clients DROM Réunion, factures mix de statuts, devis, dépenses, RDV).
 *
 * Objectif produit : éviter la page vide aux nouveaux utilisateurs
 * (Lou et les bêta-testeurs) qui veulent se faire une idée de l'app sans
 * saisir 30 minutes de contenu.
 *
 * Garde-fou : refuse si l'utilisateur a déjà ≥ 3 clients en base.
 * On force à passer par /wipe avant pour éviter les doublons.
 *
 * Auth requise (RLS sur toutes les tables).
 */

// Helper : décale une date de N jours par rapport à aujourd'hui.
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Garde-fou : refuse si données existantes (seuil ≥ 3 clients)
  const { count: existingClients, error: countErr } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true });

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 400 });
  }
  if ((existingClients ?? 0) >= 3) {
    return NextResponse.json(
      { error: 'Vous avez déjà des données. Supprimez-les avant de charger la démo.' },
      { status: 409 },
    );
  }

  // ── 1. Clients (5 réunionnais cohérents) ───────────────────────────────
  const clientsPayload = [
    {
      user_id: user.id,
      name: 'M. Payet',
      email: 'jpayet@example.re',
      phone: '+262 692 11 22 33',
      address: '12 rue des Flamboyants',
      postal_code: '97400',
      city: 'Saint-Denis',
      is_business: false,
      notes: 'Maison individuelle, accès portail à droite.',
    },
    {
      user_id: user.id,
      name: 'Mme Hoarau',
      email: 'mhoarau@example.re',
      phone: '+262 693 44 55 66',
      address: '8 chemin Bois Joli',
      postal_code: '97410',
      city: 'Saint-Pierre',
      is_business: false,
      notes: null,
    },
    {
      user_id: user.id,
      name: 'M. Técher',
      email: null,
      phone: '+262 692 78 90 12',
      address: '45 allée des Goyaviers',
      postal_code: '97430',
      city: 'Le Tampon',
      is_business: false,
      notes: 'Préfère être appelé en fin de journée.',
    },
    {
      user_id: user.id,
      name: 'Mme Grondin',
      email: 'sgrondin@example.re',
      phone: '+262 692 33 44 55',
      address: '3 impasse des Filaos',
      postal_code: '97460',
      city: 'Saint-Paul',
      is_business: false,
      notes: null,
    },
    {
      user_id: user.id,
      name: 'SARL TropicBat',
      email: 'contact@tropicbat.example.re',
      phone: '+262 262 99 11 22',
      address: 'ZA des Tamarins, lot 14',
      postal_code: '97420',
      city: 'Le Port',
      is_business: true,
      company_name: 'TropicBat',
      siret: '90123456700015',
      notes: 'Sous-traitance chantier neuf.',
    },
  ];

  const { data: insertedClients, error: clientsErr } = await supabase
    .from('clients')
    .insert(clientsPayload)
    .select('id, name');

  if (clientsErr || !insertedClients) {
    return NextResponse.json({ error: clientsErr?.message ?? 'clients insert failed' }, { status: 400 });
  }

  // Index par nom pour rattacher les docs aux bons clients.
  const cByName = new Map(insertedClients.map((c) => [c.name, c.id]));
  const cId = (n: string) => cByName.get(n) ?? null;

  // ── 2. Factures (8, mix payée / envoyée / en_retard, 200-2500 €) ────────
  // Structure : on construit le payload, computeTotals calcule HT/TVA/TTC,
  // insertWithNumbering gère la numérotation atomique (race-safe).
  const today = new Date();
  const currentYear = today.getFullYear();

  type InvoiceSpec = {
    client: string;
    issue_offset: number; // jours dans le passé
    due_offset: number; // jours par rapport à issue_date
    status: 'payée' | 'envoyée' | 'en_retard';
    lines: LineItem[];
    notes?: string;
  };

  const invoiceSpecs: InvoiceSpec[] = [
    {
      client: 'M. Payet',
      issue_offset: 85,
      due_offset: 30,
      status: 'payée',
      lines: [
        { label: "Main d'œuvre plomberie", qty: 4, unit_price: 55, vat_rate: 8.5 },
        { label: 'Remplacement mitigeur cuisine', qty: 1, unit_price: 89, vat_rate: 8.5 },
      ],
    },
    {
      client: 'Mme Hoarau',
      issue_offset: 70,
      due_offset: 30,
      status: 'payée',
      lines: [
        { label: 'Pose chauffe-eau 200L', qty: 1, unit_price: 720, vat_rate: 8.5 },
        { label: "Main d'œuvre plomberie", qty: 6, unit_price: 55, vat_rate: 8.5 },
      ],
    },
    {
      client: 'M. Técher',
      issue_offset: 55,
      due_offset: 30,
      status: 'payée',
      lines: [
        { label: 'Remplacement disjoncteur différentiel', qty: 1, unit_price: 145, vat_rate: 8.5 },
        { label: "Main d'œuvre électricité", qty: 2, unit_price: 60, vat_rate: 8.5 },
      ],
    },
    {
      client: 'SARL TropicBat',
      issue_offset: 42,
      due_offset: 45,
      status: 'payée',
      lines: [
        { label: 'Tableau électrique 3 rangées équipé', qty: 1, unit_price: 980, vat_rate: 8.5 },
        { label: 'Câblage tableau + raccordement', qty: 8, unit_price: 65, vat_rate: 8.5 },
        { label: "Déplacement chantier Le Port", qty: 2, unit_price: 45, vat_rate: 8.5 },
      ],
      notes: 'Chantier maison Le Port — lot 14.',
    },
    {
      client: 'Mme Grondin',
      issue_offset: 28,
      due_offset: 30,
      status: 'envoyée',
      lines: [
        { label: 'Recherche de fuite', qty: 1, unit_price: 180, vat_rate: 8.5 },
        { label: "Réparation canalisation enterrée", qty: 1, unit_price: 320, vat_rate: 8.5 },
      ],
    },
    {
      client: 'M. Payet',
      issue_offset: 18,
      due_offset: 30,
      status: 'envoyée',
      lines: [
        { label: 'Pose prise extérieure étanche', qty: 2, unit_price: 75, vat_rate: 8.5 },
        { label: "Main d'œuvre électricité", qty: 1.5, unit_price: 60, vat_rate: 8.5 },
      ],
    },
    // Deux factures en retard (issue + due dépassés)
    {
      client: 'M. Técher',
      issue_offset: 60,
      due_offset: 30,
      status: 'en_retard',
      lines: [
        { label: 'Dépannage chauffe-eau', qty: 1, unit_price: 220, vat_rate: 8.5 },
      ],
    },
    {
      client: 'SARL TropicBat',
      issue_offset: 75,
      due_offset: 45,
      status: 'en_retard',
      lines: [
        { label: 'Câblage VMC double flux', qty: 1, unit_price: 1450, vat_rate: 8.5 },
        { label: "Main d'œuvre électricité", qty: 12, unit_price: 65, vat_rate: 8.5 },
        { label: 'Petit matériel et fournitures', qty: 1, unit_price: 180, vat_rate: 8.5 },
      ],
      notes: 'Chantier rénovation — relance envoyée.',
    },
  ];

  let invoicesCreated = 0;
  for (const spec of invoiceSpecs) {
    const issueDate = daysAgo(spec.issue_offset);
    const dueDate = daysAgo(spec.issue_offset - spec.due_offset);
    const totals = computeTotals(spec.lines);

    const { data, error } = await insertWithNumbering<{ id: string }>({
      supabase,
      table: 'invoices',
      prefix: 'FAC',
      userId: user.id,
      year: new Date(issueDate).getFullYear() || currentYear,
      payloadWithoutNumber: {
        user_id: user.id,
        client_id: cId(spec.client),
        status: spec.status,
        issue_date: issueDate,
        due_date: dueDate,
        vat_rate: 8.5,
        amount_ht: totals.amount_ht,
        amount_vat: totals.amount_vat,
        amount_ttc: totals.amount_ttc,
        line_items: spec.lines,
        notes: spec.notes ?? null,
      },
    });

    if (error || !data) {
      return NextResponse.json(
        { error: `invoice insert failed: ${error?.message ?? 'unknown'}` },
        { status: 400 },
      );
    }
    invoicesCreated++;
  }

  // ── 3. Devis (3 : 1 accepté, 1 envoyé, 1 expiré) ──────────────────────
  type QuoteSpec = {
    client: string;
    issue_offset: number;
    expiry_offset: number; // jours après issue_date
    status: 'accepté' | 'envoyé' | 'expiré';
    lines: LineItem[];
    notes?: string;
  };

  const quoteSpecs: QuoteSpec[] = [
    {
      client: 'Mme Hoarau',
      issue_offset: 25,
      expiry_offset: 30,
      status: 'accepté',
      lines: [
        { label: 'Rénovation salle de bains complète', qty: 1, unit_price: 2400, vat_rate: 8.5 },
        { label: "Main d'œuvre plomberie", qty: 16, unit_price: 55, vat_rate: 8.5 },
      ],
      notes: 'Devis accepté — chantier prévu mi-mois prochain.',
    },
    {
      client: 'SARL TropicBat',
      issue_offset: 7,
      expiry_offset: 30,
      status: 'envoyé',
      lines: [
        { label: 'Mise aux normes tableau électrique', qty: 1, unit_price: 850, vat_rate: 8.5 },
        { label: 'Pose disjoncteurs différentiels', qty: 4, unit_price: 145, vat_rate: 8.5 },
        { label: "Main d'œuvre électricité", qty: 6, unit_price: 65, vat_rate: 8.5 },
      ],
    },
    {
      client: 'M. Técher',
      issue_offset: 65,
      expiry_offset: 30, // expiré (issue il y a 65 j, validité 30 j)
      status: 'expiré',
      lines: [
        { label: 'Installation prises extérieures', qty: 4, unit_price: 95, vat_rate: 8.5 },
        { label: "Main d'œuvre électricité", qty: 3, unit_price: 60, vat_rate: 8.5 },
      ],
    },
  ];

  let quotesCreated = 0;
  for (const spec of quoteSpecs) {
    const issueDate = daysAgo(spec.issue_offset);
    const expiryDate = daysAgo(spec.issue_offset - spec.expiry_offset);
    const totals = computeTotals(spec.lines);

    const { data, error } = await insertWithNumbering<{ id: string }>({
      supabase,
      table: 'quotes',
      prefix: 'DEV',
      userId: user.id,
      year: new Date(issueDate).getFullYear() || currentYear,
      payloadWithoutNumber: {
        user_id: user.id,
        client_id: cId(spec.client),
        status: spec.status,
        issue_date: issueDate,
        expiry_date: expiryDate,
        vat_rate: 8.5,
        amount_ht: totals.amount_ht,
        amount_vat: totals.amount_vat,
        amount_ttc: totals.amount_ttc,
        line_items: spec.lines,
        notes: spec.notes ?? null,
      },
    });

    if (error || !data) {
      return NextResponse.json(
        { error: `quote insert failed: ${error?.message ?? 'unknown'}` },
        { status: 400 },
      );
    }
    quotesCreated++;
  }

  // ── 4. Dépenses (6 : Point P, Leroy Merlin, restau, péage…) ────────────
  const expensesPayload = [
    {
      user_id: user.id,
      label: 'Cuivre + raccords',
      vendor: 'Point P',
      amount_ttc: 245.6,
      amount_ht: 226.36,
      vat_rate: 8.5,
      category: 'matériel',
      expense_date: daysAgo(80),
      notes: 'Chantier Mme Hoarau.',
    },
    {
      user_id: user.id,
      label: 'Outillage électroportatif',
      vendor: 'Leroy Merlin',
      amount_ttc: 189.9,
      amount_ht: null,
      vat_rate: null,
      category: 'outillage',
      expense_date: daysAgo(62),
      notes: null,
    },
    {
      user_id: user.id,
      label: 'Repas chantier',
      vendor: 'Snack du Port',
      amount_ttc: 18.5,
      amount_ht: null,
      vat_rate: null,
      category: 'restauration',
      expense_date: daysAgo(45),
      notes: null,
    },
    {
      user_id: user.id,
      label: 'Péage Saint-Paul',
      vendor: 'Route des Tamarins',
      amount_ttc: 7.4,
      amount_ht: null,
      vat_rate: null,
      category: 'déplacement',
      expense_date: daysAgo(30),
      notes: null,
    },
    {
      user_id: user.id,
      label: 'Tableau électrique + disjoncteurs',
      vendor: 'Point P',
      amount_ttc: 1124.0,
      amount_ht: 1035.94,
      vat_rate: 8.5,
      category: 'matériel',
      expense_date: daysAgo(15),
      notes: 'Chantier TropicBat.',
    },
    {
      user_id: user.id,
      label: 'Carburant utilitaire',
      vendor: 'Total Saint-Denis',
      amount_ttc: 82.3,
      amount_ht: null,
      vat_rate: null,
      category: 'déplacement',
      expense_date: daysAgo(4),
      notes: null,
    },
  ];

  const { error: expErr } = await supabase.from('expenses').insert(expensesPayload);
  if (expErr) return NextResponse.json({ error: expErr.message }, { status: 400 });

  // ── 5. Rendez-vous (2 à venir) ─────────────────────────────────────────
  const appointmentsPayload = [
    {
      user_id: user.id,
      client_id: cId('Mme Hoarau'),
      title: 'Démarrage chantier salle de bains',
      starts_at: daysFromNow(3),
      ends_at: null,
      location: '8 chemin Bois Joli, 97410 Saint-Pierre',
      notes: 'Apporter le mitigeur thermostatique commandé.',
      status: 'planifié',
    },
    {
      user_id: user.id,
      client_id: cId('SARL TropicBat'),
      title: 'Visite chantier mise aux normes',
      starts_at: daysFromNow(7),
      ends_at: null,
      location: 'ZA des Tamarins, lot 14',
      notes: null,
      status: 'planifié',
    },
  ];

  const { error: apptErr } = await supabase.from('appointments').insert(appointmentsPayload);
  if (apptErr) return NextResponse.json({ error: apptErr.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    created: {
      clients: insertedClients.length,
      invoices: invoicesCreated,
      quotes: quotesCreated,
      expenses: expensesPayload.length,
      appointments: appointmentsPayload.length,
    },
  });
}
