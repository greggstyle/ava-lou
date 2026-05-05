# AVA — App Store metadata

Tout le contenu marketing pour App Store Connect, voix Onde sobre service public.

---

## Nom de l'app (max 30 caractères)

```
AVA — Assistance Vocale
```

(28 caractères, point médian compatible)

## Sous-titre (max 30 caractères)

```
Factures vocales pour artisans
```

(29 caractères)

## Promotional Text (max 170 caractères, modifiable sans soumission)

```
Dictez « facture pour M. Payet, 3 heures à 55 € ». AVA structure, vous validez. Conforme à la loi française. Pensé pour les artisans de La Réunion.
```

(146 caractères)

## Description (max 4000 caractères, voix Onde)

```
AVA est l'assistance vocale administrative des artisans français. Dictez, AVA structure. Validez d'un geste, c'est facturé.

— Voice-first, calme, lisible plein soleil.

CE QUE VOUS DITES, AVA LE FAIT
• « Facture pour M. Payet, 3 heures de plomberie à 55 € » → facture créée
• « Devis Mme Hoarau, pose carrelage 25 m² à 45 € » → devis prêt à envoyer
• « Qu'est-ce qui rentre cette semaine ? » → trésorerie en direct
• « M. Payet a payé » → facture marquée payée
• « Relance Mme Hoarau » → email de relance courtois rédigé
• « RDV vendredi 14h chez M. Técher » → ajouté à l'agenda
• « J'ai acheté du matériel chez Point P pour 340 € » → note de frais

CONFORME À LA LOI FRANÇAISE
AVA respecte les mentions obligatoires de l'article L441-9 du Code de commerce :
• Numérotation séquentielle automatique (FAC-2026-XXX)
• Mentions vendeur et acheteur complètes (SIRET, adresse, forme juridique)
• Calcul TVA par taux, total HT par taux
• Pénalités de retard et indemnité forfaitaire de 40 € (art. D441-5)
• Mention « TVA non applicable, art. 293 B du CGI » pour auto-entrepreneurs
• Médiateur de la consommation pour B2C (art. L612-1)

AUTOCOMPLÉTION DATA.GOUV
Renseignez votre SIRET (ou celui d'un client professionnel), AVA va chercher vos infos sur la base Sirene de l'INSEE : raison sociale, adresse, code NAF, forme juridique. Plus de saisie manuelle.

PENSÉ POUR LE TERRAIN
• Boutons larges, lisible plein soleil de Réunion
• Vouvoiement par défaut, jamais d'emoji parasite
• Disclaimer « Brouillon — rien n'est envoyé sans votre accord » sur tout écran qui touche à l'argent
• Vos clients reçoivent un lien partageable de la facture, ils l'impriment ou l'enregistrent en PDF
• Mode confirmation : double-tap impossible de créer deux factures

PROACTIVE LE LUNDI MATIN
AVA scanne vos impayés et devis sans réponse. Le lundi à 7h30 elle vous propose : « 2 factures en retard pour 612 €, 1 devis sans réponse depuis 14 jours. Voulez-vous lancer les relances ? » Un tap, c'est fait.

VOTRE TRÉSORERIE EN UN COUP D'ŒIL
• À encaisser, en retard, encaissé ce mois (delta vs mois dernier)
• Top 5 clients en retard avec montants
• Bilan net mensuel : recettes − dépenses
• Catégories de dépenses : matériel, déplacement, sous-traitance, restauration, téléphonie, outillage, formation

CONFIDENTIALITÉ
• Hébergement Supabase région UE (Paris)
• Audio supprimé après transcription
• RLS Postgres : chaque artisan ne voit que ses propres données
• Pas de tracker publicitaire, pas de cookies tiers
• Conforme RGPD

AVA est une V0 destinée aux tests utilisateurs. Pour la facturation électronique obligatoire 2026/2027, AVA passera par une Plateforme Agréée certifiée (Pennylane).

Politique de confidentialité : https://ava-lou.vercel.app/legal/privacy
Conditions d'utilisation : https://ava-lou.vercel.app/legal/cgu

Contact : greg@gonnected.com
```

(2853 caractères)

## Mots-clés App Store (max 100 caractères, séparés par virgules)

```
facturation,artisan,devis,vocal,whisper,dictée,DROM,Réunion,plomberie,électricité,bâtiment,trésorerie
```

(99 caractères)

## Catégorie principale

**Business** (Affaires)

## Catégorie secondaire (optionnelle)

**Productivity** (Productivité)

## Classification d'âge

**4+** (aucun contenu sensible)

## Confidentialité — Privacy Nutrition Label

À déclarer dans App Store Connect → App Privacy :

### Données utilisées pour suivre l'utilisateur
**Aucune** — pas de tracking publicitaire, pas d'identifiants partagés.

### Données collectées et liées à l'utilisateur
- **Nom** (profil + signature email)
- **Adresse email** (compte + correspondance)
- **Adresse postale** (mentions légales factures)
- **Identifiants utilisateur** (UUID Supabase)
- **Données financières** : montants, factures, dépenses (cœur métier)
- **Contacts** : noms et emails des clients que l'artisan saisit
- **Audio** (temporaire, supprimé après transcription)

### Données collectées et NON liées à l'utilisateur
**Aucune.**

### Finalités
- **App Functionality** (exécution du service de facturation)
- **Analytics** : aucun
- **Product Personalization** : oui (apprend les clients/tarifs récurrents pour suggérer)
- **Developer's Advertising or Marketing** : aucun
- **Other Purposes** : aucun

## URLs requises

- **Privacy Policy URL** : `https://ava-lou.vercel.app/legal/privacy`
- **Marketing URL** (optionnel) : `https://ava-lou.vercel.app`
- **Support URL** : `https://ava-lou.vercel.app/legal/cgu` (en attendant un vrai support center)

## Coordonnées

- **Contact** : Gregory Hanffou
- **Email** : greg@gonnected.com
- **Téléphone** : (à renseigner)
- **Adresse** : 55 chemin Fernand Collardeau, Ravine des Cabris, 97432 Saint-Pierre, France

## Version & Build

- **Version** : 1.0
- **Build** : 1
- **Copyright** : 2026 DigiDataLe / Gregory Hanffou
- **Trade representative contact information** : non requis (DROM = France)

## Screenshots

Voir `marketing/screenshots/` — 6 mockups Onde aux dimensions iPhone 6.7" (1290 × 2796 px).
