'use client'

import { memo } from 'react'

import { EDITOR_SHELL_CLASS, EDITOR_SIDEBAR_MAX_H } from './editorLayoutConstants'
import ProgramEditorDndProvider from './ProgramEditorDndProvider'
import BlockPalettePanel from './panels/BlockPalettePanel'
import ExerciseLibraryPanel from './panels/ExerciseLibraryPanel'
import ProgramEditorUndoKeyboard from './ProgramEditorUndoKeyboard'
import ProgramEditorChrome from './ProgramEditorChrome'
import ProgramInfoCard from './panels/ProgramInfoCard'
import TimelinePanel from './TimelinePanel'
import CommandErrorBanner from './ui/CommandErrorBanner'
import EditorContextMenu from './ui/EditorContextMenu'
import ProgramEditorNavigationEndClient from '../ProgramEditorNavigationClient'

type Props = {
  programId: string
  basePath?: string
  backHref?: string
}

/**
 * Scroll unique : infos générales + timeline (défilent ensemble).
 * Palette et bibliothèque restent sticky dans la zone visible.
 *
 * Breakpoints layout :
 * - ≤1085px : sidebars plus étroites, gap réduit
 * - 768–867px : colonne droite fixe 168px, palette limitée en hauteur
 * - ≤623px : voir ProgramInfoCard / chrome (mode téléphone)
 */
function ProgramEditorLayoutInner({ programId, basePath, backHref }: Props) {
  return (
    <ProgramEditorDndProvider>
      <ProgramEditorUndoKeyboard />
      <div className={EDITOR_SHELL_CLASS}>
        <ProgramEditorNavigationEndClient />
        <ProgramEditorChrome programId={programId} basePath={basePath} backHref={backHref} />
        <CommandErrorBanner />

        <div
          data-program-editor-scroll
          className="program-editor-main no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain"
        >
          <div className="px-3 py-3 min-[624px]:px-4 min-[868px]:px-6">
            <ProgramInfoCard />
          </div>

          <div className="flex items-start gap-2 min-[768px]:gap-3 min-[1000px]:gap-3 max-[1085px]:min-[768px]:gap-2 max-[1085px]:min-[1000px]:gap-2">
            {/* Palette gauche — desktop ≥1000px */}
            <aside
              className={[
                'relative z-0 hidden shrink-0',
                'min-[1000px]:sticky min-[1000px]:top-0 min-[1000px]:block',
                'min-[1000px]:self-start min-[1000px]:w-[220px] min-[1000px]:overflow-y-auto min-[1000px]:overscroll-contain min-[1000px]:p-4',
                'max-[1085px]:min-[1000px]:w-[168px] max-[1085px]:min-[1000px]:p-2',
                EDITOR_SIDEBAR_MAX_H,
              ].join(' ')}
            >
              <BlockPalettePanel />
            </aside>

            {/* Timeline */}
            <div className="relative z-10 min-w-0 flex-1 px-1 pb-8 min-[624px]:px-2 min-[868px]:px-4">
              <TimelinePanel />
            </div>

            {/* Bibliothèque + palette tablette 768–999px */}
            <aside
              className={[
                'relative z-0 hidden shrink-0',
                'min-[768px]:sticky min-[768px]:top-0 min-[768px]:flex min-[768px]:flex-col min-[768px]:gap-3',
                'min-[768px]:self-start min-[768px]:overflow-hidden',
                'min-[768px]:w-[clamp(168px,24vw,280px)] min-[768px]:p-3',
                'min-[1000px]:w-[clamp(160px,18vw,260px)] min-[1000px]:p-4',
                'max-[1085px]:min-[768px]:w-[clamp(152px,20vw,200px)] max-[1085px]:min-[768px]:p-2',
                'max-[867px]:min-[768px]:w-[168px] max-[867px]:min-[768px]:gap-2',
                EDITOR_SIDEBAR_MAX_H,
              ].join(' ')}
            >
              <div
                className={[
                  'min-[768px]:max-[999px]:block min-[1000px]:hidden',
                  'min-[768px]:max-[999px]:shrink-0 min-[768px]:max-[999px]:overflow-y-auto min-[768px]:max-[999px]:overscroll-contain',
                  'max-[867px]:min-[768px]:max-[999px]:max-h-[38dvh]',
                ].join(' ')}
              >
                <BlockPalettePanel />
              </div>
              <ExerciseLibraryPanel className="min-h-0 min-[768px]:flex-1" stickyFill />
            </aside>
          </div>

          <div aria-hidden className="h-16 shrink-0" />
        </div>

        <EditorContextMenu />
      </div>
    </ProgramEditorDndProvider>
  )
}

export default memo(ProgramEditorLayoutInner)
