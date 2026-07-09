'use client'

import { create } from 'zustand'

export type ContextMenuItem = {
  id: string
  label: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

export type ContextMenuState = {
  x: number
  y: number
  items: ContextMenuItem[]
} | null

function resetTimelineUiState(): Pick<
  ProgramEditorUiState,
  'editingProgramExerciseId' | 'expandedBlockId' | 'openSessionAddPanel' | 'selectedTimelineItemId'
> {
  return {
    editingProgramExerciseId: null,
    expandedBlockId: null,
    openSessionAddPanel: null,
    selectedTimelineItemId: null,
  }
}

type ProgramEditorUiState = {
  openWeekIds: Record<string, boolean>
  openSessionIds: Record<string, boolean>
  expandedBlockId: string | null
  selectedTimelineItemId: string | null
  editingWeekTitleId: string | null
  editingSessionTitleId: string | null
  editingProgramExerciseId: string | null
  activeDragItemId: string | null
  activeDragLabel: string | null
  contextMenu: ContextMenuState
  paletteHighlightId: string | null
  openSessionAddPanel: { sessionId: string; kind: 'exercise' | 'block' } | null
  activeDropMarkerId: string | null

  initOpenWeeks: (weekIds: string[]) => void
  toggleWeek: (weekId: string, sessionIds?: string[]) => void
  setWeekOpen: (weekId: string, open: boolean, sessionIds?: string[]) => void
  toggleSession: (sessionId: string) => void
  setSessionOpen: (sessionId: string, open: boolean) => void
  toggleBlockExpanded: (blockId: string) => void
  setBlockExpanded: (blockId: string, open: boolean) => void
  selectTimelineItem: (itemId: string | null) => void
  setEditingWeekTitleId: (weekId: string | null) => void
  setEditingSessionTitleId: (sessionId: string | null) => void
  setEditingProgramExerciseId: (programExerciseId: string | null) => void
  setActiveDrag: (itemId: string | null, label?: string | null) => void
  setPaletteHighlight: (id: string | null) => void
  setOpenSessionAddPanel: (panel: { sessionId: string; kind: 'exercise' | 'block' } | null) => void
  setActiveDropMarkerId: (id: string | null) => void
  /** Keep accordion state in sync after persistence remaps tmp-* ids to server UUIDs. */
  remapUiStateIds: (remap: Record<string, string>) => void
  openContextMenu: (menu: ContextMenuState) => void
  closeContextMenu: () => void
  resetProgramEditorUi: () => void
}

function closeSessions(openSessionIds: Record<string, boolean>, sessionIds: string[]): Record<string, boolean> {
  const next = { ...openSessionIds }
  for (const id of sessionIds) delete next[id]
  return next
}

function remapRecordKeys(record: Record<string, boolean>, remap: Record<string, string>): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const [key, open] of Object.entries(record)) {
    if (!open) continue
    const mapped = remap[key] ?? key
    next[mapped] = true
  }
  return next
}

function remapOptionalId(id: string | null, remap: Record<string, string>): string | null {
  if (!id) return null
  return remap[id] ?? id
}

