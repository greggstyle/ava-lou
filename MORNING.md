# 🌅 Briefing matinal — AVA-Lou V4+

**Production en ligne** : https://ava-lou.vercel.app
**Native iOS + Android** : `ios/` + `android/` projets prêts (cf NATIVE.md)
**Repo** : https://github.com/greggstyle/ava-lou

---

## ⚡ Statut au réveil

Tout est compilé, déployé, testable. **Production stable**.

15 commits poussés cette nuit, sept versions livrées :
- **V0** fondations (auth, CRUD, flux vocal Whisper+Claude)
- **V0.5** fix loop "Réessayer"
- **V0.7** conformité française (L441-9, SIRET data.gouv) + Capacitor
- **V1** page publique `/voir` + robustness (timeouts, zod, blob preserve)
- **V2** voice intents (mark_paid, financial_status, send_reminder, list, find, send_doc)
- **V3** dashboard intelligence + historique + dictation tips
- **V3.5** notifications proactives via cron + PWA install hint
- **V4** schedule_appointment + /agenda + iOS publishing tooling + privacy/CGU
- **V4+** appointments CRUD + manual /agenda/nouveau

---

## 👉 ACTIONS À FAIRE AU RÉVEIL (15 min)

### 1️⃣ Supabase — URL Configuration (BLOQUANT magic link)
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/auth/url-configuration
- **Site URL** = `https://ava-lou.vercel.app`
- **Redirect URLs** : `https://ava-lou.vercel.app/auth/callback`, `https://ava-lou.vercel.app/**`
- **Save**

### 2️⃣ Email templates Onde
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/auth/templates
- Magic Link : Subject `Votre lien de connexion AVA` + corps `supabase/email-templates/magic-link.html`
- Confirm signup : Subject `Confirmez votre inscription AVA` + corps `supabase/email-templates/confirm-signup.html`

### 3️⃣ Migrations Supabase (BLOQUANT V0.7 → V4+)
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/sql/new

Coller successivement :
1. `supabase/migrations/0003_idempotency_and_legal.sql` — idempotency + champs légaux
2. `supabase/migrations/0004_notifications.sql` — table notifications
3. `supabase/migrations/0005_appointments.sql` — table appointments

Sans ces migrations :
- 0003 KO : double-tap crée 2 factures, mentions légales / SIRET cassés
- 0004 KO : bannière proactive lundi matin ne s'affichera pas
- 0005 KO : voice "RDV vendredi 14h" + page /agenda HS

