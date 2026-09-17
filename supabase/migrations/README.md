# Phase 2 — appliquer la migration

Fichier : `supabase/migrations/20260826_phase2_tenancy_clients.sql`

Aussi visible dans l’app : **`/admin/spec/supabase`** → onglets **SQL Phase 2** / **Nouveau projet**.

## Règle d’or

**Ne pas exécuter ce SQL sur l’ancien projet Supabase Trainly** (gros historique, `demo_*`, RLS permissives).
Créer un **nouveau projet** vide, y appliquer le SQL, pointer `.env` vers ce nouveau projet quand tu bascules.

## Dans le dashboard Supabase (nouveau projet)

1. Ouvre **SQL Editor**
2. Colle le SQL (ou copie depuis `/admin/spec/supabase`)
3. **Run**
4. Vérifie Table Editor : `clients`, `coach_subscriptions`, `coach_branding`, etc.

## Après application

Les types TypeScript dans `src/lib/supabase/database.types.ts` sont déjà alignés.
Quand le CLI Supabase sera branché : `npx supabase gen types typescript --project-id …` pour régénérer depuis la DB live.

## Notes

- `admin` legacy reste accepté (`is_platform_admin()` + `src/lib/auth/roles.ts`)
- `prestations` / `payment_ledger` = stubs FK pour les grants (domaine paiements encore ⏳)
- Trial produit = **15 jours** calendaires dès 1ʳᵉ connexion app
