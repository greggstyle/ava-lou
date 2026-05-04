# 🌅 Briefing matinal — AVA-Lou V0.5

**Production en ligne** : https://ava-lou.vercel.app

## ✅ Ce qui a été livré cette nuit

### Fondations (Wave 0–1)
- Repo GitHub `greggstyle/ava-lou` poussé
- Vercel projet `ava-lou` lié, env vars en place (Supabase + OpenAI + Anthropic)
- Schéma Supabase migré (5 tables + RLS + trigger auto-profile)
- Design system Onde porté en TSX (12 primitives)
- Fonts Instrument Serif + Inter Tight self-hosted

### Features V0 (Wave 2)
- Auth magic link
- CRUD complet : Clients, Factures, Devis (numérotation auto FAC-2026-XXX)
- Dashboard avec KPIs trésorerie
- Paramètres (profil, TVA défaut, DROM, déconnexion)
- Flux vocal complet : `/listen` → Whisper → Claude → `/confirm/[id]` → CRUD
- PWA installable (manifest + icônes)

### Fixes V0.5 (cette nuit après votre retour)
- **Loop "Réessayer" cassé** : sur faible confiance, bouton "Continuer en formulaire" route vers `/factures/nouvelle?action=ID` ou `/devis/nouveau?action=ID` avec préremplissage
- **Préremplissage** : client matché par nom OU bouton "Créer maintenant" si nouveau, line items, TVA, dates, notes
- **Prompt Claude assoupli** : "brouillon d'abord" — ne refuse plus jamais une facture/devis pour info manquante. Crée un brouillon avec ce qui est dit, complète "Prestation qty=1" si rien d'autre.
- **Confidence threshold** : 0.75 → 0.5
- **Mic flottant global** : sur toutes les pages (sauf listen/confirm/login), tap → `/listen?return=path` → revient à la page courante avec le formulaire prérempli
- **Seed 3 clients démo** : M. Payet, Mme Hoarau, M. Técher (DROM-aware) — auto-créés au premier login si tables vides
- **Bouton "Envoyer par email"** sur les détails facture/devis : ouvre `mailto:` avec corps formaté complet (lignes, totaux, échéance, mentions). Status passe à `envoyée`/`envoyé` au clic. Mailto deep-link aligné CdC §7.2.
- **Templates emails Onde** dans `supabase/email-templates/` (magic-link.html + confirm-signup.html)

## 👉 ACTIONS DE VOTRE CÔTÉ AU RÉVEIL

### 1. Supabase : URL Configuration (BLOQUANT)
Sans ça les magic links redirigent vers `localhost`.

→ https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/auth/url-configuration

- **Site URL** : `https://ava-lou.vercel.app`
- **Redirect URLs** : ajouter
  - `https://ava-lou.vercel.app/auth/callback`
  - `https://ava-lou.vercel.app/**`
  - `http://localhost:3000/auth/callback`
- **Save**

### 2. Supabase : Email Templates
→ https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/auth/templates

- **Magic Link** : Subject = `Votre lien de connexion AVA` + coller `supabase/email-templates/magic-link.html`
- **Confirm signup** : Subject = `Confirmez votre inscription AVA` + coller `supabase/email-templates/confirm-signup.html`

### 3. Test du flux complet
1. Ouvrir https://ava-lou.vercel.app/login sur votre iPhone
2. Email → magic link → `/auth/callback` → home AVA
3. Vous devriez voir 3 clients démo et le greeting "Bonjour Lou"
4. Tap sur un client → fiche complète
5. Tap mic flottant en bas à droite → /listen
6. Dire « Facture pour M. Payet, 3 heures de plomberie à 55 € TVA 8,5 % »
7. Vous arrivez sur `/confirm/[id]` avec la reformulation AVA + total
8. "Confirmer et créer" → la facture est créée → page de succès
9. Sur la page facture détail : "Envoyer par email" → ouvre Mail/Gmail avec corps prérempli → vous appuyez sur Envoyer

### 4. Stretch goal : Gmail OAuth réel
La V0.5 utilise `mailto:` (CdC §7.2 deep-link). Pour passer à Gmail OAuth réel (envoi automatique sans intervention) :
- Créer un projet Google Cloud Console
- Activer Gmail API
- OAuth client ID/secret
- Ajouter les credentials en env Vercel
- Implémenter le flow OAuth + storage des tokens dans `connected_services`
- ~3-4h de dev

Je peux faire ça en V1 quand vous aurez le projet Google Cloud créé.

## 🐛 Connus / non-bloquants

- Les nouvelles factures sans client sont permises (dropdown "— Sans client —"). C'est un choix de souplesse.
- Le bouton "Modifier" sur le confirm bas-confiance ne pré-remplit pas via query string s'il route vers `/factures/nouvelle` simple — la version `?action=ID` est utilisée.
- Pas de PDF en V0 — uniquement texte mailto. PDF arrive en V1 (Puppeteer ou @react-pdf/renderer).
- Le seed 3 clients est idempotent : si vous supprimez tout, il se ré-active. Pour figer : ajouter `profiles.demo_seeded boolean` (migration future).

## 📂 Fichiers clés

- `src/components/ava/index.tsx` — primitives
- `src/components/mic-fab.tsx` — bouton mic global
- `src/components/listen-ui.tsx` — flux d'enregistrement
- `src/components/confirm-actions.tsx` — actions sur l'écran confirmation
- `src/lib/claude.ts` — system prompt + extraction d'intent
- `src/lib/whisper.ts` — wrapper transcription
- `src/app/page.tsx` — home (avec auto-seed)
- `src/app/api/intent/route.ts` — route Claude
- `src/app/api/actions/[id]/confirm/route.ts` — exécution intent
- `supabase/migrations/0001_init.sql` — schéma

Bon café ☕
