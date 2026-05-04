# 🌅 Briefing matinal — AVA-Lou V0.7

**Production en ligne** : https://ava-lou.vercel.app
**Native** : `ios/` + `android/` projets prêts (voir NATIVE.md)

---

## ✅ Livrables de la nuit

### Wave 1 — fix de la boucle vocale + UX
- Loop "Réessayer" cassé → bouton "Continuer en formulaire" qui pré-remplit
- Préremplissage `?action=ID` dans `/factures/nouvelle` et `/devis/nouveau`
- Prompt Claude assoupli (philosophie brouillon-d'abord, confidence ≥ 0.65)
- Mic flottant global sur toutes les pages (route `/listen?return=path`)
- Seed 3 clients démo (M. Payet, Mme Hoarau, M. Técher)
- Bouton "Envoyer par email" (mailto: deep-link CdC §7.2)
- Templates emails Onde

### Wave 2 (cette nuit après votre coucher)
- **Capacitor iOS + Android** : projets natifs prêts, manifests permissions micro, splash navy, NATIVE.md
- **P0 audit fixes** : idempotency atomic claim, TVA DROM par défaut, mic tap-to-start, escape hatch toujours visible, VAT 5,5% ajouté
- **Mentions légales françaises** : composant `<LegalMentions />` sur factures + devis (art. L441-9 + R441-3 + D441-5)
- **SIRET autocomplete** : recherche-entreprises.api.gouv.fr → auto-remplit denomination, adresse, NAF, forme juridique sur Settings + Fiche client
- **Email body legal** : mailto inclut bloc mentions légales

---

## 👉 ACTIONS À FAIRE AU RÉVEIL (15 min)

### 1️⃣ Supabase URL Configuration (BLOQUANT pour magic link)
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/auth/url-configuration
- **Site URL** = `https://ava-lou.vercel.app`
- **Redirect URLs** : ajouter `https://ava-lou.vercel.app/auth/callback`, `https://ava-lou.vercel.app/**`
- **Save**

### 2️⃣ Email templates Onde
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/auth/templates
- Magic Link : Subject `Votre lien de connexion AVA` + corps de `supabase/email-templates/magic-link.html`
- Confirm signup : Subject `Confirmez votre inscription AVA` + corps de `supabase/email-templates/confirm-signup.html`

### 3️⃣ Migration 0003 (BLOQUANT pour idempotency, mentions légales, SIRET)
https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/sql/new
Coller le contenu de `supabase/migrations/0003_idempotency_and_legal.sql` puis **Run**.

Sans ça, **les nouvelles features ne fonctionnent pas** (champs base inexistants, double-tap crée 2 factures, numéros peuvent collisionner).

---

## 🧪 Plan de test (30 min)

### Test web (https://ava-lou.vercel.app sur iPhone Safari)
1. Login → magic link → home avec greeting "Bonjour Lou" + 3 clients seedés
2. **Settings** : remplir SIRET (testez avec `80300010800010` ou un vrai SIRET) → cliquer "Vérifier" → vérifier que `denomination`, `adresse`, `NAF`, `forme juridique` se pré-remplissent. Cocher DROM si applicable.
3. **Nouveau client pro** : `/clients/nouveau` → cocher "Client professionnel" → SIRET → "Rechercher" → vérifier auto-fill
4. **Test vocal** : tap mic FAB → page `/listen` doit afficher "Touchez pour parler" (pas démarrage auto) → "Démarrer" → dire « Facture pour M. Payet, 3 heures à 55 € TVA 8,5 % » → confirmer
5. **Test idempotency** : sur l'écran de confirmation, double-tap rapide sur "Confirmer et créer" — doit créer **une seule** facture (pas deux)
6. **Test escape hatch** : dire « Salut Mme Hoarau » → doit montrer "Continuer en facture" + "Continuer en devis" + "Réessayer en vocal" (plus de loop)
7. **Test mentions légales** : ouvrir une facture créée → bloc "Document — Mentions légales" doit afficher vendeur + acheteur + détail TVA + pénalités retard
8. **Test envoi email** : "Envoyer par email" → ouvre Mail.app/Gmail avec sujet `Facture FAC-2026-XXX` + corps complet incluant mentions légales + signature AVA

### Test native iOS (10 min, Apple ID gratuit suffit)
1. Connecter iPhone en USB
2. Dans terminal : `pnpm cap:open:ios`
3. Xcode → "AVA" → choisir votre iPhone en target
4. Signing & Capabilities → Team → votre Apple ID personnel
5. Cmd+R → l'app installée sur l'iPhone, ouvre AVA
6. iPhone : Réglages → Général → VPN/gestion appareil → Faire confiance au certificat
7. Tester le micro depuis l'app native (devrait pop le permission iOS la 1ère fois)

⚠️ Apple ID gratuit : l'app expire dans **7 jours**. Apple Developer ($99/an) pour TestFlight.

### Test native Android (10 min, gratuit)
1. Connecter téléphone Android avec Mode développeur + USB Debugging activés
2. `pnpm cap:open:android`
3. Run (Shift+F10) sur le téléphone
4. Tester le micro

---

## 🐛 Connus / non-bloquants V0.7

- **Pas de PDF facture** : seulement HTML + mailto. Puppeteer en V1.
- **Recherche client** : pas de barre de recherche dans les listes. Avec 3-5 clients OK, à ajouter dès que le volume monte.
- **Optimistic UI statut** : 300-800 ms de flicker quand on change brouillon→envoyée. Pas bloquant.
- **`tutoiement` toggle** : écrit en base mais n'affecte aucun label en V0. À câbler en V1.
- **Notes contiennent la dictée brute** : si vous dictez une facture, "Notes : Dictée vocale : « ... »" finit dans le mailto. Modifiez à la main avant d'envoyer.
- **Pas de validation Luhn SIRET** : l'API Sirene tranche.
- **Audio Whisper retention OpenAI** : non-conformité CdC (30j chez OpenAI). Activer ZDR sur le compte OpenAI org si production.

---

## 🔁 Si vous voulez itérer ensemble à 7h

Priorité 1 : **vrai test mobile** (Capacitor sur votre iPhone) — c'est le risque #1.
Priorité 2 : **affiner le prompt Claude** sur 5-10 dictations réelles (avec un vrai timbre de voix DROM)
Priorité 3 : **PDF generation** si Lou demande (Puppeteer ou react-pdf, 2h)
Priorité 4 : **Gmail OAuth** pour envoi automatique (3-4h, nécessite Google Cloud Console)

---

## 📂 Documents à votre disposition

- `MORNING.md` (ce fichier) — actions du matin
- `MORNING-AUDIT.md` — audit DX nuit avec ~80 findings (P0/P1/P2)
- `MIGRATIONS-TODO.md` — migrations Supabase à appliquer
- `LEGAL.md` — conformité française art. L441-9 + roadmap factur-X 2026/2027
- `SIRENE.md` — API contract data.gouv autocomplete
- `NATIVE.md` — Capacitor iOS + Android (build, sign, TestFlight, Play Console)
- `README.md` — overview tech général

Bon café et bons tests ☕
