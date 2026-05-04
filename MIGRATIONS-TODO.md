# Migrations Supabase à appliquer

Le projet Supabase est `rpnnuxqbrejdwhyunqbk`. Pas de CLI Supabase installée.

**Action manuelle** : ouvrez https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/sql/new
et collez le contenu du fichier suivant. Cliquez **Run**.

## Pending

- [ ] `supabase/migrations/0003_idempotency_and_legal.sql` — atomic claim status, UNIQUE document numbers, profiles + clients legal fields

## Applied (référence)

- [x] `supabase/migrations/0001_init.sql` — schéma initial (profiles, clients, invoices, quotes, ava_actions, RLS, trigger profile)

---

**Sans la 0003, ces features ne fonctionnent PAS** :
- Idempotency double-tap sur Confirmer (créera 2 factures)
- UNIQUE numéros (collisions possibles)
- Mentions légales factures/devis (champs n'existent pas en base)
- SIRET autocomplete sur fiche client (champs n'existent pas)
- Section "Informations légales" dans Settings (champs n'existent pas)

**Temps d'application** : ~10 secondes dans le SQL Editor Supabase.
