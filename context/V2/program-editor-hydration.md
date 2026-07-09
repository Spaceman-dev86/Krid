# Program Editor V2 — Hydration contract (Phase 3.9)

## Purpose

Prepare server document load (Phase 4) without implementing persistence yet.

## Store fields

| Field | Meaning |
|-------|---------|
| `document` | Current `MinimalProgramDocument` or `null` before first hydrate |
| `isDirty` | `true` after any successful `applyCommand`; cleared on successful hydrate |
| `hydrationEpoch` | Increments on each applied hydrate (use as React `key` if full remount needed) |
| `revision` | Increments on each successful command (future conflict detection) |

## Hydrate modes

- **`initial`** (default): apply only if store is empty **or** document is not dirty.
- **`force-replace`**: always replace (explicit reload / discard local edits).

Returns `{ applied: true }` or `{ applied: false, reason: 'dirty-document' | 'invalid-document' }`.

## Phase 4 usage (planned)

1. Fetch server document in `ProgramEditorShell`.
2. Call `hydrate(serverDoc, { mode: 'initial' })` on first load.
3. If `reason === 'dirty-document'`, show conflict UI — do not silently overwrite.
4. On explicit “Revert” / “Reload from server”, use `{ mode: 'force-replace' }`.
5. Clear `programEditorTempIdRegistry` happens inside `hydrate` (already implemented).

## Assumptions

- UI chrome (`uiStore`) is **not** hydrated from server.
- Dev fixture hydrate in shell uses `mode: 'initial'` once per mount (`didHydrateRef`).
- Late async hydrate while user is editing must respect `isDirty` guard.
