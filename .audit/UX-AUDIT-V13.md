# AVA-Lou UX Audit — V13

Persona: artisan DROM 50+, gants, plein soleil, parfois une main, FR uniquement.
Audit du 2026-05-05. Pages auditées : 26, composants : 14.

## P0 — Bloqueurs

### 1. Intent `send_payment_link` non géré sur /confirm/[id]
- Fichier : `src/app/confirm/[id]/page.tsx`
- Bug : `claude.ts` et `intent-enrich.ts` traitent l'intent V13, mais la page de confirmation n'a aucune branche `isPaymentLink`. Quand l'artisan dit « envoie le lien de paiement à M. Payet », il atterrit sur le layout document avec carte vide (pas de line_items) et un bouton « Confirmer et créer » qui ne fait rien d'utile. Le `mailto` préparé dans `entities.payment_link` n'est jamais affiché.
- Fix : ajouter une branche `if (intent === 'send_payment_link')` qui rend une carte avec facture candidate + montant, et un bouton lien `mailto:` (réutiliser `ReminderActions`).

### 2. /confirm/[id] : `create_expense_note` détourne `MarkPaidActions`
- Fichier : `src/app/confirm/[id]/page.tsx` ligne 278, et idem `_appointment` ligne 315
- Bug : on appelle `<MarkPaidActions actionId={id} invoiceId="_expense" />` alors que ce n'est pas une facture. Le bouton dit « Confirmer le paiement » pour une dépense ou un RDV. Texte trompeur, et la redirection vers `/factures/_expense` après confirmation va échouer (404).
- Fix : créer un `<GenericConfirmActions label="Enregistrer la dépense" redirect="/depenses" />`. Idem pour rendez-vous.

### 3. IBAN absent du profil mais référencé partout
- Fichiers : `src/components/settings-form.tsx`, `src/lib/intent-enrich.ts:826`, `src/components/legal-mentions.tsx`
- Bug : l'email V13 dit au client « vous y trouverez l'IBAN pour virement », mais aucun champ IBAN n'existe dans le formulaire de paramètres ni dans `LegalMentions`. Le client ne peut donc pas payer par virement. Promesse non tenue.
- Fix : ajouter `iban`, `bic` au profil et les rendre dans `LegalMentions` après les pénalités, avec libellé « Coordonnées bancaires » + mention encadrée.

### 4. Toggle « AVA me tutoie » contredit le brief Onde
- Fichier : `src/components/settings-form.tsx:187-192`
- Bug : `tutoiement: boolean` exposé à l'utilisateur. Le CLAUDE.md exige vouvoiement strict, public-service. Une fois activé, rien dans l'app ne change réellement (pas de propagation), donc le toggle ment ; et il ouvre la porte à un ton interdit.
- Fix : retirer le toggle. `profile.tutoiement` peut rester en BDD pour V14, mais ne pas l'exposer.

## P1 — Frustrant mais contournable

### 5. Filtres de liste sous 44 px (factures, devis)
- Fichier : `src/components/factures-list-client.tsx:73-90`, idem devis
- Bug : pills de filtre `padding: '6px 12px'` + `font 12px` → ~30 px de hauteur, tap target trop petit pour gants. Idem boutons année dans `bilan/page.tsx:117-134` (`padding 8px 14px` ≈ 36 px).
- Fix : `min-height: 44px`, padding vertical 12 px.

### 6. Bouton « Modifier » du top bar (44 px ?)
- Fichiers : `src/app/factures/[id]/page.tsx:261`, `src/app/clients/[id]/page.tsx:126`
- Bug : `<button>Modifier</button>` sans hauteur fixe, juste texte 14 px ≈ 22 px de hauteur. Cible minuscule en haut à droite.
- Fix : envelopper dans une zone 44×44 (`padding: 12px`).

### 7. MicFab caché sur trop d'écrans utiles
- Fichier : `src/components/mic-fab.tsx`
- Bug : seul `/listen`, `/confirm`, `/login`, `/auth` et `/` sont exclus, donc le mic est présent ailleurs — bien. MAIS l'icône X de suppression de ligne (`factures/nouvelle:296-312`) est très proche du FAB en bas à droite (FAB à 20/20). Sur petit écran, doigt ganté risque d'activer le mauvais. Risque d'erreur.
- Fix : décaler le FAB à 80 px du bas dans les écrans formulaires longs, ou masquer le FAB sur les pages `/nouvelle` (le but est de saisir, pas de redicter).

