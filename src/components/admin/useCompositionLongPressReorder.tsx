'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

/** DnD composition : téléphone + tablette uniquement (<1100px). */
export const COMPOSITION_DND_MAX_PX = 1099

/** Placeholder dans la liste pendant le drag (la carte flotte ailleurs). */
export const COMPOSITION_DRAG_ACTIVE_CLASS =
  'opacity-25 ring-2 ring-dashed ring-[var(--brand)]/35 [&>*]:invisible'

export function useCompositionDndEnabled() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(`(max-width: ${COMPOSITION_DND_MAX_PX}px)`)
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(`(max-width: ${COMPOSITION_DND_MAX_PX}px)`).matches,
    () => false,
  )
}

type DragState = {
  key: string
  pointerId: number
  originIndex: number
  active: boolean
  offsetX: number
  offsetY: number
}

/**
 * Index d’insert (0…length), même logique que le drop catalogue :
 * « avant l’item i » ou `length` = fin de liste. Ignore la carte en drag.
 */
function resolveInsertIndex(
  listEl: HTMLElement,
  clientY: number,
  dragKey: string,
  keys: string[],
): number {
  const nodes = Array.from(
    listEl.querySelectorAll<HTMLElement>('[data-composition-reorder]'),
  )
  for (const el of nodes) {
    const key = el.dataset.compositionReorder
    if (!key || key === dragKey) continue
    const rect = el.getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) {
      const idx = keys.indexOf(key)
      return idx < 0 ? keys.length : idx
    }
  }
  return keys.length
}

function moveKeyToInsertIndex<T extends { key: string }>(
  items: T[],
  fromKey: string,
  insertBefore: number,
): T[] | null {
  const from = items.findIndex((x) => x.key === fromKey)
  if (from < 0) return null
  let to = Math.max(0, Math.min(insertBefore, items.length))
  if (from < to) to -= 1
  if (to === from) return null
  const next = [...items]
  const [moved] = next.splice(from, 1)
  if (!moved) return null
  next.splice(to, 0, moved)
  return next
}

function removeFloat(el: HTMLElement | null) {
  if (!el) return
  el.remove()
}

