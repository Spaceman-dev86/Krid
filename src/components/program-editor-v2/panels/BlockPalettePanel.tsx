'use client'

import { memo } from 'react'

import { useProgramEditorUiStore } from '../../../store/program-editor/uiStore'
import type { BlockKindDrag } from '../dnd/dndIds'
import NeutralDropZone from '../dnd/NeutralDropZone'
import { DND } from '../dnd/dndIds'
import { EDITOR_PANEL_SHADOW_CLASS } from '../ui/editorInputStyles'
import { EDITOR_SECTION_TITLE_CLASS } from '../ui/editorSectionTitle'
import PaletteBlockDraggable from './PaletteBlockDraggable'

const PALETTE_BLOCKS: Array<{ kind: BlockKindDrag; id: string; label: string }> = [
  { kind: 'neutral', id: 'palette-neutral', label: 'Bloc neutre' },
  { kind: 'warmup', id: 'palette-warmup', label: 'Warm-up' },
  { kind: 'crossfit', id: 'palette-crossfit', label: 'CrossFit' },
  { kind: 'superset', id: 'palette-superset', label: 'Superset' },
]

function BlockPalettePanelInner() {
  const highlightId = useProgramEditorUiStore((s) => s.paletteHighlightId)
  const activeDragItemId = useProgramEditorUiStore((s) => s.activeDragItemId)
  const isExternalDrag = Boolean(
    activeDragItemId?.startsWith(DND.paletteBlockPrefix) ||
      activeDragItemId?.startsWith(DND.libraryExercisePrefix)
  )

  return (
    <div className={`relative rounded-2xl bg-white px-3 pb-3 pt-2 ${EDITOR_PANEL_SHADOW_CLASS}`}>
      <NeutralDropZone id={DND.paletteDropzone} active={isExternalDrag} />
      <div className={EDITOR_SECTION_TITLE_CLASS}>Blocs</div>
      <p className="mt-1 text-[10px] font-medium text-[var(--muted)] max-[867px]:hidden">
        Glisser dans une séance ouverte.
      </p>
      <p className="mt-1 hidden text-[10px] font-medium text-[var(--muted)] max-[867px]:block">
        Glisser dans une séance.
      </p>
      <div className="mt-2 grid gap-1.5">
        {PALETTE_BLOCKS.map((b) => (
          <div
            key={b.id}
            onMouseEnter={() => useProgramEditorUiStore.getState().setPaletteHighlight(b.id)}
            onMouseLeave={() => useProgramEditorUiStore.getState().setPaletteHighlight(null)}
          >
            <PaletteBlockDraggable
              kind={b.kind}
              label={b.label}
              highlighted={highlightId === b.id}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(BlockPalettePanelInner)
