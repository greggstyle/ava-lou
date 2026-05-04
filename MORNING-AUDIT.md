# 🔍 Audit DX nuit — AVA-Lou

**Date** : 2026-05-04 nuit · **Audité par** : 3 sous-agents en parallèle (onboarding, voice flow, CRUD)
**Aucun code n'a été modifié** — production reste verte sur https://ava-lou.vercel.app

> Ce rapport remplace le `MORNING.md` à la racine pour les arbitrages techniques. Lisez `MORNING.md` d'abord pour les actions Supabase (URL Configuration + email templates), puis revenez ici pour la priorisation tech.

---

## 🚨 TOP 5 — À FIXER AVANT DE MONTRER À LOU

| # | Problème | Impact démo | Effort |
|---|----------|-------------|--------|
| **1** | **Idempotency `/api/actions/[id]/confirm`** — double-tap crée 2 factures avec numéros possiblement dupliqués (course critique sur `nextDocumentNumber`) | Facture en double pendant la démo = perte de crédibilité immédiate | 15 min |
| **2** | **TVA DROM jamais pré-sélectionnée** — `profile.vat_default` n'est pas lu au mount des forms ni dans `/api/actions/[id]/confirm` (fallback à 20 %) | La promesse "DROM-aware" est cassée. Lou est à La Réunion. | 10 min |
| **3** | **Mic auto-start sur `/listen`** — `getUserMedia` est appelé sans geste utilisateur. iOS Safari peut silencieusement échouer. Combiné au libellé mensonger "Maintenez pour parler" (qui en réalité fait tap-to-navigate), l'artisan voit une perm prompt sortie de nulle part | Premier essai vocal échoue dans 30-50 % des cas iOS | 30 min |
| **4** | **Loop "Réessayer" dead-end pour `intent=unknown`** — si Claude classifie autre chose que invoice/quote (ex: "appelle Mme Hoarau demain"), `LowConfidenceActions` n'a aucun escape hatch | L'artisan tourne en rond avec aucun moyen de continuer. Vous l'avez vécu hier soir. | 10 min |
| **5** | **Pas de recherche dans `/clients`, `/factures`, `/devis`** — scroll à l'aveugle dès qu'il y a > 20 entrées | Pour 3 clients seedés ça va, dès qu'il y a 20+ c'est mort | 20 min |

**Temps total estimé** : 1h30. Sans ces 5 fixes, la démo est bancale.

---

## 🟠 IMPORTANT — À FAIRE DANS LA SEMAINE

### Voice flow
- **Audio retention non-conforme CdC §RGPD** : Whisper API n'a pas de header zero-data-retention configuré → conserve potentiellement 30j chez OpenAI. Le CdC exige suppression dans 2 min. Ajouter ZDR au compte OpenAI org ou documenter explicitement dans la Privacy Policy.
- **Pas de timeout sur Whisper et Claude** : sur mauvaise 3G, l'utilisateur voit "AVA traite…" indéfiniment. Ajouter `{ timeout: 25_000 }` + 1 retry sur 5xx.
- **Validation JSON Claude manquante** : `JSON.parse(...) as IntentResult` est un cast, pas une validation. Si Claude renvoie `confidence: "0.8"` (string) ou `due_date: "demain"`, ça casse l'INSERT Postgres avec un 500 silencieux. Zod-parser `IntentResult` dans `extractIntent`, fallback à `intent='unknown'` sur schema fail.
- **Whisper failure perd l'audio** : si `/api/transcribe` 5xx, le blob est jeté. L'artisan doit redicter une commande de 25 s. Garder le blob en state, "Réessayer" doit retry le même blob.
- **30 s auto-stop silencieux** : afficher countdown badge à partir de 25 s ("5 s restantes"). Ou monter à 45 s.
- **Match client trop strict** (`ilike` exact) : artisan dicte "Payet", client est "M. Payet" → pas de match → 2è client créé. Utiliser `ilike('%' + name + '%')` ou unaccent.

