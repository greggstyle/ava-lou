# 🌅 Briefing matinal — AVA-Lou V6+

**Production en ligne** : https://ava-lou.vercel.app
**Native iOS + Android** : `ios/` + `android/` projets prêts (cf NATIVE.md)
**Repo** : https://github.com/greggstyle/ava-lou
**CI** : GitHub Actions sur push/PR (lint + build)

---

## ⚡ Statut

22 commits poussés, **9 versions livrées** (V0 → V6+). Production stable.

| Version | Highlights |
|---|---|
| **V0** | Auth magic link + CRUD complet + flux vocal Whisper+Claude |
| **V0.5** | Fix loop "Réessayer" + escape hatch |
| **V0.7** | Mentions légales L441-9 + SIRET data.gouv + Capacitor iOS+Android |
| **V1** | Page publique `/voir` + timeouts/zod/blob preserve |
| **V2** | 6 voice intents (mark_paid, financial_status, send_reminder, list, find, send_doc) |
| **V3** | Dashboard intelligence + `/historique` + dictation tips |
| **V3.5** | Notifications proactives Vercel cron + PWA install hint |
| **V4** | schedule_appointment + `/agenda` + iOS publishing tooling + privacy/CGU |
| **V5** | Search bars + filters + French date parser ("demain", "lundi prochain") |
| **V6+** | create_expense_note + `/depenses` + bilan mensuel net (recettes − dépenses) |

---

## 👉 ACTIONS À FAIRE AU RÉVEIL (15 min)

### 1️⃣ Supabase URL Configuration
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/auth/url-configuration
- Site URL = `https://ava-lou.vercel.app`
- Redirect URLs = `https://ava-lou.vercel.app/auth/callback`, `https://ava-lou.vercel.app/**`

### 2️⃣ Email templates Onde
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/auth/templates
- Magic Link : sujet `Votre lien de connexion AVA` + corps `supabase/email-templates/magic-link.html`
- Confirm signup : sujet `Confirmez votre inscription AVA` + corps `supabase/email-templates/confirm-signup.html`

### 3️⃣ Migrations Supabase (4 à appliquer)
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/sql/new

Coller chaque fichier successivement, **Run** :
1. `supabase/migrations/0003_idempotency_and_legal.sql` — atomic claim + UNIQUE + champs légaux
2. `supabase/migrations/0004_notifications.sql` — table notifications (cron lundi 7h30)
3. `supabase/migrations/0005_appointments.sql` — table appointments (RDV vocaux)
4. `supabase/migrations/0006_expenses.sql` — table expenses (notes de frais vocales)

### 4️⃣ Apple — agreements à signer (BLOQUANT TestFlight)
https://appstoreconnect.apple.com/business/

Vous avez :
- ✅ Compte Apple Developer
- ✅ Clé API `MDAFVFXY36` + Issuer `30126512-688b-43ce-8a2a-ba559b976f70` validés (JWT signé OK)
- ❌ **Conventions à signer** : Apple bloque toutes les API tant qu'agreements pas à jour

→ https://appstoreconnect.apple.com/business/ — signer les conventions en attente. Pour app gratuite, seul le Developer Program License Agreement est obligatoire (pas besoin de Banking).

Une fois signé, dites-moi "ok" → je relance `node scripts/asc-test.mjs` puis on enchaîne archive + upload TestFlight via `./scripts/ios-archive-and-upload.sh`.

---

## 📋 Récap — 10 voice intents

| Intent | Mots-clés | Action |
|---|---|---|
| `create_invoice` | "facture pour…" | Drafte + confirm + INSERT |
| `create_quote` | "devis…" | Drafte + confirm + INSERT |
| `mark_paid` | "a payé", "réglé" | Trouve + confirm + status payée |
| `send_reminder` | "relance" | Drafte email FR poli + mailto |
| `get_financial_status` | "qu'est-ce qui rentre" | 4 KPI cards live |
| `get_invoice_list` | "mes factures" | Route vers /factures |
| `find_document` | "trouve…" | Liste résultats cliquables |
| `send_document` | "envoie…" | Preview + Ouvrir et envoyer |
| `schedule_appointment` | "RDV vendredi 14h…" | Parse date + heure + lieu + INSERT |
| `create_expense_note` | "j'ai acheté chez Point P…" | Parse vendor + amount + catégorie + INSERT |

## Tables Supabase (7) + migrations (5)

- `profiles` (V0 + champs légaux V0.7)
- `clients` (V0 + is_business+SIRET V0.7)
- `invoices` + `quotes` (V0 + UNIQUE numbering V0.7)
- `ava_actions` (V0 + status executing V0.7)
- `notifications` (V3.5)
- `appointments` (V4)
- `expenses` (V6)

## Pages

- `/` Home : greeting + notifications + RDV à venir + suggestions + récents + 6 raccourcis
- `/listen` Voice capture avec exemples + countdown 25s
- `/confirm/[id]` 9 layouts différents selon intent
- `/dashboard` Trésorerie + delta mensuel + **bilan net** + top retards + activité
- `/factures` + `/factures/nouvelle` + `/factures/[id]` (recherche + filtres + LegalMentions)
- `/devis` + `/devis/nouveau` + `/devis/[id]` (recherche + convert→facture)
- `/clients` + `/clients/nouveau` + `/clients/[id]` (recherche + SIRET autocomplete)
- `/agenda` + `/agenda/nouveau`
- **`/depenses`** + **`/depenses/nouvelle`** (catégories colorées + total mensuel)
- `/historique` 100 dernières actions vocales
- `/parametres` profil + informations légales + déconnexion
- `/voir/facture/[id]` + `/voir/devis/[id]` (PUBLIC, imprimable)
- `/legal/privacy` + `/legal/cgu` (PUBLIC, App Store ready)
- `/test-voice` debug Claude (auth-gated)

