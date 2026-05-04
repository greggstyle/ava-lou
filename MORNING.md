# 🌅 Briefing matinal — AVA-Lou V3.5

**Production en ligne** : https://ava-lou.vercel.app
**Native** : `ios/` + `android/` projets prêts (voir NATIVE.md)
**Repo** : https://github.com/greggstyle/ava-lou

---

## ✅ Tout ce qui a été livré cette nuit (V0 → V3.5)

### V0 — Fondations + flux vocal
- Magic-link login + middleware auth
- CRUD complet : Clients, Factures, Devis (numérotation auto FAC-2026-XXX)
- Dashboard avec KPIs trésorerie
- Paramètres profil (TVA, DROM, déconnexion)
- Flux vocal : `/listen` → Whisper → Claude → `/confirm` → CRUD
- 6 primitives Onde portées en TSX, fonts Instrument Serif + Inter Tight
- PWA manifest + icônes
- 3 clients démo seedés au premier login

### V0.5 — Fixes du loop vocal
- Bouton "Continuer en formulaire" sur faible confiance (plus de boucle dead-end)
- Préremplissage `?action=ID` dans factures/devis nouveau
- Prompt Claude assoupli (philosophie brouillon-d'abord)
- Mic flottant global sur toutes les pages
- Bouton "Envoyer par email" (mailto deep-link)
- Templates emails Onde

### Wave Native
- **Capacitor iOS + Android** : projets natifs, manifests permissions micro, splash navy
- NATIVE.md : workflow simulateur + Apple ID gratuit (7j) + TestFlight + Play Console

### V0.7 — Conformité française + audit fixes
- 5 fixes P0 audit (idempotency atomic claim, TVA DROM par défaut, mic tap-to-start, escape hatch, VAT 5,5%)
- **Mentions légales art. L441-9** : composant `<LegalMentions />` sur factures + devis
- **SIRET autocomplete** via recherche-entreprises.api.gouv.fr (data.gouv)
- Email body legal : mailto inclut bloc mentions légales

### V1 — Page publique + robustness
- **Page publique `/voir/facture/[id]`** + **`/voir/devis/[id]`** : URL partageable, imprimable PDF par le client (lien dans le mailto)
- Notes ne pollue plus la dictée brute (problème pro fixé)
- Match client fuzzy `%name%` + reverse-substring (évite duplicats "Payet" vs "M. Payet")
- Whisper 25s timeout + retry, Claude 20s timeout + retry, structured FR errors
- JSON Claude validé par zod, fallback gracieux à `intent: unknown`
- Whisper failure preserves blob (Renvoyer = re-POST same blob, pas re-record)
- Polish : 30s countdown, status mapping FR, inputMode decimal, devis→facture due_date

### V2 — Voice intents avancés
- **`mark_paid`** : « M. Payet a payé » → trouve sa dernière facture impayée → confirme → status payée
- **`get_financial_status`** : « Qu'est-ce qui rentre ? » → 4 KPI cards live (à encaisser, en retard, encaissé ce mois, devis en attente)
- **`send_reminder`** : « Relance Mme Hoarau » → trouve impayés → drafte email poli → ouvre mailto
- **`get_invoice_list`** : « Mes factures impayées » → route vers /factures
- **`find_document`** : « Trouve la facture de M. Payet » → liste résultats cliquables
- **`send_document`** : « Envoie le devis à M. Payet » → ouvre la fiche prête à envoyer

### V3 — Dashboard + Historique
- Dashboard upgrade : delta mois vs mois dernier (% ↑↓), top 5 clients en retard, activité récente
- Page `/historique` : 100 dernières actions vocales avec status pills
- Dictation tips sur `/listen` idle screen (5 exemples)

### V3.5 — Notifications proactives (cron)
- **Vercel cron lundi 7h30** : `/api/cron/weekly` scanne overdue + stale quotes
- Insère une notification `weekly_recap` dans table `notifications`
- Bannière "AVA vous suggère" sur la home avec bouton "Examiner" / "Plus tard"
- CdC §1.2 niveau 2 (proactif) — atteint
- **PWA install hint** sur la home (iOS-aware, dismissible, hidden if standalone)

---

## 👉 ACTIONS À FAIRE AU RÉVEIL (15 min)

### 1️⃣ Supabase — URL Configuration (BLOQUANT magic link)
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/auth/url-configuration
- **Site URL** = `https://ava-lou.vercel.app`
- **Redirect URLs** : `https://ava-lou.vercel.app/auth/callback`, `https://ava-lou.vercel.app/**`
- **Save**

### 2️⃣ Email templates Onde (Supabase)
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/auth/templates
- Magic Link : Subject `Votre lien de connexion AVA` + corps de `supabase/email-templates/magic-link.html`
- Confirm signup : Subject `Confirmez votre inscription AVA` + corps de `supabase/email-templates/confirm-signup.html`

### 3️⃣ Migrations 0003 + 0004 (BLOQUANT V0.7 + V3.5)
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/sql/new

Coller successivement (cf. MIGRATIONS-TODO.md) :
1. `supabase/migrations/0003_idempotency_and_legal.sql` (idempotency + legal fields)
2. `supabase/migrations/0004_notifications.sql` (table notifications)

Sans ces deux, ces features sont KO :
- Double-tap crée 2 factures (0003)
- Mentions légales / SIRET (0003)
- Bannière proactive lundi matin (0004)

### 4️⃣ TestFlight (vous m'avez dit que vous donneriez les accès demain)
- Quand vous m'aurez donné votre Apple Developer + Bundle ID, je peux :
  - Configurer signing automatique
  - Archive + upload à App Store Connect
  - Inviter testeurs
- Sans Apple Developer, on peut tester via votre iPhone perso + Xcode signing gratuit (7 jours)

---

## 🧪 Plan de test (45 min)

### Web (https://ava-lou.vercel.app sur iPhone Safari)

**Onboarding** :
1. Login magic link → home avec greeting + 3 clients seedés
2. PWA install hint visible en bas → click "Sur l'écran d'accueil"
3. Settings → SIRET de votre entreprise → bouton "Vérifier" → auto-fill nom/adresse/NAF

**Voice flow magic** :
4. Tap mic → "Touchez pour parler" → "Démarrer" (premier prompt iOS micro)
5. Dire « Facture pour M. Payet, 3 heures à 55 € » → confirm screen avec total → "Confirmer et créer"
6. **Test idempotency** : double-tap rapide sur "Confirmer" → une seule facture créée
7. Sur la fiche facture créée → "Voir / Imprimer (PDF)" ouvre `/voir/facture/[id]` → Cmd+P → PDF
8. "Envoyer par email" → ouvre Mail.app avec body complet + lien `/voir/...`

**V2 voice intents** :
9. Tap mic → « Qu'est-ce qui rentre cette semaine ? » → écran avec 4 KPI cards
10. Tap mic → « M. Payet a payé » → confirm avec montant en gros → "Confirmer le paiement"
11. Tap mic → « Relance Mme Hoarau » → écran avec draft email rédigé → "Ouvrir mon client mail"
12. Tap mic → « Trouve la facture de M. Payet » → liste résultats

**V3 dashboard** :
13. `/dashboard` → voir top clients en retard + activité récente
14. `/historique` → liste des actions vocales récentes

**Native iOS (10 min, Apple ID gratuit suffit)** :
15. `pnpm cap:open:ios` → Xcode → simulateur
16. Connecter votre iPhone → Signing avec Apple ID gratuit → Cmd+R → app installée

---

## 🐛 Connus / non-bloquants V3.5

- **PDF** : seulement print depuis `/voir/...`, pas de génération serveur. Marche bien en démo iPhone Safari.
- **Recherche listes** : pas de barre de recherche dans /factures, /devis, /clients. OK avec 3-5 démo clients.
- **Optimistic UI statut** : 300-800 ms de flicker sur changement de statut.
- **Audio retention OpenAI** : sans ZDR config, 30j chez OpenAI. À activer pour prod.
- **Vercel cron** : tournera lundi 7h30 UTC en prod, mais nécessite migration 0004 appliquée pour insérer.
- **`tutoiement` toggle** : écrit en base, ne change pas encore les labels UI (V4).
- **Service worker offline** : pas implémenté en V3.5 (Next 16 + Capacitor remote-URL n'ont pas besoin).

---

## 🔁 Si vous voulez itérer ensemble à 7h

Priorités possibles pour V4 selon retours testeurs :
1. **PDF serveur** via `@react-pdf/renderer` (2h, isolé) si l'aperçu print n'est pas assez propre
2. **Gmail OAuth** pour envoi automatique (3-4h, nécessite Google Cloud Console)
3. **Service worker** (offline shell + cache statique pour résilience chantier)
4. **Recherche listes** (input client-side, ~30 min)
5. **Notifications push web** (Web Push API + service worker)
6. **Niveau 3 Conseiller** (CdC §1.2) — Claude génère des suggestions stratégiques sur base de l'historique

---

## 📊 Stats finales nuit

- **8 commits** : V0 → V0.5 → V0.7 → V1 → V2 → V3 → V3.5 + docs
- **~40 fichiers source** créés/modifiés
- **5 tables Supabase** : profiles, clients, invoices, quotes, ava_actions, notifications (V3.5)
- **4 migrations** : 0001 init, 0003 idempotency+legal, 0004 notifications
- **8 voice intents implémentés** : create_invoice, create_quote, mark_paid, send_reminder, get_financial_status, get_invoice_list, find_document, send_document
- **2 routes natives** : iOS + Android via Capacitor

## 📂 Documents à votre disposition

- `MORNING.md` (ce fichier) — actions du matin et plan de test
- `MORNING-AUDIT.md` — audit DX initial avec ~80 findings (réalisé en début de nuit)
- `MIGRATIONS-TODO.md` — migrations Supabase à appliquer
- `LEGAL.md` — conformité française art. L441-9 + roadmap factur-X 2026/2027
- `SIRENE.md` — API contract data.gouv autocomplete
- `NATIVE.md` — Capacitor iOS + Android (build, sign, TestFlight, Play Console)
- `README.md` — overview tech général

Bonne testing session ☕

—

## Commandes utiles pour vous

```bash
# Dans ~/Dev/ava-lou
pnpm dev                  # Dev local sur localhost:3000
pnpm build                # Vérifier que ça compile
pnpm cap:open:ios         # Ouvrir le projet iOS dans Xcode
pnpm cap:open:android     # Ouvrir le projet Android dans Android Studio
vercel deploy --prod      # Redéployer en prod (auto sur push main)

# Tester la cron weekly manuellement
curl -H "x-vercel-cron: 1" https://ava-lou.vercel.app/api/cron/weekly
# (ou avec Authorization: Bearer $CRON_SECRET si vous l'avez défini)
```