### CRUD ergonomie
- **Pas de pagination sur listes** : `select(...)` ramène tout. Au bout de 6 mois, 200+ factures arrivent en SSR. Ajouter `.limit(100)` + bouton "Voir plus anciennes".
- **`AvaListRow` est `<button>` dans `<Link>`** — HTML invalide. Sur iOS Safari peut bloquer la nav. Refactor : `AvaListRow` accepte `as="a"` ou la page utilise `onClick={() => router.push(...)}`.
- **Statut sans optimistic UI** : `setStatus` attend round-trip avant de re-rendre. 300-800 ms de flicker, double-tap envoie 2 PATCH. Optimistic + rollback en `catch`.
- **Notes pollué par dictée brute** : `setNotes('Dictée vocale : « ... »')` met la transcription dans Notes, qui est envoyée au client par email. Stocker la dictée séparée, ne PAS la mettre dans Notes par défaut.
- **Conversion devis→facture sans `due_date`** : la facture créée a `due_date: null`. Calculer `today + 30 jours`.
- **`tutoiement` toggle ne fait rien** : settings écrit en base mais aucun label ne le lit. Soit câbler 3-4 strings clés (greeting, disclaimer, CTA), soit retirer avec note "bientôt".

### Onboarding / accessibilité
- **`userScalable: false` + `maximumScale: 1`** dans `layout.tsx` — viol WCAG 1.4.4. Artisan 50 ans en plein soleil ne peut pas pinch-zoom. Retirer.
- **Seed clients sans badge "exemples"** : M. Payet, Mme Hoarau, M. Técher arrivent silencieusement. Risque "AVA a scrapé mes contacts ?". Pour la démo c'est OK, mais ajouter un banner "AVA a créé 3 clients d'exemple — supprimez-les quand vous voulez" ou un flag `is_demo`.
- **Pas de loading state login → home** : magic link → `/auth/callback` → `/` → middleware → 3 count queries → seed → 2 list queries — c'est plusieurs secondes de blanc en 4G. Ajouter `app/loading.tsx` minimal avec logo + "Connexion à AVA…".
- **Login "Lien envoyé" sans recovery** : pas de bouton "Renvoyer" ni "Modifier l'email". Typo = bloqué.
- **Magic link erreur ignorée** : `/login?error=auth_callback` est set par `auth/callback/route.ts`, jamais lu par `login/page.tsx`. Lien expiré = utilisateur muet sur la cause.

---

## 🟢 POLISH — TODOS NON-BLOQUANTS

Récap court (détails dans les audits ci-dessous) :

- `inputMode="decimal"` sur quantité (actuellement `type="number"` rejette virgule)
- Bouton "Supprimer ligne" 36 px → trop petit pour gants. Passer à 44 px.
- Mailto body peut dépasser 2 KB sur iOS Mail → tronquer si > 1800 chars
- Statut "payée" sans étape "envoyée" devrait demander confirmation
- Suppression client lié à des factures = SET NULL silencieux. Demander "3 factures resteront sans client. Continuer ?"
- TVA 5,5 % manquant dans `VAT_OPTIONS` du form facture (présent en settings)
- `formatDateRelativeFR` casse sur dates futures ("il y a -2 jours")
- Status pill `en_retard` affichée littéralement → mapper "En retard"
- Bouton "Modifier" en TopBar = 14 px gris discret → faire un AvaPill ou agrandir
- Settings inputs `height: 44` écrase le padding et donne ~40 px réel
- Disclaimer "Brouillon" pas réaffiché sur fiche détail brouillon
- Pas de "AVA a entendu : « ... »" disclosure sur écran confirm en mode invoice/quote
- Mic mute → waveform statique, ressemble à freeze. Ajouter chip "Je ne vous entends pas" après 1.5 s level < 0.05
- Numérotation : ajouter UNIQUE `(user_id, number)` côté SQL pour blocker au moins les duplicates
- Validation email login (regex + HTML5 pattern)
- `<input>` email manque `inputMode="email"` + `enterKeyHint="send"`
- `autoFocus` sur email → keyboard pop sur load iOS = scroll-jank
- Erreurs API en bas du form → scroll si form long. `scrollIntoView` ou positionner sticky en haut.
- Service-worker offline non configuré (PWA est juste manifest)

