# AVA-Lou — Conformité légale française

V0 MVP. Pour la production réelle, consulter un expert-comptable.

## Mentions obligatoires sur facture (art. L441-9 + R441-3 du Code de commerce)

| Mention | Champ AVA | Origine |
|---|---|---|
| Date d'émission | `invoices.issue_date` | Auto |
| N° de facture séquentiel | `invoices.number` (`FAC-YYYY-NNN`) | Auto + UNIQUE `(user_id, number)` |
| Identité vendeur | `profiles.full_name` ou `company_name` | Settings |
| Adresse vendeur | `profiles.address`, `postal_code`, `city` | Settings |
| SIRET vendeur (14 chiffres) | `profiles.siret` | Settings (auto-fill via Sirene) |
| Code APE/NAF | `profiles.naf_code` | Settings (auto-fill via Sirene) |
| Forme juridique | `profiles.legal_form` | Settings |
| Capital social (société uniquement) | `profiles.capital_social` | Settings |
| RCS | `profiles.rcs` | Settings |
| TVA intracommunautaire | `profiles.vat_intra` | Settings |
| Identité acheteur | `clients.name` ou `company_name` | Fiche client |
| Adresse acheteur | `clients.address`, `postal_code`, `city` | Fiche client |
| SIRET acheteur (si pro) | `clients.siret` | Fiche client (auto-fill via Sirene) |
| TVA intra acheteur (si pro UE) | `clients.vat_intra` | Fiche client |
| Désignation produits/services | `invoices.line_items[i].label` | Voix ou form |
| Quantité, prix unitaire HT, taux TVA | `line_items[i].qty/unit_price/vat_rate` | Voix ou form |
| Total HT par taux TVA | Calculé via `LegalMentions.groupByVat` | Auto |
| Total TVA, total TTC | Calculé via `lib/format.computeTotals` | Auto |
| Date de paiement / échéance | `invoices.due_date` | Voix ou form |
| Pénalités de retard | `profiles.late_penalty_rate` (défaut 10,5 %) | Settings |
| Indemnité forfaitaire 40 € (D441-5) | `profiles.late_penalty_indemnity` (défaut 40) | Auto-affiché |
| Mention « TVA non applicable, art. 293 B du CGI » | `profiles.tva_franchise` | Settings (auto pour auto-entrepreneurs détectés via Sirene) |
| Médiateur conso (B2C, art. L612-1) | `profiles.b2c_mediator` | Settings — affiché si `client.is_business=false` |

Toutes ces mentions sont rendues dans `<LegalMentions />` sur la fiche détail facture, et incluses dans le corps du `mailto:` "Envoyer par email".

## Mentions obligatoires sur devis

Identique au-dessus, plus :
- **Date de validité** : `quotes.expiry_date` (au lieu d'échéance)
- **Mention « Devis gratuit »** : affichée systématiquement par `<LegalMentions kind="devis">`
- **Espace « Bon pour accord »** : affiché en bas du bloc légal devis pour signature client manuelle

## Ce qui est conforme V0

- ✅ Numérotation séquentielle sans rupture (UNIQUE constraint en migration 0003)
- ✅ Mentions vendeur + acheteur affichées sur tous les devis/factures
- ✅ Calcul total HT par taux TVA (groupBy)
- ✅ Mention 293 B CGI auto pour auto-entrepreneurs (détectés Sirene)
- ✅ Pénalités retard + indemnité 40 € (D441-5)
- ✅ Médiateur conso B2C
- ✅ Devis : date validité + Bon pour accord

## Ce qui n'est PAS encore couvert (V1+)

- ❌ **PDF** — la facture est rendue en HTML uniquement. PDF Puppeteer ou @react-pdf/renderer en V1.
- ❌ **Tampon entreprise / signature** — pas de zone tampon ni signature électronique (Yousign/DocuSign en V2).
- ❌ **Facture électronique 2026/2027 obligatoire** (factur-X / Plateforme Agréée).
  - Mandate progressive depuis le **1er septembre 2026** pour grandes entreprises, **1er septembre 2027** pour PME et TPE.
  - AVA passera par une **PA certifiée** (ex. Pennylane qui est PA), pas en auto-déclaration.
  - Source : https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises
  - Doc impots.gouv : https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/facturation-electronique---depliant-generique.pdf
- ❌ **Conservation 10 ans** — Supabase conserve les factures par défaut, mais pas de politique d'archivage formelle ni d'accès longue durée garanti.
- ❌ **Numérotation par série** — un seul compteur par utilisateur. La loi permet plusieurs séries (ex: FAC pour BTP, REF pour réfections), pas implémenté.
- ❌ **Mentions sectorielles** : assurances décennales pour BTP (art. L243-2 Code des assurances), garanties commerciales, droit de rétractation B2C, etc. Selon le secteur du client.

## Mise à jour des migrations

La migration `supabase/migrations/0003_idempotency_and_legal.sql` doit être appliquée
manuellement via le SQL Editor Supabase. Voir `MIGRATIONS-TODO.md`.

## Disclaimer

Cette implémentation est un MVP. La conformité totale dépend du contexte sectoriel
(BTP, restauration, services à la personne…) et juridique (auto-entrepreneur,
SARL, SAS) du vendeur. **Consultez un expert-comptable** avant utilisation en
production sur des factures réelles avec impact fiscal.
