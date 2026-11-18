# PRD — index (court)

Une seule page d’index. Détails = sections ci-dessous (pas de roman).

## Surfaces coach (priorité)
| Surface | But | Statut |
|---|---|---|
| Showroom `/profile` | Présentation publique + offres | Done |
| Prestations | Catalogue de vente | Done |
| Liens | Campagnes trackées + prospects | Done |
| Codes | Accès app + promos | Done |
| Mon app | DA (logo, couleurs, slug) + rendu | Done |
| Clients | CRM / groupes / bilans | Existant |
| Admin | Catalogue plateforme + SAV | Existant |

## Règles métier globales
- 1 client = 1 coach (pas de compte partagé multi-coach).
- Toute donnée métier porte `coach_id` + RLS.
- Prospects showroom → table leads / notif coach → `/profile/liens`.

## Hors scope (pour l’instant)
- Checkout Stripe Connect complet (paiement simulé / partiel selon flux)
- Site personnalisé / logo custom = ticket SAV (pas un builder)

## Quand enrichir
Ajouter une section **courte** ici seulement quand une nouvelle feature démarre (but · happy path · hors scope · « c’est fini si… »).
