# Migrations Supabase à appliquer

Le projet Supabase est `rpnnuxqbrejdwhyunqbk`. Pas de CLI Supabase installée.

**Action manuelle** : ouvrez https://supabase.com/dashboard/project/rpnnuxqbrejdwhyunqbk/sql/new
et collez le contenu du fichier suivant. Cliquez **Run**.

## Pending

- [ ] `supabase/migrations/0003_idempotency_and_legal.sql` — atomic claim status, UNIQUE document numbers, profiles + clients legal fields
- [ ] `supabase/migrations/0004_notifications.sql` — table notifications pour les rappels proactifs (V3 cron)
- [ ] `supabase/migrations/0005_appointments.sql` — table appointments pour les RDV vocaux (V4)

## Applied (référence)

- [x] `supabase/migrations/0001_init.sql` — schéma initial (profiles, clients, invoices, quotes, ava_actions, RLS, trigger profile)

---

## Sans la 0003

Ces features ne fonctionnent PAS :
- Idempotency double-tap sur Confirmer (créera 2 factures)
- UNIQUE numéros (collisions possibles)
- Mentions légales factures/devis (champs n'existent pas en base)
- SIRET autocomplete sur fiche client (champs n'existent pas)
- Section "Informations légales" dans Settings (champs n'existent pas)

## Sans la 0004

- La cron Vercel weekly (lundi 7h30) tournera mais ne pourra pas insérer
  → erreurs silencieuses dans les logs
- La bannière "AVA vous suggère" sur la home ne s'affichera pas
- L'historique reste utilisable (table `ava_actions` déjà migrée en 0001)

## Variables d'environnement Vercel à ajouter

Pour la cron de notifications proactives (sécurité au cas où l'endpoint est aussi
appelé sans le header `x-vercel-cron`) :

```
CRON_SECRET=<générer un random 32 chars, ex via `openssl rand -hex 32`>
```

Optionnel — Vercel cron auto-authentifie via `x-vercel-cron: 1`. Sans le secret,
l'endpoint reste accessible aux crons Vercel uniquement, ce qui est OK pour V0.

**Temps d'application total** : ~30 secondes pour les deux migrations.
