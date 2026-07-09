import { TouchSensor } from '@dnd-kit/core'

function isInteractiveDndTarget(target: Element | null): boolean {
  if (!target) return false
  const el = target as HTMLElement
  if (el.closest?.('[data-editor-dnd-handle]')) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option' || tag === 'button') {
    return true
  }
  if (el.isContentEditable) return true
  return Boolean(el.closest?.('input,textarea,select,option,button,[contenteditable=true],a'))
}

/** Même filtre que EditorPointerSensor, pour le tactile natif. */
export class EditorTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent }: { nativeEvent: TouchEvent }) => {
        const target = nativeEvent.target as Element | null
        if (isInteractiveDndTarget(target)) return false
        return true
      },
    },
  ]
}