export const useProgramEditorUiStore = create<ProgramEditorUiState>((set, get) => ({
  openWeekIds: {},
  openSessionIds: {},
  expandedBlockId: null,
  selectedTimelineItemId: null,
  editingWeekTitleId: null,
  editingSessionTitleId: null,
  editingProgramExerciseId: null,
  activeDragItemId: null,
  activeDragLabel: null,
  contextMenu: null,
  paletteHighlightId: null,
  openSessionAddPanel: null,
  activeDropMarkerId: null,

  initOpenWeeks: (weekIds) => {
    const openWeekIds: Record<string, boolean> = {}
    for (const id of weekIds) openWeekIds[id] = true
    set({ openWeekIds })
  },

  toggleWeek: (weekId, sessionIds = []) => {
    const cur = get().openWeekIds[weekId] ?? false
    const nextOpen = !cur

    if (nextOpen) {
      set({
        openWeekIds: { [weekId]: true },
        openSessionIds: {},
        ...resetTimelineUiState(),
      })
      return
    }

    set({
      openWeekIds: { ...get().openWeekIds, [weekId]: false },
      openSessionIds: closeSessions(get().openSessionIds, sessionIds),
      editingWeekTitleId: get().editingWeekTitleId === weekId ? null : get().editingWeekTitleId,
      editingSessionTitleId: null,
      ...resetTimelineUiState(),
    })
  },

  setWeekOpen: (weekId, open, sessionIds = []) => {
    if (open) {
      set({
        openWeekIds: { [weekId]: true },
        openSessionIds: {},
        ...resetTimelineUiState(),
      })
      return
    }

    set({
      openWeekIds: { ...get().openWeekIds, [weekId]: false },
      openSessionIds: closeSessions(get().openSessionIds, sessionIds),
      editingWeekTitleId: get().editingWeekTitleId === weekId ? null : get().editingWeekTitleId,
      editingSessionTitleId: null,
      ...resetTimelineUiState(),
    })
  },

  toggleSession: (sessionId) => {
    const cur = get().openSessionIds[sessionId] ?? false
    const nextOpen = !cur

    if (nextOpen) {
      set({
        openSessionIds: { [sessionId]: true },
        ...resetTimelineUiState(),
      })
      return
    }

    set({
      openSessionIds: { ...get().openSessionIds, [sessionId]: false },
      editingSessionTitleId: get().editingSessionTitleId === sessionId ? null : get().editingSessionTitleId,
      ...resetTimelineUiState(),
    })
  },

  setSessionOpen: (sessionId, open) => {
    if (open) {
      set({
        openSessionIds: { [sessionId]: true },
        ...resetTimelineUiState(),
      })
      return
    }

    set({
      openSessionIds: { ...get().openSessionIds, [sessionId]: false },
      editingSessionTitleId: get().editingSessionTitleId === sessionId ? null : get().editingSessionTitleId,
      ...resetTimelineUiState(),
    })
  },

  toggleBlockExpanded: (blockId) => {
    const cur = get().expandedBlockId
    const next = cur === blockId ? null : blockId
    set({
      expandedBlockId: next,
      editingProgramExerciseId: null,
      openSessionAddPanel: null,
    })
  },

  setBlockExpanded: (blockId, open) => {
    set({
      expandedBlockId: open ? blockId : get().expandedBlockId === blockId ? null : get().expandedBlockId,
      editingProgramExerciseId: open ? null : get().editingProgramExerciseId,
      openSessionAddPanel: open ? null : get().openSessionAddPanel,
    })
  },

  selectTimelineItem: (itemId) => set({ selectedTimelineItemId: itemId }),

  setEditingWeekTitleId: (weekId) => set({ editingWeekTitleId: weekId }),

  setEditingSessionTitleId: (sessionId) => set({ editingSessionTitleId: sessionId }),

  setEditingProgramExerciseId: (programExerciseId) =>
    set({
      editingProgramExerciseId: programExerciseId,
      expandedBlockId: programExerciseId ? null : get().expandedBlockId,
      openSessionAddPanel: programExerciseId ? null : get().openSessionAddPanel,
    }),

  setActiveDrag: (itemId, label = null) =>
    set({ activeDragItemId: itemId, activeDragLabel: label ?? null }),

  setPaletteHighlight: (id) => set({ paletteHighlightId: id }),

  setOpenSessionAddPanel: (panel) =>
    set({
      openSessionAddPanel: panel,
      editingProgramExerciseId: panel ? null : get().editingProgramExerciseId,
      expandedBlockId: panel ? null : get().expandedBlockId,
    }),

  setActiveDropMarkerId: (id) => set({ activeDropMarkerId: id }),

  remapUiStateIds: (remap) => {
    if (!Object.keys(remap).length) return
    const s = get()
    set({
      openWeekIds: remapRecordKeys(s.openWeekIds, remap),
      openSessionIds: remapRecordKeys(s.openSessionIds, remap),
      expandedBlockId: remapOptionalId(s.expandedBlockId, remap),
      editingProgramExerciseId: remapOptionalId(s.editingProgramExerciseId, remap),
      selectedTimelineItemId: remapOptionalId(s.selectedTimelineItemId, remap),
      openSessionAddPanel: s.openSessionAddPanel
        ? {
            ...s.openSessionAddPanel,
            sessionId: remap[s.openSessionAddPanel.sessionId] ?? s.openSessionAddPanel.sessionId,
          }
        : null,
    })
  },

  openContextMenu: (menu) => set({ contextMenu: menu }),

  closeContextMenu: () => set({ contextMenu: null }),

  resetProgramEditorUi: () =>
    set({
      openWeekIds: {},
      openSessionIds: {},
      expandedBlockId: null,
      selectedTimelineItemId: null,
      editingWeekTitleId: null,
      editingSessionTitleId: null,
      editingProgramExerciseId: null,
      activeDragItemId: null,
      activeDragLabel: null,
      contextMenu: null,
      paletteHighlightId: null,
      openSessionAddPanel: null,
      activeDropMarkerId: null,
    }),
}))

export function useIsWeekOpen(weekId: string): boolean {
  return useProgramEditorUiStore((s) => s.openWeekIds[weekId] ?? false)
}

export function useIsSessionOpen(sessionId: string): boolean {
  return useProgramEditorUiStore((s) => s.openSessionIds[sessionId] ?? false)
}

export function useIsBlockExpanded(blockId: string): boolean {
  return useProgramEditorUiStore((s) => s.expandedBlockId === blockId)
}

export function useSelectedTimelineItemId(): string | null {
  return useProgramEditorUiStore((s) => s.selectedTimelineItemId)
}