## API routes

`/api/transcribe` · `/api/intent` · `/api/actions/[id]` (PATCH/DELETE) · `/api/actions/[id]/confirm` (dispatch 5 intents) · `/api/clients[/[id]]` · `/api/factures[/[id]]` · `/api/devis[/[id]/convert]` · `/api/appointments[/[id]]` · **`/api/expenses[/[id]]`** · `/api/lookup/siret` · `/api/notifications/[id]` · `/api/cron/weekly`

## Tooling iOS publishing

- ✅ `scripts/asc-test.mjs` — JWT validé Apple répond 200 sur les agreements (en attente signature)
- ✅ `scripts/ios-archive-and-upload.sh` — full xcodebuild archive + export + upload
- ✅ `scripts/exportOptions.plist` — app-store + auto signing
- ✅ `.appstore/.env` — credentials configurés
- ⏳ Bundle ID `fr.digidatale.ava` à enregistrer après signature des agreements
- ⏳ App à créer dans App Store Connect (UI manuelle après agreements)

---

## 🧪 Plan de test (60 min)

### Voice flow (15 min)
1. Login + magic link → home avec 3 clients seedés
2. « Facture pour M. Payet, 3 heures à 55 € » → confirm → "Confirmer et créer"
3. **Idempotency** : double-tap rapide → une seule facture
4. « M. Payet a payé »
5. « Qu'est-ce qui rentre cette semaine ? »
6. « Relance Mme Hoarau »
7. « Trouve la facture de M. Payet »
8. « Envoie le devis à Mme Hoarau »
9. « RDV vendredi 14h chez M. Payet » → /agenda
10. **« J'ai acheté du matériel chez Point P pour 340 € »** → /depenses (V6 nouveau !)

### Pages (15 min)
11. Dashboard → bilan mensuel net (recettes - dépenses)
12. /factures → recherche + filtres status pills
13. /devis → idem
14. /clients → recherche par nom/email/téléphone
15. /agenda → groupé par jour
16. /depenses → catégories colorées + total mensuel
17. /historique → 100 dernières actions
18. /test-voice → debug Claude

### Documents (10 min)
19. Facture → "Voir / Imprimer (PDF)" → `/voir/facture/[id]` → Cmd+P / Imprimer iPhone
20. "Envoyer par email" → Mail.app prêt avec lien partageable + corps + mentions légales
21. Devis → Convertir en facture (due_date auto)

### Native iOS (10 min, Apple ID gratuit)
22. `pnpm cap:open:ios` → Xcode → simulateur iPhone 15
23. Connecter votre iPhone → Signing avec Apple ID gratuit → Cmd+R

### TestFlight (10 min, après signature agreements)
24. Signer agreements sur https://appstoreconnect.apple.com/business/
25. Dire "ok" en chat → je relance asc-test.mjs
26. Si visible → enregistrer bundle ID + créer app → `./scripts/ios-archive-and-upload.sh`
27. App Store Connect → TestFlight → Internal Testing → ajouter testeurs

---

## 📊 Stats finales nuit + matinée

- **22 commits** : V0 → V6+ + docs + iOS tooling + CI
- **~75 fichiers source** créés/modifiés
- **7 tables Supabase**, 6 migrations dont 5 à appliquer manuellement
- **10 voice intents** opérationnels
- **17 routes web** + **15 routes API**
- **2 plateformes natives** (iOS + Android Capacitor)
- **GitHub Actions CI** sur push/PR
- **App Store Connect API** configurée (en attente agreements)

## 🐛 Connus / non-bloquants

- **PDF** : print depuis `/voir/...` (Cmd+P / iPhone Imprimer)
- **Push web** : pas implémenté
- **Service worker offline** : pas implémenté
- **Audio retention** : sans ZDR config OpenAI = 30j
- **`tutoiement` toggle** : DB-only
- **Google Calendar sync** : pas implémenté

## 🔁 V7+ ideas

- PDF serveur via `@react-pdf/renderer`
- Gmail OAuth pour envoi automatique
- Service worker + offline shell
- Web push notifications
- Sync Google Calendar
- Pennylane API integration (factur-X 2026/2027)
- Niveau 3 Conseiller (CdC §1.2) — Claude génère des conseils stratégiques

---

## 🚀 Commandes utiles

```bash
cd ~/Dev/ava-lou

pnpm dev                           # Dev local localhost:3000
pnpm build                         # Vérifier que ça compile
pnpm cap:open:ios                  # Ouvrir le projet iOS dans Xcode
pnpm cap:sync                      # Sync config + plugins natifs
vercel deploy --prod               # Redéployer prod (auto sur push main)

# Test cron weekly
curl -H "x-vercel-cron: 1" https://ava-lou.vercel.app/api/cron/weekly

# Valider les credentials ASC (après signature agreements)
node scripts/asc-test.mjs

# Archive + upload TestFlight (sur Mac avec Xcode)
./scripts/ios-archive-and-upload.sh
```

Bon réveil ☕

—

## 📂 Documents disponibles

- `MORNING.md` (ce fichier)
- `MORNING-AUDIT.md` — audit DX initial (~80 findings)
- `MIGRATIONS-TODO.md` — migrations à appliquer
- `LEGAL.md` — conformité française L441-9 + roadmap factur-X
- `SIRENE.md` — API contract data.gouv
- `NATIVE.md` — Capacitor iOS + Android (build, sign, TestFlight, Play Console)
- `README.md` — overview tech général
