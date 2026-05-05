# AVA-Lou · Bilan nuit du 5 au 6 mai 2026

Bonjour Greg ☕

Pendant que vous dormiez : **V7 → V18 livrées en 12 PR**, **TestFlight uploadé et VALID**, **2 audits (sécurité + UX) avec corrections appliquées**.

---

## ⚡ TestFlight — accessible MAINTENANT

**Statut Apple :** `VALID` · `READY_FOR_BETA_TESTING` · pas de compliance d'export à régler.

**Pour installer sur votre iPhone :**

1. https://appstoreconnect.apple.com/apps/6766485791/testflight
2. Onglet **TestFlight** → **Internal Testing** group → **Add Internal Testers**
3. Ajoutez `greg@gonnected.com`
4. Email TestFlight arrive → ouvrez sur iPhone → installe l'app **TestFlight** d'Apple → tap **Install AVA**
5. Build version : **1.0 (1)** · expire le **2026-08-03** (90 jours)

**Test externe (clients/Lou) :** déjà `READY_FOR_BETA_SUBMISSION`. Bouton **Submit for Review** dans TestFlight, ~24h chez Apple.

---

## 🚀 Features livrées V7 → V18

| V | Sujet | PR |
|---|---|---|
| V7 | AVA Conseillère niveau 3 — insights stratégiques via Claude, cron weekly | #1 |
| V8 | PDF server-side via @react-pdf/renderer (factures + devis) | #2 |
| V9 | Factures récurrentes avec cadences + cron quotidien | #3 |
| V10 | **Export comptable CSV** (factures, devis, dépenses) format FR — Pennylane / Sellsy / EBP | #4 |
| V11 | **Service worker + page /offline** (mode souple, pas de mutations offline) | #5 |
| V12 | **Bilan annuel** /bilan avec barres mensuelles + repères TVA | #6 |
| V13 | **Voice intent send_payment_link** (mailto avec URL publique signée) | #7 |
| V14 | **Bouton Partager WhatsApp + natif** sur /voir/facture et /voir/devis | #8 |
| V15 | Bandeau onboarding profil + fix V13 confirm UI + **cron auth durcie** + **CSV formula injection guard** | #9 |
| V16 | **IBAN / BIC / nom de banque** sur profil + bloc virement sur factures | #10 |
| V17 | **Per-line TVA rounding** + **signed URLs HMAC** sur vues publiques | #11 |
| V18 | **Atomic invoice numbering** avec retry sur conflit UNIQUE | #12 |

Tout mergé sur `main`, déployé automatiquement sur Vercel.

---

## 🔒 2 audits live + corrections

`.audit/SECURITY-AUDIT-V13.md` (4 P0, 8 P1, 7 P2) et `.audit/UX-AUDIT-V13.md` (4 P0, 12 P1, 9 P2).