### 4️⃣ TestFlight — il me manque l'**Issuer ID**
Reçu de votre part : la clé `.p8` (Key ID `MDAFVFXY36`) — bien stockée localement, gitignored.
**Manque** : l'Issuer ID
→ https://appstoreconnect.apple.com/access/integrations/api
→ En haut de la page, copiez la valeur sous "Issuer ID" (UUID format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
→ Collez-le dans `~/Dev/ava-lou/.appstore/.env` (copier d'abord depuis `.env.example`)

Une fois en place, lancer :
```bash
cd ~/Dev/ava-lou
cp .appstore/.env.example .appstore/.env
# Éditer .appstore/.env, remplir ASC_ISSUER_ID + APPLE_TEAM_ID
node scripts/asc-test.mjs   # validation des credentials
./scripts/ios-archive-and-upload.sh   # archive + upload TestFlight (sur Mac avec Xcode)
```

---

## 🧪 Plan de test (45 min)

### Web (https://ava-lou.vercel.app sur iPhone Safari)

**Onboarding** :
1. Login magic link → home avec greeting "Bonjour Lou" + 3 clients seedés
2. PWA install hint → "Sur l'écran d'accueil"
3. Settings → SIRET de votre entreprise → "Vérifier" → auto-fill nom/adresse/NAF/forme juridique

**V0/V1 voice flow** :
4. Tap mic FAB → "Touchez pour parler" → "Démarrer"
5. Dire « Facture pour M. Payet, 3 heures à 55 € » → confirm → "Confirmer et créer"
6. **Test idempotency** : double-tap rapide → une seule facture
7. Sur la fiche → "Voir / Imprimer (PDF)" ouvre `/voir/facture/[id]` → Cmd+P sur Mac, "Sur l'écran d'accueil" → Imprimer sur iPhone
8. "Envoyer par email" → Mail.app prêt avec lien partageable + corps complet + mentions légales

**V2 voice intents** :
9. « Qu'est-ce qui rentre cette semaine ? » → 4 KPI cards live
10. « M. Payet a payé » → confirme → status payée
11. « Relance Mme Hoarau » → écran avec draft email français → "Ouvrir mon client mail"
12. « Trouve la facture de M. Payet » → liste résultats cliquables
13. « Envoie le devis à Mme Hoarau » → preview → "Ouvrir et envoyer"

**V3 dashboard** :
14. `/dashboard` → top clients en retard + activité récente + delta mois vs mois dernier
15. `/historique` → 100 dernières actions vocales
16. `/test-voice` → outil debug Claude (paste any text, voir intent + confidence + latency)

**V4 agenda** :
17. « RDV chantier vendredi 14h chez M. Payet » → confirme → /agenda
18. `/agenda` voir RDV groupés par jour avec "Aujourd'hui" highlighted
19. `/agenda/nouveau` → manual form fallback
20. Home → section "Vos prochains RDV" si RDV à venir

**Tests robustness** :
21. Couper le wifi pendant l'enregistrement → erreur claire FR + "Renvoyer le même enregistrement"
22. Dire « truc machin chose » (intent unknown) → escape hatches "Continuer en facture/devis" toujours visibles
23. Privacy/CGU : `/legal/privacy` et `/legal/cgu` accessibles sans connexion

### Native iOS (10 min, Apple ID gratuit suffit)
24. `pnpm cap:open:ios` → Xcode → simulateur iPhone 15 Pro
25. Connecter votre iPhone → Signing avec Apple ID gratuit → Cmd+R
26. App installée — testez depuis l'app native (mêmes URLs, permission micro doit pop)

### TestFlight (quand vous m'aurez donné l'Issuer ID)
27. `./scripts/ios-archive-and-upload.sh` (sur votre Mac)
28. Attendre 5-15 min → App Store Connect → TestFlight → Builds
29. TestFlight → Internal Testing → ajouter testeurs → ils reçoivent un lien

---

## 📋 Récapitulatif features livrées

### Voice intents (9 total)
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
| `schedule_appointment` | "RDV…" | Parse date + heure + lieu + INSERT |

### Pages
- **`/`** Home : greeting, notifications, RDV à venir, suggestions, récents, shortcuts
- **`/listen`** Voice capture avec exemples + countdown 25s
- **`/confirm/[id]`** 7 layouts différents selon intent
- **`/dashboard`** Trésorerie + delta mensuel + top retards + activité
- **`/factures`** + `/factures/nouvelle` + `/factures/[id]` (avec LegalMentions + mailto)
- **`/devis`** + `/devis/nouveau` + `/devis/[id]` (avec convert-to-facture)
- **`/clients`** + `/clients/nouveau` + `/clients/[id]` (avec SIRET autocomplete)
- **`/agenda`** + `/agenda/nouveau`
- **`/historique`** 100 dernières actions vocales
- **`/parametres`** profil + informations légales + déconnexion
- **`/voir/facture/[id]`** + **`/voir/devis/[id]`** (PUBLIC, imprimable PDF)
- **`/legal/privacy`** + **`/legal/cgu`** (PUBLIC, App Store ready)
- **`/test-voice`** debug Claude (admin only via auth)

### API routes
- `/api/transcribe` (Whisper avec timeouts + retry)
- `/api/intent` (Claude + zod validation + intent enrichment)
- `/api/actions/[id]/confirm` (atomic claim, dispatch par intent)
- `/api/actions/[id]` (PATCH status, DELETE cancel)
- `/api/clients` + `/api/clients/[id]`
- `/api/factures` + `/api/factures/[id]`
- `/api/devis` + `/api/devis/[id]` + `/api/devis/[id]/convert`
- `/api/appointments` + `/api/appointments/[id]`
- `/api/lookup/siret` (data.gouv autocomplete)
- `/api/notifications/[id]` (mark read/dismissed)
- `/api/cron/weekly` (Vercel cron lundi 7h30)

### Migrations Supabase
- 0001 : init (profiles, clients, invoices, quotes, ava_actions, RLS)
- 0003 : idempotency + UNIQUE numbering + champs légaux profils + clients
- 0004 : notifications
- 0005 : appointments

### Tooling iOS
- `scripts/asc-test.mjs` : valide ASC API credentials + liste apps/bundles
- `scripts/ios-archive-and-upload.sh` : archive + upload TestFlight automatisé
- `scripts/exportOptions.plist` : config app-store + auto signing
- `.appstore/.env.example` : template credentials
- `.appstore/AuthKey_MDAFVFXY36.p8` : votre clé reçue, gitignored

---

## 🐛 Connus / non-bloquants

- **PDF** : seulement print depuis `/voir/...`, pas de génération serveur (puppeteer trop lourd pour Vercel + Capacitor)
- **Recherche listes** : pas de barre de recherche dans /factures, /devis, /clients (V5)
- **Tutoiement toggle** : écrit en base mais n'affecte aucun label UI (V5)
- **Audio retention OpenAI** : sans ZDR config, 30j chez OpenAI
- **Service worker offline** : pas implémenté (Capacitor remote-URL ne le nécessite pas en V0)
- **Web push** : pas implémenté (notifications restent in-app)
- **Schedule appointment** : pas de Google Calendar sync (V5)

---

## 🔁 V5 idées si Lou redemande

- PDF serveur via `@react-pdf/renderer` (rebuild de LegalMentions en composants react-pdf)
- Gmail OAuth pour envoi automatique sans intervention
- Service worker + offline shell
- Recherche listes (input client-side)
- Web push notifications
- Sync Google Calendar pour appointments
- Niveau 3 Conseiller (CdC §1.2) — Claude génère des suggestions stratégiques
- Pennylane API integration pour facturation électronique conforme

---

## 📊 Stats finales nuit

- **15 commits** : V0 → V4+ + docs + iOS tooling
- **~50 fichiers source** créés/modifiés
- **6 tables Supabase** : profiles, clients, invoices, quotes, ava_actions, notifications, appointments
- **5 migrations** : 0001 init, 0003 idempotency+legal, 0004 notifications, 0005 appointments
- **9 voice intents** implémentés et routés
- **35+ routes** Next.js (web app + API)
- **2 plateformes natives** : iOS + Android via Capacitor

## 📂 Documents disponibles

- `MORNING.md` (ce fichier) — actions matinales et plan de test
- `MORNING-AUDIT.md` — audit DX initial avec ~80 findings
- `MIGRATIONS-TODO.md` — migrations Supabase à appliquer
- `LEGAL.md` — conformité française art. L441-9 + roadmap factur-X 2026/2027
- `SIRENE.md` — API contract data.gouv autocomplete
- `NATIVE.md` — Capacitor iOS + Android (build, sign, TestFlight, Play Console)
- `README.md` — overview tech général

Bon réveil et bons tests ☕

—

## 🚀 Commandes utiles

```bash
# Dans ~/Dev/ava-lou
pnpm dev                           # Dev local sur localhost:3000
pnpm build                         # Vérifier que ça compile
pnpm cap:open:ios                  # Ouvrir le projet iOS dans Xcode
pnpm cap:open:android              # Ouvrir le projet Android
pnpm cap:sync                      # Sync config + plugins natifs
vercel deploy --prod               # Redéployer en prod (auto sur push main)

# Tester la cron weekly manuellement
curl -H "x-vercel-cron: 1" https://ava-lou.vercel.app/api/cron/weekly

# Quand vous m'avez donné l'Issuer ID — valider l'auth ASC
ASC_KEY_ID=MDAFVFXY36 \
ASC_ISSUER_ID=<votre-issuer-id> \
ASC_KEY_PATH=./.appstore/AuthKey_MDAFVFXY36.p8 \
node scripts/asc-test.mjs
```
