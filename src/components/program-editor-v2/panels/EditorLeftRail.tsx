'use client'

import { memo } from 'react'

import BlockPalettePanel from './BlockPalettePanel'

/** Palette only — program info is full-width above the grid. */
function EditorLeftRailInner() {
  return <BlockPalettePanel />
}

export default memo(EditorLeftRailInner)