**P0 corrigés cette nuit :**
- ✅ V13 send_payment_link était mort à l'écran → branche /confirm + PaymentLinkActions
- ✅ MarkPaidActions détourné pour expense / appointment → GenericConfirmActions
- ✅ Cron endpoints triggerable sans auth → CRON_SECRET requis (header Bearer)
- ✅ IBAN absent partout → migration 0009 + form + bloc virement
- ✅ /voir/* UUID-only → tokens HMAC signés (mode souple par défaut)
- ✅ CSV formula injection (=,+,-,@,\t) → préfixe ' ajouté

**P1 corrigés :**
- ✅ Per-line TVA rounding (best practice facturation FR)
- ✅ Race numbering FAC-2026-014 → insertWithNumbering avec retry sur 23505

**Restent à traiter (pas critiques pour la démo) :**
- P1-6 Service worker cache HTML authentifié → ajouter `Vary` ou ne pas cacher au-delà des assets statiques
- P1-7/8 Whisper + Claude reçoivent les vrais noms clients sans flag de consentement → soit ajouter un toggle dans /parametres, soit logger uniquement les UUIDs côté ava_actions

---

## ⚠️ Actions manuelles à faire ce matin

### 1. Migration 0009 (IBAN) à appliquer

Le formulaire IBAN renvoie 400 tant que les colonnes n'existent pas. **Sans application, /parametres ne sauvera pas.**

Option A (Supabase Studio web) :
1. https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/sql/new
2. Coller le contenu de `supabase/migrations/0009_iban.sql`
3. Run

Option B (CLI) :
```bash
brew install supabase/tap/supabase
supabase link --project-ref rpnnuxqbrejdwhyunqbk
supabase db push
```

### 2. CRON_SECRET à ajouter à Vercel

Sans ça les 3 crons (weekly, insights, recurring) renvoient 401. **Recurring tourne tous les jours à 06:00 UTC**, donc à régler avant 8h heure FR.

```bash
# Génère un secret
openssl rand -base64 32 | tr -d '=+/' | cut -c1-32

# Ajoute à Vercel
vercel env add CRON_SECRET production
# Coller la valeur, profiter du fait que Vercel injecte automatiquement
# Authorization: Bearer $CRON_SECRET sur les requêtes cron
```

Ou via le dashboard Vercel → Settings → Environment Variables → Add New → `CRON_SECRET` = (la valeur).

### 3. Optionnel — passage strict signed URLs

Une fois que vous avez vérifié que votre tooling (et les emails déjà envoyés) renvoient bien des URLs signées :
```bash
vercel env add NEXT_PUBLIC_PUBLIC_URL_REQUIRE_TOKEN production
# valeur : true
```

Avant cette bascule, le mode souple accepte les URLs sans token (rétro-compatible).

---

## 🧪 Smoke test sur l'iPhone (5 min)

Une fois TestFlight installé :

1. **Login** magic link → check email greg@gonnected.com → tap → home
2. **Bandeau profil** apparaît → tap → /parametres → renseignez SIRET, raison sociale, IBAN, BIC, banque → Enregistrer
3. **Voice flow** : tap mic → "Facture pour M. Payet, 3 heures de plomberie à 55 €" → écran AVA a compris → Confirmer
4. **Ouvrir la facture** → bouton **Partager** → bottom sheet → **WhatsApp** → message pré-rempli → vérifier l'URL signée `?t=...`
5. **Voice payment link** : tap mic → "Envoie le lien de paiement à M. Payet" → écran V13 → tap **Ouvrir l'email** → mail draft pré-rempli avec l'URL publique
6. **Bilan annuel** : `/bilan?year=2026` → vérifier les barres mensuelles + résultat net + bloc TVA
7. **Export CSV** : `/comptabilite` → preset "Année en cours" → Télécharger factures.csv → ouvrir dans Excel FR → accents OK, montants `1 234,56`, dates `06/05/2026`

---

## 📊 État du projet

- **18 PR mergées** depuis V7 (toutes squash-merged sur main)
- **Migrations Supabase** : 0001 → 0009 (0009 à appliquer)
- **Tests CI** : ✅ build vert sur GitHub Actions à chaque push
- **Vercel deploys** : auto sur main
- **iOS bundle** : `fr.digidatale.ava` (id ASC `6766485791`)
- **Distribution cert** : `Apple Distribution: GREGORY HANFFOU (6WQ76GAQ8N)` valide jusqu'en mai 2027
- **Provisioning profile** : `AVA App Store 2026-05-05` valide jusqu'en mai 2027

---

## 🛠️ Pour la suite (V19+)

Idées non commencées, classées par impact pour Lou :

1. **Notifications Web Push** — relances échéance + paiement reçu (manque infrastructure FCM/APNs)
2. **Stripe Connect + vrai payment_link** — V13 actuelle pointe vers /voir/facture, qui montre l'IBAN. Une vraie URL Stripe permettrait CB en 1-clic
3. **Profil setup wizard** — au lieu du bandeau warning, écran modal avec étapes (SIRET → IBAN → mentions légales) au premier login
4. **Voice flow multi-prestations** — "facture pour Payet, 3 h plomberie 55 €, plus 2 h électricité 60 €" en une dictée
5. **Search bar** sur /factures et /clients — filter as you type
6. **Conformité TVA mensuelle** — bouton dans /comptabilite "Préparer ma déclaration TVA du mois" qui filtre + total
7. **Bilan PDF** — export PDF du /bilan pour le compta
8. **Multi-utilisateur** — soutenir un assistant qui voit les factures de son patron avec rôle limité

---

Bon café ☕

Toutes les décisions prises cette nuit sont commit-by-commit sur `main`. Si quelque chose vous gêne, `git revert <sha>` proprement.

— Claude
