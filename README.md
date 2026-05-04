# AVA-Lou

**Assistance Vocale Administrative** pour les artisans des DROM.
PWA voice-first où l'artisan parle, AVA structure, et la facture s'écrit toute seule.

> _Direction "Onde" · service public moderne · sobre, lisible plein soleil._

🚀 **Production** : https://ava-lou.vercel.app

---

## Versions

### V0 — fondations
- Magic-link auth, CRUD Clients/Factures/Devis, dashboard, PWA, design Onde
- Flux vocal : MediaRecorder → Whisper (fr) → Claude Sonnet → confirm → INSERT

### V0.7 — conformité française
- Mentions légales art. L441-9 + R441-3 (composant `<LegalMentions />`)
- SIRET autocomplete via recherche-entreprises.api.gouv.fr
- 5 fixes P0 audit (idempotency, TVA DROM, mic gesture, escape hatch, VAT 5,5%)
- Capacitor iOS + Android (shell natif chargeant la prod web)

### V1 — robustness + page publique
- `/voir/facture/[id]` + `/voir/devis/[id]` : URL partageable imprimable PDF
- Whisper 25s timeout + retry, Claude 20s timeout + retry, zod-validated response
- Whisper failure preserves blob (Renvoyer = re-POST same blob)
- Match client fuzzy (exact → %name% → reverse-substring)

### V2 — voice intents avancés
- `mark_paid` : « M. Payet a payé »
- `get_financial_status` : « Qu'est-ce qui rentre ? » (4 KPI cards live)
- `send_reminder` : « Relance Mme Hoarau » (drafts polite email + mailto)
- `get_invoice_list`, `find_document`, `send_document`

### V3 — dashboard intelligence + historique
- Dashboard : delta mois vs mois dernier, top 5 clients en retard, activité récente
- Page `/historique` (100 dernières actions vocales)
- Dictation tips sur `/listen` idle screen

### V3.5 — proactivité
- Vercel cron lundi 7h30 (`/api/cron/weekly`) → notifications `weekly_recap`
- Bannière "AVA vous suggère" sur la home
- PWA install hint (iOS-aware, dismissible)
- Prompt Claude calibré avec 7 exemples DROM concrets

## Stack

| Couche | Choix |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript + Turbopack |
| Styles | CSS variables Onde + Tailwind v4 (utilitaires layout uniquement) |
| Fonts | Instrument Serif (display) + Inter Tight (UI) |
| DB / Auth / Storage | Supabase (Postgres + RLS + Auth) |
| STT | OpenAI Whisper (`whisper-1`, fr) |
| LLM intent | Anthropic Claude Sonnet 4.5 |
| Hosting | Vercel |

## Démarrage local

```bash
pnpm install
cp .env.example .env.local   # remplir avec vos clés
pnpm dev                     # http://localhost:3000
```

## Variables d'environnement

| Var | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé publique Supabase (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | clé secrète server-only (`sb_secret_...`) |
| `OPENAI_API_KEY` | clé OpenAI (Whisper) |
| `ANTHROPIC_API_KEY` | clé Anthropic (Claude) |
| `NEXT_PUBLIC_DEFAULT_GREETING` | prénom par défaut pour le greeting AVA (ex: `Lou`) |
| `NEXT_PUBLIC_SITE_URL` | URL canonique du déploiement (ex: `https://ava-lou.vercel.app`) |

## Schéma DB

Migrations SQL dans `supabase/migrations/0001_init.sql` — à coller dans l'éditeur SQL Supabase au premier déploiement.

Tables : `profiles`, `clients`, `invoices`, `quotes`, `ava_actions`. RLS partout (`auth.uid() = user_id`). Trigger auto-création de profil sur signup.

## Architecture du flux vocal

```
[/]                  greeting + suggestion + récents + mic dock
 │ tap mic
[/listen]            full-screen navy, waveform live (AnalyserNode RMS),
 │                   timer Instrument Serif, auto-stop 30s
 │ relâche → POST audio.webm
[/api/transcribe]    OpenAI Whisper → texte
 │ POST {text}
[/api/intent]        Claude Sonnet 4.5 + contexte (clients récents + TVA défaut)
 │                   → {intent, entities, confidence, ava_response}
 │                   → INSERT ava_actions {status:pending}
[/confirm/[id]]      "AVA a compris :" + reformulation + total + disclaimer
 │ confirme
[/api/actions/[id]/confirm]
 │                   → switch(intent): create_invoice | create_quote
 │                   → find_or_create client + computeTotals + INSERT
[/success/[id]]      ✓ Facture créée + auto-redirect 4s
```

## Éléments du design system Onde

- Tokens : `src/app/globals.css` (importé de `colors_and_type.css`)
- Primitives TSX : `src/components/ava/index.tsx`
- Assets : `public/assets/` (logo, waveform mark, mic icon) — copiés depuis le bundle Onde

## Configuration Supabase Auth (à faire après le premier déploiement)

Dans le dashboard Supabase → **Authentication → URL Configuration** :

- **Site URL** : `https://ava-lou.vercel.app`
- **Redirect URLs** (allow list) :
  - `https://ava-lou.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (pour dev local)
  - `https://*.vercel.app/auth/callback` (pour les previews)

Sans ça les magic links redirigent vers `localhost` par défaut.

## Roadmap V1

- Pennylane integration (envoi facture réel via PA certifiée)
- Notifications push (relances impayées, devis sans réponse)
- Mode hors-ligne (PWA + IndexedDB)
- ElevenLabs TTS (voix AVA personnalisée)
- WhatsApp Business (BSP Twilio)
- Wake word "Salut Ava" (Picovoice on-device)

## Ressources

- Cahier des charges : `AVA_CdC_Vision_Complete.docx` (chemin parent)
- Design system : `AVA Onde Design System` (zip parent)
- Mockups HTML : `AVA Voice-First.html` (Direction A · Onde uniquement)
