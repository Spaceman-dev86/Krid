# Phase 5 — Bascule V2 (URL principale)

## Routes

| URL | Éditeur |
|-----|---------|
| `/dashboard/programs/[id]` | **V2 (défaut)** |
| `/admin/programs/[id]` | **V2 (défaut admin)** |
| `?legacy=1` | V1 (`legacy-program-builder-page.tsx`) |
| `?preview=1` | Preview téléphone (page legacy) |
| `?blocks=1` | Éditeur blocs embarqué V1 |

`/dashboard/programs/[id]/editor-v2` → redirect vers `/dashboard/programs/[id]` (anciennes URLs).

API persistance inchangée : `/api/programs/[id]/editor-v2/commands`.

## Garde-fous

- `ProgramEditorErrorBoundary` — erreur React → Réessayer
- Échec hydrate serveur → `?legacy=1&v2_hydrate=1`

## Build / tests

- `npm run build`
- `npm run test:kernel`
