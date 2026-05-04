# AVA-Lou

**Assistance Vocale Administrative** pour les artisans des DROM.
PWA voice-first où l'artisan parle, AVA structure, et la facture s'écrit toute seule.

> _Direction "Onde" · service public moderne · sobre, lisible plein soleil._

🚀 **Production** : https://ava-lou.vercel.app

---

## V0 (livrable J+1)

- **Auth** : magic link email via Supabase Auth
- **CRUD** : Clients, Factures, Devis (numérotation auto `FAC-2026-XXX`)
- **Flux vocal** : `/listen` → MediaRecorder + waveform live → OpenAI Whisper (fr) → Anthropic Claude Sonnet 4.5 (extraction d'intent + entités) → écran de confirmation `AVA a compris :` → INSERT Supabase
- **Dashboard** : KPIs trésorerie (à encaisser, en retard, encaissé ce mois)
- **PWA installable** : manifest + icônes 192/512
- **Design system Onde** : tokens, fonts, primitives portées en TSX

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
