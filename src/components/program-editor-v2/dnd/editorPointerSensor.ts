import { PointerSensor } from '@dnd-kit/core'

function isInteractiveDndTarget(target: Element | null): boolean {
  if (!target) return false
  const el = target as HTMLElement
  // Poignées DnD dédiées — toujours autorisées
  if (el.closest?.('[data-editor-dnd-handle]')) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option' || tag === 'button') {
    return true
  }
  if (el.isContentEditable) return true
  return Boolean(el.closest?.('input,textarea,select,option,button,[contenteditable=true],a'))
}

/** Ignores interactive targets so long-press drag does not steal taps on inputs/buttons. */
export class EditorPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) => {
        const target = nativeEvent.target as Element | null
        if (isInteractiveDndTarget(target)) return false
        return true
      },
    },
  ]
}
