'use client'

import { useEffect } from 'react'

const SCROLL_EDGE_PX = 72
const SCROLL_STEP_PX = 18

/**
 * Fait défiler le conteneur principal de l’éditeur quand le pointeur approche des bords pendant un drag.
 */
export function useEditorDragAutoScroll(active: boolean) {
  useEffect(() => {
    if (!active) return

    let raf = 0

    const tick = (clientY: number) => {
      const main = document.querySelector<HTMLElement>('[data-program-editor-scroll]')
      if (!main) return

      const rect = main.getBoundingClientRect()
      const distTop = clientY - rect.top
      const distBottom = rect.bottom - clientY

      if (distTop < SCROLL_EDGE_PX && distTop >= 0) {
        main.scrollTop -= SCROLL_STEP_PX * (1 - distTop / SCROLL_EDGE_PX)
      } else if (distBottom < SCROLL_EDGE_PX && distBottom >= 0) {
        main.scrollTop += SCROLL_STEP_PX * (1 - distBottom / SCROLL_EDGE_PX)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => tick(e.clientY))
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(raf)
    }
  }, [active])
}