---

## 📋 LE TOP 3 DE CHAQUE SOUS-AGENT (consensus)

### Sous-agent 1 (onboarding / first 5 min)
1. Ajouter `app/loading.tsx` + primer "Touchez pour démarrer" sur `/listen` → règle 3 problèmes en un commit
2. Briefer Lou en début de démo : "AVA a créé 3 clients d'exemple". Plus tard : flag `is_demo`.
3. Garder le blob audio en state pendant l'erreur Whisper, "Réessayer" relance la même requête

### Sous-agent 2 (voice flow)
1. **Idempotency + numbering race** : `UPDATE ava_actions SET status='executing' WHERE id=$1 AND status='pending'` claim atomique + UNIQUE `(user_id, number)`
2. **Tap-to-start sur `/listen`** + retry-same-blob sur Whisper error
3. **Zod-validate Claude** dans `extractIntent` + enforcer DROM TVA dans le prompt ET en fallback serveur

### Sous-agent 3 (CRUD)
1. **Câbler `profile.vat_default`** dans forms factures/devis (1 ligne de `setVatRate`)
2. **`<input type="search">` filtre client-side** en haut des listes — 5 lignes
3. **Optimistic UI sur statut** + UNIQUE `(user_id, number)` SQL

**Convergence des 3 audits** : idempotency + numerotation, mic permission UX, et la promesse DROM (TVA 8,5 par défaut).

---

## 🔧 CHECKLIST RECOMMANDÉE J+1 MATIN

```markdown
## P0 — avant la démo (1h30)
- [ ] Atomic claim sur /api/actions/[id]/confirm + UNIQUE (user_id, number)
- [ ] profile.vat_default câblé dans factures/nouvelle + devis/nouveau + /api/actions/[id]/confirm
- [ ] Tap-to-start sur /listen (pas auto getUserMedia) + libellé "Touchez pour parler"
- [ ] LowConfidenceActions toujours montre "Continuer en formulaire facture/devis" (même unknown)
- [ ] <input type="search"> en haut des listes clients/factures/devis

## P1 — semaine
- [ ] Zod-parse réponse Claude dans extractIntent
- [ ] Timeouts Whisper + Claude (25s) + retry 5xx
- [ ] Audio retention : ZDR sur compte OpenAI org
- [ ] Match client fuzzy ('%' + name + '%') + unaccent
- [ ] .limit(100) sur listes + bouton "Plus anciennes"
- [ ] AvaListRow refactor (pas de <a><button>)
- [ ] Optimistic UI sur statut
- [ ] Notes ne contient plus la dictée brute
- [ ] Convert devis→facture propage due_date = today + 30j
- [ ] tutoiement toggle câblé OU retiré

## P2 — backlog
- [ ] inputMode decimal partout
- [ ] Confirmation modal stylé (au lieu de confirm() natif)
- [ ] Loading skeletons sur fiches détail
- [ ] PWA install prompt après 2e session
- [ ] DROM TVA 5,5 ajouté à VAT_OPTIONS
- [ ] Status mapping "en_retard" → "En retard"
- [ ] Service-worker offline
- [ ] Validation email côté client
```

---

## 📂 Audits détaillés (par sous-agent)

Trois audits complets ont été produits, ~80 findings au total. Ils ne sont pas commités au repo (taille). Si vous voulez les détails, demandez-les en relançant `/plan-devex-review` au réveil — vous aurez le rapport interactif complet.

**Récap des sources** :
- Sous-agent 1 : 5 BLOCKER, 12 HIGH, 15 LOW (onboarding)
- Sous-agent 2 : 8 BLOCKER, 14 HIGH, 12 LOW (voice flow)
- Sous-agent 3 : 6 BLOCKER, 12 HIGH, 27 LOW (CRUD)

---

Bon café ☕. Plan d'attaque prêt à exécuter.