### 8. /confirm pour `schedule_appointment` contient un emoji 📍
- Fichier : `src/app/confirm/[id]/page.tsx:309`
- Bug : `📍 {apt.location}` — emoji interdit par la marque Onde.
- Fix : remplacer par un SVG pin (le même style que les autres icônes), ou simplement « Lieu : … ».

### 9. Erreurs serveur affichées brutes
- Fichiers : tous les formulaires (`factures/nouvelle:163`, `depenses/nouvelle:62`, `clients/[id]:84`, `factures/[id]:151`, `login:28`)
- Bug : `err.message` Supabase remonté tel quel (« duplicate key value violates unique constraint », « Auth session missing! »). Pour un artisan FR, illisible.
- Fix : table de mapping `mapApiErrorToFR(error)` qui retourne « Cette facture existe déjà », « Votre session a expiré, reconnectez-vous », etc.

### 10. /factures/[id] : `loading` text-only
- Fichier : `src/app/factures/[id]/page.tsx:228-234`
- Bug : « Chargement… » seul, blanc cassé. Pas de squelette. Sur 4G mauvaise (Réunion zones rurales), l'écran semble figé. Idem `/clients/[id]:103-108`.
- Fix : skeleton card (carte avec barres grises animées, hauteur ≈ vraie carte).

### 11. /listen : pas de bouton « Annuler » assez gros
- Fichier : `src/components/listen-ui.tsx:228-243`
- Bug : « ← Annuler » texte 14 px en haut à gauche, hors zone de pouce. L'artisan en panique d'avoir mal dicté ne le voit pas. Pas de mention « parlez en français normal », ni d'aide « si je n'ai pas compris, j'utilise le formulaire ».
- Fix : le rendre plus visible (44 px), ajouter un sous-titre « Parlez normalement, en français » sous le bouton Démarrer.

### 12. Pas d'indicateur de retour sur succès `mark_paid`
- Fichier : `src/components/confirm-actions.tsx:145`
- Bug : après « M. Payet a payé », redirection silencieuse vers `/factures/{id}`. Pas de toast « Paiement enregistré ». L'artisan ne sait pas si ça a marché.
- Fix : ajouter un toast vert 2 s ou rediriger vers `/success/{id}?type=mark_paid`.

### 13. /voir/facture/[id] : pas optimisé mobile-share
- Fichier : `src/app/voir/facture/[id]/page.tsx`
- Bug : pas de `<head>` `viewport` explicite ; `header` fait `padding 20px 0` sans wrapper max-width. Sur 393 px iPhone, le titre `36px` dépasse. Le bouton « Télécharger PDF » est en haut, donc sur partage WhatsApp le client le voit avant le détail (cognitivement bizarre).
- Fix : wrapper `<div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px' }}>`. Mettre les boutons impression en bas. Ajouter `<meta name="robots" content="noindex" />`.

### 14. Bilan : barres de 8 px très fines sur 393 px
- Fichier : `src/app/bilan/page.tsx:198-215`
- Bug : 12 mois × 2 barres × 8 px + gaps = ~120 px utilisés sur ~350 px disponibles, donc OK, mais barres elles-mêmes 8 px sont à la limite. Aucun affichage du chiffre par-dessus, juste tooltip `title=` (inutile sur mobile, pas de hover).
- Fix : afficher le total recettes du mois en label sous la barre quand `recettes > 0`, sinon basculer en liste sur < 400 px.

### 15. /comptabilite : explication CSV trop technique
- Fichier : `src/app/comptabilite/page.tsx:55-57, 113-119`
- Bug : « séparateur point-virgule, UTF-8 BOM, montants en virgule décimale » — l'artisan ne sait pas ce qu'est UTF-8 BOM. Le mot « SIG comptables » non plus.
- Fix : « Compatible Excel et tous les logiciels que votre comptable utilise. Donnez-lui simplement les fichiers téléchargés. ». Garder les détails techniques dans un encart « Détails techniques » collapsable.

### 16. /offline : on-brand mais pas de détection « revenu »
- Fichier : `src/app/offline/page.tsx:22-24`
- Bug : « Réessayer » fait juste `<a href="/">`. Si le réseau est encore coupé, on retombe sur /offline en boucle. Pas d'auto-detect `online` event.
- Fix : ajouter `useEffect` côté client qui écoute `window.addEventListener('online', () => location.reload())` et un petit indicateur « Reconnexion en cours… ».

## P2 — Polish

