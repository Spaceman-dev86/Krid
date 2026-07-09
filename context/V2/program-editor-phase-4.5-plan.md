# Phase 4.5 — Plan d’implémentation

## Fichiers touchés

| Zone | Fichiers |
|------|----------|
| Persistence API | `src/app/api/programs/[id]/editor-v2/commands/route.ts` |
| Helpers API duplicate | `src/lib/persistence/editorDuplicatePersistence.ts` (nouveau) |
| Queue / adapter | `src/persistence/core/types.ts`, `PersistenceQueue.ts`, `adapters/nextApiAdapter.ts`, `startProgramEditorPersistence.ts`, `buildDuplicateContext.ts` (nouveau) |
| Store sync | `src/store/program-editor/persistenceStore.ts` (nouveau), `documentStore.ts` (remap registry + `lastSyncedRevision`) |
| UX | `PersistenceStatusBar.tsx`, `ProgramEditorChrome.tsx` |
| Domaine (minimal) | `tempIds.ts` — `applyIdRemapToRegistry` |

**Hors scope** : pas de refonte DnD, layout, design system.

## Risques

1. **Duplicate semaine/séance** : une seule commande domaine crée tout le sous-arbre en `tmp-*` ; l’API doit recevoir le snapshot client (prev/next) ou les remaps partiels cassent l’éditeur.
2. **Ordre batch** : duplicate + edits rapides ; le remap doit s’appliquer avant les commandes suivantes dans le même batch (`ensureServerId` partagé).
3. **Legacy sans `session_items`** : duplicate serveur doit lire la source en DB (comme V1 `duplicateWeek`).
4. **Rendu** : barre de statut dans le chrome sticky uniquement — pas d’abonnement document entier.

## Edge cases persistence

- `week.duplicate` après `week.add` tmp dans le même batch → `idRemap` chaîné.
- `session.duplicate` avec séance source encore tmp → résoudre `sourceSessionId` via `idRemap` avant lecture DB.
- Échec réseau : queue conserve les commandes ; retry sans double insert (ids stables via remap).
- Hydrate stale : conserver garde `isDirty` ; ne pas clear dirty au sync (distinction `lastSyncedRevision` vs `revision`).

## Migration

- Programmes legacy : duplicate serveur copie via `session_items` ou fallback `program_exercises` + `session_blocks`.
- Pas de migration DB requise pour 4.5.
- Pas de `router.refresh` / re-hydrate post-save.

## Ordre d’exécution

1. API + duplicate context + remap registry  
2. Persistence store + status bar + queue hardening  
3. Vérifier parité UI existante (déjà largement en place)
