# Sirene autocomplete (data.gouv.fr)

AVA enrichit les profils et les fiches clients via l'API publique
**recherche-entreprises.api.gouv.fr** (open data INSEE Sirene, sans clé API,
~7 req/sec/IP).

## Endpoints

- `GET /api/lookup/siret?siret=12345678901234` — lookup exact par SIRET (14 chiffres)
- `GET /api/lookup/siret?q=nom+entreprise` — recherche fuzzy par nom (max 5 résultats)

Les deux requièrent une session authentifiée (sinon 401).

## Champs retournés

```ts
{
  siret: string;              // 14 chiffres
  siren: string;              // 9 chiffres
  denomination: string;       // raison sociale ou nom complet
  legal_form: string | null;  // code INSEE nature_juridique brut (ex '5499')
  legal_form_label: string | null;  // mappé : 'auto-entrepreneur' | 'SARL' | 'SAS' | 'SASU' | 'EURL'
  naf_code: string | null;    // ex '4321A'
  naf_label: string | null;   // ex "Travaux d'installation électrique"
  address: string | null;
  postal_code: string | null;
  city: string | null;
  is_active: boolean;         // établissement encore actif
  is_individual: boolean;     // entrepreneur individuel / auto-entrepreneur
}
```

## Usage UI

**Settings (`/parametres`)** : champ SIRET + bouton "Vérifier" → auto-remplit
`company_name`, `address`, `postal_code`, `city`, `naf_code`, `legal_form`.
Si `is_individual=true`, active aussi `tva_franchise=true` (mention 293 B).

**Fiche client (`/clients/nouveau` et `/clients/[id]`)** : toggle
"Client professionnel" → champ SIRET + "Rechercher" → auto-remplit
`company_name`, `address`, `postal_code`, `city`. Le champ `name` (contact)
reste libre.

## Fallback

- Si Sirene retourne 503 (service indispo) ou 404 (SIRET introuvable), l'artisan peut toujours saisir manuellement.
- Tous les champs auto-remplis restent éditables après import.
- Pas de cache local (chaque vérification fait un appel réseau, négligeable au volume V0).

## Limites V0

- Mapping `nature_juridique → legal_form` partiel (5 formes courantes). Les autres tombent sur `null` et l'artisan choisit dans le dropdown.
- Pas de validation Luhn du SIRET côté client — on laisse l'API trancher.
- Pas de rate-limit côté AVA — dépend de la limite publique 7 req/sec/IP. À monitorer si beaucoup d'utilisateurs.

## Documentation officielle

https://api.gouv.fr/documentation/api-recherche-entreprises