function positionFloat(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  offsetX: number,
  offsetY: number,
) {
  const x = clientX - offsetX
  const y = clientY - offsetY
  el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.02)`
}

/** Marqueur d’insert — même rendu que le drop catalogue → séance. */
export function CompositionInsertMarker({
  label = 'Insérer',
}: {
  label?: string
}) {
  return (
    <li
      className="list-none py-1"
      aria-hidden
      data-composition-insert-marker=""
    >
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--brand)] bg-[var(--brand)]/15 px-2 py-1.5 shadow-da-sm transition">
        <span className="h-px flex-1 bg-[var(--brand)]/60" />
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--brand)]">
          {label}
        </span>
        <span className="h-px flex-1 bg-[var(--brand)]/60" />
      </div>
    </li>
  )
}

/**
 * Reorder par poignée grip (téléphone / tablette).
 * Carte clonée en flottant sous le doigt + marqueur « Insérer ».
 */
export function useCompositionLongPressReorder<T extends { key: string }>({
  enabled,
  items,
  onReorder,
  canDragKey,
  listRef,
}: {
  enabled: boolean
  items: T[]
  onReorder: (next: T[]) => void
  canDragKey: (key: string) => boolean
  listRef: RefObject<HTMLElement | null>
}) {
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [insertIndex, setInsertIndex] = useState<number | null>(null)
  const stateRef = useRef<DragState | null>(null)
  const insertIndexRef = useRef<number | null>(null)
  const floatElRef = useRef<HTMLElement | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const suppressClickUntilRef = useRef(0)

  const teardownFloat = useCallback(() => {
    removeFloat(floatElRef.current)
    floatElRef.current = null
  }, [])

  const endDrag = useCallback(
    (commit: boolean) => {
      const st = stateRef.current
      const dropAt = insertIndexRef.current
      const wasActive = Boolean(st?.active)
      stateRef.current = null
      insertIndexRef.current = null
      teardownFloat()
      setDragKey(null)
      setInsertIndex(null)
      if (wasActive) suppressClickUntilRef.current = Date.now() + 350
      if (!commit || !wasActive || dropAt == null || !st) return
      const next = moveKeyToInsertIndex(itemsRef.current, st.key, dropAt)
      if (next) {
        onReorder(next)
        try {
          navigator.vibrate?.(15)
        } catch {
          /* ignore */
        }
      }
    },
    [onReorder, teardownFloat],
  )

  const shouldSuppressClick = useCallback(
    () => Date.now() < suppressClickUntilRef.current,
    [],
  )

  useEffect(() => {
    if (!enabled) endDrag(false)
  }, [enabled, endDrag])

  useEffect(() => () => teardownFloat(), [teardownFloat])

  const onHandlePointerDown = useCallback(
    (key: string, e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return
      if (!canDragKey(key)) return
      if (e.button !== 0) return
      const originIndex = itemsRef.current.findIndex((x) => x.key === key)
      if (originIndex < 0) return

      const card = e.currentTarget.closest(
        '[data-composition-reorder]',
      ) as HTMLElement | null
      if (!card) return

      e.preventDefault()
      e.stopPropagation()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      const rect = card.getBoundingClientRect()
      const offsetX = e.clientX - rect.left
      const offsetY = e.clientY - rect.top

      teardownFloat()
      const clone = card.cloneNode(true) as HTMLElement
      clone.removeAttribute('data-composition-reorder')
      clone.setAttribute('data-composition-drag-float', '')
      clone.style.cssText = [
        'position:fixed',
        'left:0',
        'top:0',
        `width:${rect.width}px`,
        `height:${rect.height}px`,
        'margin:0',
        'z-index:10000',
        'pointer-events:none',
        'touch-action:none',
        'box-sizing:border-box',
        'border-radius:var(--radius-md)',
        'border:1px solid var(--brand)',
        'background:var(--page-bg)',
        'box-shadow:0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px color-mix(in srgb, var(--brand) 35%, transparent)',
        'opacity:1',
        'transform-origin:top left',
        'transition:box-shadow 120ms ease, opacity 120ms ease',
        'will-change:transform',
      ].join(';')
      // Retirer les classes placeholder du clone s’il en avait.
      clone.classList.remove(...COMPOSITION_DRAG_ACTIVE_CLASS.split(/\s+/).filter(Boolean))
      document.body.appendChild(clone)
      positionFloat(clone, e.clientX, e.clientY, offsetX, offsetY)
      floatElRef.current = clone

      stateRef.current = {
        key,
        pointerId: e.pointerId,
        originIndex,
        active: true,
        offsetX,
        offsetY,
      }
      insertIndexRef.current = originIndex
      setDragKey(key)
      setInsertIndex(originIndex)
      try {
        navigator.vibrate?.(12)
      } catch {
        /* ignore */
      }
    },
    [canDragKey, enabled, teardownFloat],
  )

  useEffect(() => {
    if (!enabled) return

    function onMove(e: PointerEvent) {
      const st = stateRef.current
      if (!st || e.pointerId !== st.pointerId || !st.active) return
      e.preventDefault()
      const floatEl = floatElRef.current
      if (floatEl) {
        positionFloat(floatEl, e.clientX, e.clientY, st.offsetX, st.offsetY)
      }
      const list = listRef.current
      if (!list) return
      const keys = itemsRef.current.map((x) => x.key)
      const nextInsert = resolveInsertIndex(list, e.clientY, st.key, keys)
      insertIndexRef.current = nextInsert
      setInsertIndex(nextInsert)
    }

    function onUp(e: PointerEvent) {
      const st = stateRef.current
      if (!st || e.pointerId !== st.pointerId) return
      endDrag(st.active)
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [enabled, endDrag, listRef])

  const getItemProps = useCallback(
    (key: string) => {
      const base = { 'data-composition-reorder': key } as const
      if (!enabled || !canDragKey(key)) {
        return { ...base, className: '' }
      }
      const isDragging = dragKey === key
      return {
        ...base,
        className: isDragging ? COMPOSITION_DRAG_ACTIVE_CLASS : '',
      }
    },
    [canDragKey, dragKey, enabled],
  )

  const getHandleProps = useCallback(
    (key: string) => {
      if (!enabled || !canDragKey(key)) {
        return { className: 'hidden' as const }
      }
      const isDragging = dragKey === key
      return {
        'data-composition-drag-handle': '',
        onPointerDown: (e: ReactPointerEvent<HTMLElement>) =>
          onHandlePointerDown(key, e),
        className: [
          'inline-flex h-8 w-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)] max-[1099px]:h-11 max-[1099px]:w-11',
          isDragging ? 'cursor-grabbing text-[var(--brand)]' : '',
        ]
          .filter(Boolean)
          .join(' '),
        title: 'Glisser pour réordonner',
        'aria-label': 'Glisser pour réordonner',
        role: 'button' as const,
        tabIndex: 0,
      }
    },
    [canDragKey, dragKey, enabled, onHandlePointerDown],
  )

  const showInsertMarkerAt = useCallback(
    (index: number) => {
      if (!dragKey || insertIndex == null) return false
      if (insertIndex !== index) return false
      const from = itemsRef.current.findIndex((x) => x.key === dragKey)
      if (from >= 0 && (insertIndex === from || insertIndex === from + 1)) {
        return false
      }
      return true
    },
    [dragKey, insertIndex],
  )

  return {
    getItemProps,
    getHandleProps,
    dragKey,
    insertIndex,
    showInsertMarkerAt,
    shouldSuppressClick,
    showHandles: enabled,
  }
}