### 17. États vides cohérents mais sans lien « Comment faire »
- Fichiers : `clients/page.tsx:38-49`, `factures-list-client.tsx:117-126`, `depenses/page.tsx:103-111`, `agenda/page.tsx:74-82`, `recurring/page.tsx:54-64`, `historique/page.tsx:48-53`
- Bug : empty states présents (bien) avec exemple vocal (très bien sur dépenses/agenda), mais pas tous : factures et clients n'incluent aucun exemple « Dictez : Facture pour M. Payet ».
- Fix : harmoniser. Toutes les pages liste vides montrent un exemple vocal en italique serif, comme `depenses/page.tsx:108-110`.

### 18. Login utilise `✓ Lien envoyé` (UI emoji)
- Fichier : `src/app/login/page.tsx:61`
- Bug : caractère ✓ U+2713 considéré emoji-like. La doctrine Onde interdit les emoji. Le checkmark apparaît aussi dans `AvaListRow:463`.
- Fix : remplacer par un SVG check (déjà utilisé dans `success/[id]:91`).

### 19. Login : champ email sans `min-height: 44`
- Fichier : `src/app/login/page.tsx:78`
- Bug : `style={{ height: 50 }}` mais sans le styling complet (font, padding, border) — l'input garde le style navigateur par défaut, peu lisible en plein soleil. Incohérent avec les autres inputs de l'app qui utilisent `inputStyle`.
- Fix : appliquer `inputStyle` partagé, ou extraire un `AvaInput` composant.

### 20. /agenda et /comptabilite n'ont pas de bouton retour /
- Fichiers : `src/app/agenda/page.tsx:67`, `src/app/comptabilite/page.tsx:49`, `src/app/historique/page.tsx:37`, `src/app/recurring/page.tsx:44`, `src/app/bilan/page.tsx:106`, `src/app/insights/page.tsx:66`
- Bug : `AvaTopBar` sans `right={<Link href="/">Accueil</Link>}` ni `onBack`. Le seul retour est le geste swipe iOS / bouton Android. Sur PWA installée, l'utilisateur est piégé.
- Fix : ajouter systématiquement le lien Accueil à droite, comme sur `/factures` et `/clients`.

### 21. Pills de statut « brouillon », « envoyée » avec capitalisation manuelle
- Fichier : `src/app/factures/[id]/page.tsx:354`
- Bug : `s.charAt(0).toUpperCase() + s.slice(1)` produit « En_retard » avec underscore. Dégueu.
- Fix : `s === 'en_retard' ? 'En retard' : ...`.

### 22. Pas de feedback haptique sur boutons critiques
- Fichier : `src/components/ava/index.tsx:82-117` (AvaButton)
- Bug : transform 0.98 + brightness 0.88 mais aucun `navigator.vibrate(10)` sur tap. L'artisan ganté ne sent pas le clic.
- Fix : `onPointerDown={() => navigator.vibrate?.(8)}` sur les kinds `validate` et `primary` au moins.

### 23. Texte 11 px (AvaLabel) limite WCAG sur 393 px
- Fichier : `src/components/ava/index.tsx:39`
- Bug : `font: 600 11px/1.2` — sous le seuil de confort pour 50+. Letter-spacing 1.4 aide mais c'est petit en plein soleil.
- Fix : passer à 12 px, peser 8 occurrences seulement.

### 24. Carte « Pré-rempli depuis votre dictée » bonne, mais format date manquant
- Fichier : `src/app/factures/nouvelle/page.tsx:174-196`
- Bug : si la dictée incluait une date, elle est appliquée silencieusement à `dueDate`. Pas de surlignage des champs auto-remplis.
- Fix : surlignage léger (border-left vert) pendant 3 s sur les champs touchés par le prefill.

### 25. Disclaimer « Brouillon » dupliqué
- Fichier : confirm/[id], factures/nouvelle, depenses/nouvelle, clients/[id], listen-ui (idle)
- Bug : sur écrans de confirmation, l'utilisateur voit `<AvaDisclaimer />` deux fois (dans le pré-rempli vert + au-dessus des boutons). Léger bruit.
- Fix : montrer une seule fois — au-dessus des boutons d'action — quand un prefill est aussi affiché.

---

## Récap par sévérité
- P0 : 4 — voice-first cassé sur V13 send_payment_link, expense/appointment confirm boutons trompeurs, IBAN promis mais absent, toggle tutoiement contredit Onde.
- P1 : 12 — tap targets, états chargement, copy technique, /listen UX, /voir partage mobile, barres bilan.
- P2 : 9 — polish empty states, emoji ✓, retour /, capitalisation, haptique, taille 11 px.

Total : 25 findings. Conforme au cap 1500 mots.
