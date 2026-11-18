'use client'

import { useEffect } from 'react'

const KEYBOARD_THRESHOLD_PX = 120

/**
 * Sync CSS vars from visualViewport.
 * Vars: --vv-height, --vv-offset-top, --keyboard-inset
 * scrollIntoView uniquement au focusin (pas pendant la fermeture du clavier → « zoom »).
 */
export function useSoftKeyboardLayout() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let raf = 0
    let insetClearTimer = 0

    function applyVars(keyboardOpen: boolean, height: number, offsetTop: number, inset: number) {
      if (keyboardOpen) {
        window.clearTimeout(insetClearTimer)
        document.documentElement.style.setProperty('--vv-height', `${height}px`)
        document.documentElement.style.setProperty('--vv-offset-top', `${offsetTop}px`)
        document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`)
        return
      }
      // Clavier fermé : viewport layout stable (évite offset résiduel iOS).
      document.documentElement.style.setProperty('--vv-height', `${window.innerHeight}px`)
      document.documentElement.style.setProperty('--vv-offset-top', '0px')
      window.clearTimeout(insetClearTimer)
      insetClearTimer = window.setTimeout(() => {
        document.documentElement.style.setProperty('--keyboard-inset', '0px')
      }, 120)
    }

    function syncVars() {
      cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(() => {
        const height = vv!.height
        const offsetTop = vv!.offsetTop
        const inset = Math.max(0, window.innerHeight - height - offsetTop)
        applyVars(inset > KEYBOARD_THRESHOLD_PX, height, offsetTop, inset)
      })
    }

    function onFocusIn(e: FocusEvent) {
      syncVars()
      const el = e.target
      if (!(el instanceof HTMLElement)) return
      if (!el.matches('input:not([type="hidden"]), textarea, select')) return
      // Après ouverture clavier (court délai) — nearest évite le saut « zoom ».
      window.setTimeout(() => {
        const inset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop)
        if (inset <= KEYBOARD_THRESHOLD_PX) return
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
      }, 280)
    }

    syncVars()
    vv.addEventListener('resize', syncVars)
    vv.addEventListener('scroll', syncVars)
    window.addEventListener('focusin', onFocusIn)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(insetClearTimer)
      vv.removeEventListener('resize', syncVars)
      vv.removeEventListener('scroll', syncVars)
      window.removeEventListener('focusin', onFocusIn)
      document.documentElement.style.removeProperty('--vv-height')
      document.documentElement.style.removeProperty('--vv-offset-top')
      document.documentElement.style.removeProperty('--keyboard-inset')
    }
  }, [])
}
