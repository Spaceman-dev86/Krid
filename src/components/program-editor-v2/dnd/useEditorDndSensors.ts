'use client'

import { useSensor, useSensors } from '@dnd-kit/core'

import { EditorPointerSensor } from './editorPointerSensor'
import { EditorTouchSensor } from './editorTouchSensor'
import {
  MOBILE_DRAG_PRESS_MS,
  MOBILE_DRAG_TOLERANCE,
  useEditorDesktopDnD,
} from './useEditorDndActivator'

/**
 * Desktop (≥768px) : drag immédiat via poignée (distance 5px).
 * Mobile (<768px) : appui long (~300ms) sur le bloc, souris ou doigt.
 */
export function useEditorDndSensors() {
  const isDesktop = useEditorDesktopDnD()

  return useSensors(
    useSensor(EditorPointerSensor, {
      activationConstraint: isDesktop
        ? { distance: 5 }
        : { delay: MOBILE_DRAG_PRESS_MS, tolerance: MOBILE_DRAG_TOLERANCE },
    }),
    useSensor(EditorTouchSensor, {
      activationConstraint: {
        delay: MOBILE_DRAG_PRESS_MS,
        tolerance: MOBILE_DRAG_TOLERANCE,
      },
    })
  )
}
