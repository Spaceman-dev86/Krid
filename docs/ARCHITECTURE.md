# Architecture (réalité du repo)

## Entrées
- Pages / routes : `src/app/…`
- Stubs Next plats : `app/…` (re-export `@/src/...`)
- UI : `src/components/…` (+ `@/components/ui`)
- Helpers métier / data : `src/lib/…`
- Migrations : `supabase/migrations/slices/`

## Dossiers présents mais ciblés
- `src/domain/` · `src/persistence/` · `src/store/` : surtout éditeur programme V2 — **ne pas y mettre** le reste du produit par défaut.
- Préférer `src/lib/<domaine>/` pour le nouveau code (tracking, coach, prestations…).

## Flux typique
Page RSC → helper `src/lib/…` ou server action → Supabase (RLS).  
Mutations : server actions + `revalidatePath` ciblé.

## Multi-coach
Identité coach via branding (`slug` / domaine) + `coach_id` en base. Portail client sous `/c/[slug]/…`.

## Paiements
Logique serveur uniquement. Webhooks = source de vérité statut (quand branchés).
