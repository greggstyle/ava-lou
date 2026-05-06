# Cahier des charges — AVA-Lou

**L'OS administratif des indépendants**
*Voice-first invoicing pour artisans des DROM*

Version du 6 mai 2026 — Greg Hanffou

---

## Sommaire

1. [Présentation](#1-présentation)
2. [Utilisateur cible & contexte](#2-utilisateur-cible--contexte)
3. [Promesse produit](#3-promesse-produit)
4. [Parcours utilisateur](#4-parcours-utilisateur)
5. [Périmètre fonctionnel](#5-périmètre-fonctionnel)
6. [Architecture technique](#6-architecture-technique)
7. [Sécurité & conformité](#7-sécurité--conformité)
8. [Identité visuelle](#8-identité-visuelle)
9. [Distribution](#9-distribution)
10. [Coûts d'exploitation](#10-coûts-dexploitation)
11. [Limites actuelles & roadmap](#11-limites-actuelles--roadmap)
12. [Glossaire](#12-glossaire)

---

# 1. Présentation

**AVA** est une application mobile et web qui permet aux artisans français — en particulier ceux des DROM (départements et régions d'outre-mer) — de gérer toute leur administration **par la voix**, sans formulaires, sans clavier.

L'artisan parle à AVA comme à une assistante humaine :

> « Facture pour Monsieur Payet, 3 heures de plomberie à 55 euros. »

AVA comprend la commande, prépare un brouillon de facture conforme à la loi française, le présente à l'artisan pour validation, puis l'enregistre, le numérote, et permet de l'envoyer au client.

**Slogan interne** : « L'OS administratif des indépendants. »

**Cible métier prioritaire** : artisans du bâtiment, plomberie, électricité, menuiserie, peinture, et services à la personne, basés à La Réunion (974), Mayotte (976), Guadeloupe (971), Martinique (972), Guyane (973). TVA par défaut adaptée 8,5 %.

**État** : application déployée en production (https://ava-lou.vercel.app) et publiée sur **Apple TestFlight** (build 1.0). 38 versions itératives livrées en mai 2026.

---

# 2. Utilisateur cible & contexte

## 2.1 Profil principal — « Lou »

- Artisan de 35 à 60 ans
- Travaille seule ou avec 1-2 personnes
- Mobile toute la journée (chantier, route, bureau improvisé dans le pickup)
- Souvent les mains occupées (gants, outils, peinture)
- Maîtrise le français mais pas l'orthographe administrative
- A un iPhone OU un Android, principalement
- N'aime pas remplir des formulaires
- Communique avec ses clients à 90 % via **WhatsApp** et SMS
- A un comptable ou un Centre de Gestion Agréé qui demande des CSV ou PDF en fin de mois

## 2.2 Pain points résolus

| Pain point | Solution AVA |
|---|---|
| « Je tape mal sur le téléphone » | Tout par la voix |
| « Je perds des heures à faire mes factures le soir » | 30 secondes par dictée |
| « Mes tickets de caisse traînent dans la boîte à gants » | Photo OCR → dépense créée en 3s |
| « Mon comptable me harcèle pour le CSV » | Bouton "Télécharger CSV" formaté Excel français |
| « Les clients paient en retard » | Page Relances avec mailto pré-rempli en 1 tap |
| « Je veux que mes clients paient en ligne par CB » | Lien Stripe/SumUp inclus dans les emails |
| « Je ne sais jamais où j'en suis » | Page d'accueil contextuelle + résumé hebdo vocal |

## 2.3 Anti-personas

AVA n'est **pas** conçue pour :

- Les grandes structures (>5 personnes) qui ont besoin d'ERP
- Les commerces avec inventaire (pas de gestion de stock)
- Les freelances tech / créatifs basés en métropole pure (TVA 20 % seulement) — ils peuvent utiliser, mais l'optimisation DROM ne les concerne pas

---

# 3. Promesse produit

## 3.1 Voice-first vraie

AVA n'est **pas** une app classique avec un bouton micro en bonus. **La voix est le mode d'entrée principal**, et **la voix est aussi un mode de sortie** : AVA répond oralement quand on lui pose une question.

Exemples :

| L'artisan dit | AVA fait |
|---|---|
| « Facture pour M. Payet, 3 heures à 55 € » | Brouillon facture pré-rempli |
| « Devis Mme Hoarau, pose carrelage 25 m² à 45 € plus déplacement 80 € » | Devis 2 lignes |
| « M. Payet a payé » | Marque la facture comme payée |
| « Envoie le lien de paiement à Madame Hoarau » | Email pré-rempli avec lien Stripe + IBAN |
| « Qu'est-ce qui rentre cette semaine ? » | AVA lit à voix haute le résumé |
| « Mes relances » | Ouvre la liste des factures en retard |
| « J'ai acheté du carrelage chez Point P pour 340 € » | Note de frais enregistrée |

## 3.2 Brouillon d'abord

Aucune action n'est définitive sans validation explicite de l'artisan. Tout passe par un écran de **confirmation** où le brouillon est éditable. Le slogan visuel de l'écran : *« Brouillon — rien n'est envoyé sans votre accord. »*

## 3.3 Conformité française par défaut

Toutes les factures et devis générés par AVA respectent automatiquement :

- Mentions légales obligatoires (art. **L441-9** du Code de commerce)
- Pénalités de retard (art. **D441-5**)
- Indemnité forfaitaire 40 € pour frais de recouvrement
- Mention « TVA non applicable, art. 293 B du CGI » pour les auto-entrepreneurs en franchise
- Médiateur de la consommation pour les clients particuliers (art. **L612-1**)
- TVA DROM 8,5 % par défaut quand l'artisan est basé en DROM
- Numérotation chronologique (FAC-2026-001, FAC-2026-002, …)

L'artisan ne peut pas oublier une mention. AVA les ajoute toutes.

---

# 4. Parcours utilisateur

## 4.1 Premier lancement

1. Lou ouvre AVA (TestFlight, App Store, ou https://ava-lou.vercel.app)
2. Écran de connexion : saisit son email → reçoit un **lien magique** par mail
3. Clique le lien → connectée
4. **Wizard d'onboarding** en 3 étapes apparaît :
   - **Étape 1** : prénom + nom de l'entreprise + toggle « basé en DROM »
   - **Étape 2** : SIRET (avec bouton **Vérifier** qui interroge data.gouv et pré-remplit la raison sociale)
   - **Étape 3** : IBAN + BIC + nom de la banque
5. Validation → la page d'accueil personnalisée s'affiche

## 4.2 Page d'accueil

Affiche, dans cet ordre, et adapté à l'heure de la journée :

- **Bandeau salutation contextuel** : *« Bonne matinée, Lou. ● 2 factures en retard, 1 240 € à relancer. »* avec un bouton ▶ pour qu'AVA lise la phrase
- **Bandeau profil incomplet** (warm yellow) si SIRET ou raison sociale manquant
- **Notifications proactives** (récap hebdo du lundi, etc.)
- **Insight stratégique** d'AVA Conseillère (généré chaque dimanche soir)
- **Prochain rendez-vous** du jour
- **Hint d'installation** PWA si pas encore installé en home screen
- **Tuiles raccourcis** (6 tiles 2×3) :
  - Historique vocal
  - Insights / Conseils
  - Récurrents (factures auto)
  - Comptabilité (CSV expert-comptable)
  - Bilan annuel
  - Relances (colorée jaune si retards en cours)
- **Mic dock flottant** en bas — toujours visible

## 4.3 Flux vocal

1. Tap sur le micro → écran **Listen** (fond navy, waveform animée)
2. L'artisan parle ; relâche le doigt → audio uploadé
3. **Whisper** (OpenAI) transcrit en français
4. **Claude Sonnet 4.5** (Anthropic) extrait l'intention + entités structurées en JSON
5. Si l'intention crée un document : écran **Confirm** avec brouillon éditable + bouton ▶ TTS
6. L'artisan édite si besoin → tape « Confirmer »
7. Document créé en base, numéroté, écran **Success** (AVA dit à voix haute « Facture FAC-2026-014 créée »)

## 4.4 Photo OCR pour les notes de frais

1. Lou ouvre `/depenses/nouvelle`
2. Tap sur **« 📷 Prendre une photo »** (en haut, carte warm yellow)
3. La caméra de l'iPhone s'ouvre → photo du ticket
4. Upload → **GPT-4o Vision** extrait : fournisseur, montant TTC, date, catégorie (matériel, restauration, déplacement, etc.), libellé
5. Le formulaire est pré-rempli en 3 secondes
6. Lou vérifie → tap **Enregistrer**

Temps total : **5 secondes** au lieu de 30.

## 4.5 Envoi de facture au client

Sur l'écran de la facture créée :

- Bouton **Envoyer par email** → ouvre l'app email de l'iPhone avec un brouillon pré-rempli (sujet, corps, lien public signé vers la facture)
- Bouton **Télécharger PDF** → PDF A4 mentions légales conformes
- Bouton **Voir en ligne** → page publique partageable
- Sur la page publique : bouton **Partager** → bottom sheet avec **WhatsApp** (numéro pré-rempli, message FR pré-rédigé) + Copier le lien
- Si l'artisan a configuré un lien Stripe/SumUp dans ses paramètres, l'email contient **deux options** : 💳 régler par CB en 1 clic + 📄 voir la facture (avec IBAN)

## 4.6 Comptable / fin de mois

Page **/comptabilite** :

- **Aperçu YTD** : recettes payées, en attente, dépenses, résultat net
- **Pré-déclaration TVA mensuelle** : sélection du mois → calcul automatique TVA collectée vs déductible par taux (8,5 %, 20 %, etc.) → solde à reverser estimé
- **Export CSV** : 3 boutons (factures, devis, dépenses) + 5 plages de période (YTD, année précédente, trimestre/mois précédent, période personnalisée)

Format CSV : séparateur point-virgule, UTF-8 BOM (Excel français-friendly), montants `1 234,56 €`, dates `JJ/MM/AAAA`. Compatible Pennylane, Sellsy, EBP, Quadra, Sage.

Page **/bilan** :

- Vue annuelle avec barres mensuelles (recettes vs dépenses)
- Bloc TVA estimée
- Bouton **Télécharger PDF** → bilan A4 portrait pour expert-comptable

---

# 5. Périmètre fonctionnel

## 5.1 Modules principaux

### A. Authentification

- **Magic link email** via Supabase Auth (lien sécurisé envoyé par email, sans mot de passe)
- Session persistante (cookies httpOnly)
- Déconnexion depuis Paramètres
- RLS PostgreSQL : chaque utilisateur ne voit que ses propres données

### B. Clients

- CRUD complet (nom, email, téléphone, adresse, SIRET si pro, notes, type B2B/B2C)
- Recherche en temps réel
- Auto-création depuis le flux vocal (si AVA entend un nom inconnu)
- Match flou : « Payet » trouve « M. Payet » et inversement
- Seed automatique de 3 clients de démo au premier login (pour ne pas afficher une page vide)

### C. Factures

- CRUD complet
- Lignes multiples (plusieurs prestations, taux de TVA mixtes)
- 4 statuts : brouillon, envoyée, payée, en retard
- Numérotation atomique (pas de race condition même en cas de double-tap)
- Export PDF mentions légales conformes
- Page publique partageable (URL signée HMAC)
- Bouton **Dupliquer** pour clients récurrents
- Auto-passage en `en_retard` chaque matin si échéance dépassée (cron quotidien)

### D. Devis

- CRUD complet
- 5 statuts : brouillon, envoyé, accepté, refusé, expiré
- Bouton **Convertir en facture** (échéance auto à +30j)
- Auto-passage en `expiré` chaque matin si date de validité dépassée

### E. Notes de frais (dépenses)

- CRUD complet
- 8 catégories : matériel, déplacement, sous-traitance, restauration, téléphonie, outillage, formation, autre
- **Photo OCR** (GPT-4o Vision) pour saisie ultra-rapide
- TVA déductible estimée

### F. Rendez-vous

- CRUD léger (titre, date+heure, durée, client, lieu)
- Reconnaissance des dates en français : « demain », « lundi prochain », « vendredi en huit »
- Affichage du jour sur la home

### G. Factures récurrentes

- Templates avec cadence (mensuel, bimestriel, trimestriel, semestriel, annuel, jours custom)
- Date de fin optionnelle
- Génération automatique chaque matin à 06:00 UTC

### H. AVA Conseillère (insights)

- Génération hebdomadaire chaque dimanche soir via Claude
- Analyse des 90 derniers jours
- Catégories : alerte, opportunité, observation
- Lecture vocale TTS sur chaque carte

### I. Relances

- Page dédiée `/relances` avec deux sections :
  - **En retard** (échéance dépassée, ton ferme)
  - **Échéance proche** (J-3 à J0, ton anticipateur)
- Bouton **Relancer** par ligne → mailto pré-rempli avec sujet, corps, lien public signé, signature

### J. Lien de paiement en ligne

- L'artisan colle son lien Stripe Payment Link / SumUp / PayPal.me / Lydia dans Paramètres une fois pour toutes
- Inclus automatiquement dans les emails `send_payment_link`

### K. Comptabilité & bilan

- Pré-déclaration TVA mensuelle (CA3-ready)
- Export CSV multi-périodes
- Bilan annuel HTML + PDF

### L. Voix d'AVA (TTS)

- Bouton ▶ sur tous les écrans qui affichent une réponse d'AVA
- Auto-lecture sur les intents de consultation (statut financier, insights, recherche)
- Voix « Shimmer » d'OpenAI, parlée à 95 % de la vitesse normale (clarté français)
- Toggle dans Paramètres pour désactiver l'auto-play

### M. PWA & offline

- Manifest pour installation sur l'écran d'accueil iOS/Android
- Service Worker pour mise en cache des assets statiques
- Page `/offline` propre (pas de mutations offline pour éviter les conflits de synchronisation)

## 5.2 Intentions vocales reconnues (15)

| Intent | Exemple |
|---|---|
| `create_invoice` | « Facture pour M. Payet, 3 heures à 55 € » |
| `create_quote` | « Devis Mme Hoarau, pose carrelage 25 m² à 45 € » |
| `mark_paid` | « M. Payet a payé » |
| `send_reminder` | « Relance Mme Hoarau » |
| `send_payment_link` | « Envoie le lien de paiement à M. Payet » |
| `send_document` | « Envoie la facture de M. Payet » |
| `find_document` | « Trouve la facture de M. Técher du mois dernier » |
| `sign_document` | « Demande la signature à Mme Grondin » |
| `get_financial_status` | « Qu'est-ce qui rentre cette semaine ? » |
| `get_invoice_list` | « Mes factures impayées » |
| `get_insights` | « Tes conseils » |
| `get_weekly_summary` | « Résume ma semaine » |
| `list_relances` | « Mes relances » |
| `schedule_appointment` | « RDV chez M. Payet vendredi à 14h » |
| `create_expense_note` | « J'ai acheté du carrelage chez Point P pour 340 € » |

---

# 6. Architecture technique

## 6.1 Stack

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend Web | Next.js 16 (App Router) + React 19 + TypeScript | App principale |
| Mobile iOS / Android | Capacitor 8 (wrap Next.js) | Distribution App Store / Play Store |
| Base de données | PostgreSQL (via Supabase) | Toutes les données métier |
| Authentification | Supabase Auth (magic link) | Login sans mot de passe |
| Stockage fichiers | Supabase Storage | (Réservé pour V2 — uploads scans) |
| Hébergement | Vercel (production = main, previews = PRs) | Déploiement automatique |
| CI / CD | GitHub Actions | Lint + build sur chaque push |
| Cron jobs | Vercel Cron | Tâches planifiées |
| Voice → texte | OpenAI Whisper API (`whisper-1`) | Transcription française |
| Intent extraction | Anthropic Claude Sonnet 4.5 | Comprendre la dictée |
| Photo OCR | OpenAI GPT-4o-mini Vision | Lecture des tickets |
| Voix de sortie | OpenAI TTS-1 (voix Shimmer) | AVA parle |
| PDF | @react-pdf/renderer (pure JS) | Factures, devis, bilan |
| Lookup SIRET | data.gouv recherche-entreprises | Auto-remplissage |

## 6.2 Schéma de données (simplifié)

11 tables, toutes avec RLS (Row Level Security PostgreSQL) — chaque utilisateur ne peut accéder qu'à ses propres lignes.

| Table | Contenu |
|---|---|
| `profiles` | Identité de l'artisan (nom, SIRET, IBAN, lien Stripe, prefs TTS, etc.) |
| `clients` | Carnet de clients |
| `invoices` | Factures (numéro, montants, statut, line_items en JSON) |
| `quotes` | Devis (idem invoices) |
| `expenses` | Notes de frais |
| `recurring_invoices` | Templates de factures récurrentes |
| `appointments` | Rendez-vous |
| `ava_actions` | Trace de chaque dictée vocale (idempotence + audit) |
| `notifications` | Bandeaux proactifs sur la home |
| `insights` | Conseils générés chaque dimanche |
| `auth.users` (Supabase) | Users + sessions |

## 6.3 Endpoints API

~30 endpoints REST (Next.js App Router). Exemples :

- `POST /api/transcribe` — audio → texte (Whisper)
- `POST /api/intent` — texte → intent JSON (Claude)
- `POST /api/actions/[id]/confirm` — exécute l'action après validation
- `POST /api/expense-from-photo` — photo → expense JSON (Vision)
- `POST /api/tts` — texte → audio (TTS)
- `GET /api/factures/[id]/pdf?public=1&t=...` — PDF facture
- `GET /api/bilan/pdf?year=YYYY` — PDF bilan annuel
- `GET /api/export?dataset=invoices&from=...&to=...` — CSV
- `GET /api/tva-monthly?month=YYYY-MM` — pré-déclaration TVA
- `GET /api/cron/recurring` — cron quotidien
- `GET /api/cron/weekly` — cron lundi (récap)
- `GET /api/cron/insights` — cron dimanche (insights)

## 6.4 Cron jobs

| Cron | Cadence | Rôle |
|---|---|---|
| `/api/cron/recurring` | Tous les jours à 06:00 UTC | Génère les factures récurrentes dues, marque les factures en retard, expire les devis périmés |
| `/api/cron/weekly` | Lundi à 07:30 UTC | Récap de la semaine en notification |
| `/api/cron/insights` | Dimanche à 18:00 UTC | Génère les insights AVA Conseillère |

Auth : header `Authorization: Bearer $CRON_SECRET` injecté automatiquement par Vercel quand la variable est définie.

## 6.5 Flux vocal détaillé

```
[App mobile/web]
  │
  ├── 1. Capture audio (MediaRecorder, format webm/opus)
  │
  ├── 2. POST /api/transcribe → OpenAI Whisper
  │       └─ Retour : transcript texte FR
  │
  ├── 3. POST /api/intent → Claude Sonnet 4.5
  │       └─ Retour : { intent, entities, confidence, ava_response }
  │
  ├── 4. Server-side enrichissement (selon intent)
  │       └─ Recherche client, agrégation totals, etc.
  │
  ├── 5. Insertion en base ava_actions (statut: pending)
  │
  ├── 6. Affichage écran /confirm/[id]
  │       └─ TTS optionnel : POST /api/tts → audio mp3 → lecture
  │
  └── 7. Sur validation : POST /api/actions/[id]/confirm
          ├─ Atomic claim (status pending → executing)
          ├─ Insertion réelle (invoice, quote, expense, etc.)
          └─ Redirection /success/[id]
```

Garde-fous :
- Timeout Whisper 25 s + retry une fois
- Timeout Claude 20 s + JSON validé par schema Zod
- Confidence < 0,5 → écran fallback avec formulaire manuel
- Idempotence : double-tap sur "Confirmer" ne crée pas deux factures
- Numérotation atomique avec retry sur conflit UNIQUE

---

# 7. Sécurité & conformité

## 7.1 Authentification & isolation

- **Pas de mot de passe** côté utilisateur (magic link uniquement)
- **RLS PostgreSQL** sur toutes les tables : `auth.uid() = user_id`
- Sessions stockées en cookies httpOnly + Secure
- Service role key Supabase jamais exposée côté client

## 7.2 URLs publiques signées

Les pages `/voir/facture/[id]` et `/voir/devis/[id]` sont accessibles sans authentification (pour permettre au client de consulter sa facture). Pour éviter qu'un UUID fuité ne donne accès à une facture, chaque URL contient un **token HMAC-SHA256** :

```
https://ava-lou.vercel.app/voir/facture/abc-123?t=<hmac-22-chars>
```

Mode souple (par défaut) : tokens manquants acceptés (compatibilité emails déjà envoyés).
Mode strict : `NEXT_PUBLIC_PUBLIC_URL_REQUIRE_TOKEN=true` rejette tout token manquant ou invalide.

## 7.3 Crons protégés

Les 3 endpoints cron exigent `Authorization: Bearer $CRON_SECRET`. Un appel sans le secret renvoie 401. Le secret est injecté automatiquement par Vercel.

## 7.4 Anti-injection CSV

L'export CSV préfixe d'un apostrophe toute valeur commençant par `=`, `+`, `-`, `@` ou tabulation, pour neutraliser les attaques de type formula injection (qui exécuterait du code dans Excel chez le comptable).

## 7.5 RGPD

- Données stockées en Europe (Supabase région `eu-west-3`, Paris)
- Service role key chiffrée en repos (Supabase)
- Aucune transmission tierce non documentée :
  - Whisper, Claude, GPT-4o, TTS : OpenAI/Anthropic, transit pour traitement, pas de stockage côté provider (zero-retention via plan API)
  - data.gouv : recherche-entreprises (open data, anonyme)
- Pages `/legal/cgu` et `/legal/privacy` complètes
- Suppression de compte sur demande (à formaliser V2)

## 7.6 Conformité facturation

- Numérotation chronologique sans trou (FAC-AAAA-XXX)
- Mentions L441-9 sur chaque facture
- Pénalités D441-5 + indemnité 40 €
- TVA intracommunautaire si fournie
- Médiateur consommation pour B2C
- Possibilité de mention « TVA non applicable, art. 293 B du CGI »
- Conservation 10 ans assurée par la base PostgreSQL

## 7.7 Points d'attention restants

- Activation du mode strict signed URLs (env var à flipper)
- Double opt-in sur le flag de consentement Whisper/Claude (audit P1) — actuellement les noms clients transitent
- Suppression de compte avec purge complète (RGPD art. 17)
- Audit log des actions sensibles (V2)

---

# 8. Identité visuelle

## 8.1 Direction artistique « Onde »

- **Palette** : warm bone (`#F4F3EE`), navy ink (`#0B1D33`), accent vert (`#1F9D55`), accent orange chaleureux (`#E87B3A`), pas de gradients
- **Bordures** : 1 px, hairline (`#E5E3DA`), pas d'ombres
- **Coins** : radius 14 px sur les cards, 12 px sur les inputs, 18 px sur les boutons
- **Polices** :
  - Titres : **Instrument Serif** (Google Fonts)
  - Texte courant : **Inter Tight** (self-hosted)
  - Chiffres : tabular numerals partout
- **Iconographie** : Lucide React, stroke 1,5 px
- **Pas d'emoji** dans le produit (sauf rare pour l'utilisateur)
- **Vouvoiement** systématique (tutoiement disponible en option mais déconseillé brand-wise)

## 8.2 Ton de voix

- Public-service français sobre
- Phrases courtes
- Aucun jargon administratif inutile
- Aucun marketing fluff
- Disclaimer toujours présent quand l'argent est en jeu : *« Brouillon — rien n'est envoyé sans votre accord. »*

---

# 9. Distribution

## 9.1 Web (production)

- **URL** : https://ava-lou.vercel.app
- **PWA installable** sur iOS Safari (Partager → Sur l'écran d'accueil) et Android Chrome
- Mises à jour : continues, automatiques à chaque push sur `main`

## 9.2 iOS (TestFlight)

- **Bundle ID** : `fr.digidatale.ava`
- **App Store Connect ID** : `6766485791`
- **Build courant** : 1.0 (1), expire le 2026-08-03
- **Min OS** : iOS 15.0
- Signing : Apple Distribution (cert valide jusqu'en mai 2027)
- Provisioning profile : « AVA App Store 2026-05-05 » (valide 1 an)

## 9.3 Android (Play Store)

- **Package ID** : `fr.digidatale.ava`
- Projet Android Capacitor prêt
- Pas encore publié — V2

---

# 10. Coûts d'exploitation

Estimations pour **100 utilisateurs actifs**, 50 dictées vocales/mois chacun :

| Poste | Coût mensuel estimé |
|---|---|
| Vercel Hobby (ou Pro 20 $/mois pour multi-tenant prod) | 0 → 20 $ |
| Supabase Free (jusqu'à 500 Mo + 2 Go bandwidth) | 0 → 25 $ |
| OpenAI Whisper (~0,006 $/min) — 100 users × 50 dictées × 30 s | ~15 $ |
| Anthropic Claude (~0,003 $ par intent) — 100 × 50 = 5 000 calls | ~15 $ |
| OpenAI GPT-4o-mini Vision (~0,001 $/photo) — 100 × 30 photos | ~3 $ |
| OpenAI TTS (~0,015 $/1k chars) — usage modéré | ~5 $ |
| **Total** | **~85 $/mois** |

Soit **~0,85 $ par utilisateur actif/mois** — sustainable à un prix d'abonnement de 9-15 €/mois par artisan.

---

# 11. Limites actuelles & roadmap

## 11.1 Ce qui est livré (V0 → V38)

- 38 versions itératives, 31 PRs mergées
- Voix bidirectionnelle complète
- 15 intents vocaux reconnus
- Photo OCR notes de frais
- PDF factures + devis + bilan
- CSV multi-périodes
- TVA mensuelle CA3-ready
- Page Relances avec mailto pré-rempli
- Wizard onboarding 3 étapes
- Lien de paiement Stripe/SumUp/PayPal
- TestFlight build VALID

## 11.2 Limites connues

- Pas d'envoi d'email automatisé serveur (aujourd'hui : mailto qui ouvre l'app email native du téléphone)
- Pas d'intégration Stripe Connect serveur (aujourd'hui : lien collé manuellement)
- Pas de notifications Push iOS/Android (aujourd'hui : badge notifications dans l'app uniquement)
- Pas de multi-utilisateur (un compte = un artisan ; pas de comptable invité en lecture)
- Pas d'OCR pour scanner un devis papier manuscrit (uniquement tickets imprimés)
- Pas de gestion de stocks / inventaire
- Pas d'intégration calendrier iOS/Google
- Pas de signature électronique des devis (le « Bon pour accord » est sur PDF, à signer à la main)

## 11.3 Roadmap V2 (priorité décroissante)

1. **Stripe Connect natif** : génération de Payment Link à chaque facture + webhook pour `mark_paid` automatique
2. **Email transactionnel via Resend** : envoi depuis ava@digidatale.com sans dépendre de l'app email
3. **Notifications Push** (iOS + Android) : facture payée, échéance approchante, RDV imminent
4. **Multi-utilisateur** : comptable invité en lecture, secrétaire en write limité
5. **OCR devis manuscrit** : scanner un brouillon papier → AVA crée un devis numérique
6. **Voice editing** : « modifie la dernière facture, change le montant à 200 € »
7. **Intégration calendrier** (Apple Calendar, Google Calendar) pour les RDV
8. **Signature électronique** des devis (DocuSign-like, mais simple)
9. **Insights V2** : prédictions de trésorerie sur 60 jours
10. **Internationalisation** : Belgique, Suisse, Québec

## 11.4 Hors-scope long terme

- ERP complet (logistique, RH, achats centralisés)
- Marketplace de prestations
- Comparateur de devis fournisseurs
- App de pointage / planning multi-employés

---

# 12. Glossaire

| Terme | Définition |
|---|---|
| **PWA** | Progressive Web App. Une page web qui peut s'installer sur l'écran d'accueil d'un téléphone et fonctionner comme une app native. |
| **TestFlight** | Outil d'Apple pour tester une app iOS avant publication officielle sur l'App Store. |
| **Capacitor** | Wrapper qui transforme une app web en app iOS/Android distribuable via les stores. |
| **Whisper** | API de reconnaissance vocale d'OpenAI, particulièrement bonne en français. |
| **Claude** | Modèle de langage d'Anthropic, utilisé pour comprendre les intentions de l'artisan. |
| **GPT-4o Vision** | Modèle d'OpenAI capable d'analyser des images (ici : tickets de caisse). |
| **TTS** | Text-to-Speech. Synthèse vocale qui transforme un texte en voix. |
| **RLS** | Row Level Security. Mécanisme PostgreSQL qui restreint chaque utilisateur à ses propres lignes au niveau base de données. |
| **HMAC** | Hash-based Message Authentication Code. Signature cryptographique qui prouve qu'une URL n'a pas été forgée. |
| **CA3** | Formulaire mensuel de déclaration de TVA en France (régime réel normal). |
| **DROM** | Départements et régions d'outre-mer (974, 976, 971, 972, 973, 978). TVA réduite à 8,5 %. |
| **L441-9** | Article du Code de commerce qui liste les mentions obligatoires sur les factures. |
| **D441-5** | Article qui fixe à 40 € l'indemnité forfaitaire de recouvrement en cas de retard. |
| **SIRET** | Identifiant à 14 chiffres unique de chaque établissement d'entreprise française. |
| **TVA intracommunautaire** | Numéro de TVA permettant les échanges B2B en Europe (préfixe FR). |
| **Magic link** | Lien à usage unique envoyé par email pour se connecter sans mot de passe. |
| **Brouillon** | État initial d'un document avant validation explicite. AVA respecte ce principe : rien n'est définitif sans accord. |

---

*Document généré le 6 mai 2026 à partir de la base de code AVA-Lou v0.38. Pour toute question : greg@gonnected.com.*
