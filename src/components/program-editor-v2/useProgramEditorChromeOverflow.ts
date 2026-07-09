'use client'

import { useEffect, useMemo, useState, type RefObject } from 'react'

export const EDITOR_CHROME_MOBILE_MAX_PX = 767

export type ChromeCoachActionId = 'commander' | 'preview' | 'delete' | 'persistence'
export type ChromeAdminActionId = 'preview' | 'send' | 'publish' | 'editCover' | 'delete' | 'persistence'
export type ChromeActionId = ChromeCoachActionId | ChromeAdminActionId

const GAP_PX = 8
const BACK_PX = 40
const HAMBURGER_PX = 40
const ADD_TO_BAR_SLACK_PX = 20

/** Premier à entrer dans le hamburger quand la page rétrécit. */
const COACH_OVERFLOW_ORDER: { id: ChromeCoachActionId; width: number }[] = [
  { id: 'commander', width: 156 },
  { id: 'delete', width: 40 },
  { id: 'persistence', width: 108 },
  { id: 'preview', width: 128 },
]

const ADMIN_OVERFLOW_ORDER: { id: ChromeAdminActionId; width: number }[] = [
  { id: 'send', width: 96 },
  { id: 'publish', width: 84 },
  { id: 'editCover', width: 104 },
  { id: 'delete', width: 40 },
  { id: 'persistence', width: 108 },
  { id: 'preview', width: 128 },
]

/** Ordre d’affichage dans la barre — preview toujours avant delete. */
export const CHROME_BAR_DISPLAY_ORDER: ChromeActionId[] = [
  'persistence',
  'commander',
  'send',
  'publish',
  'editCover',
  'preview',
  'delete',
]

function filterAdminItems(isPublished: boolean) {
  return ADMIN_OVERFLOW_ORDER.filter((a) => (isPublished ? a.id !== 'publish' : a.id !== 'editCover'))
}

function getOverflowItems(isAdmin: boolean, isPublished: boolean) {
  if (isAdmin) return filterAdminItems(isPublished)
  return COACH_OVERFLOW_ORDER
}

function countBarItems(
  containerWidth: number,
  items: { id: ChromeActionId; width: number }[],
  slackPx: number,
  reserveHamburger: boolean
) {
  const fixed =
    BACK_PX + GAP_PX + (reserveHamburger ? HAMBURGER_PX + GAP_PX : 0)
  let space = containerWidth - fixed + slackPx
  let barCount = 0

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i]
    const need = item.width + (barCount > 0 ? GAP_PX : 0)
    if (space >= need) {
      barCount += 1
      space -= need
    } else {
      break
    }
  }

  return barCount
}

function applyHysteresis(
  prev: number,
  containerWidth: number,
  items: { id: ChromeActionId; width: number }[],
  reserveHamburger: boolean
) {
  const tight = countBarItems(containerWidth, items, 0, reserveHamburger)
  const loose = countBarItems(containerWidth, items, ADD_TO_BAR_SLACK_PX, reserveHamburger)
  if (prev > tight) return tight
  if (prev < loose) return loose
  return prev
}

function resolveBarCount(
  containerWidth: number,
  items: { id: ChromeActionId; width: number }[],
  prevBarCount: number
) {
  if (items.length === 0) return 0

  let barCount = applyHysteresis(prevBarCount, containerWidth, items, false)
  const menuCountWithout = items.length - barCount
  const needsHamburger = menuCountWithout > 0 && items.slice(0, menuCountWithout).some((a) => a.id === items[0].id)

  if (needsHamburger) {
    barCount = applyHysteresis(barCount, containerWidth, items, true)
  }

  return barCount
}

export function useProgramEditorChromeOverflow(
  containerRef: RefObject<HTMLElement | null>,
  options: { isAdmin: boolean; isPublished: boolean; enabled: boolean }
) {
  const [containerWidth, setContainerWidth] = useState(0)
  const [barCount, setBarCount] = useState(0)

  useEffect(() => {
    if (!options.enabled) return
    const el = containerRef.current
    if (!el) return

    const update = () => setContainerWidth(el.clientWidth)
    update()

    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, options.enabled])

  const items = useMemo(
    () => getOverflowItems(options.isAdmin, options.isPublished),
    [options.isAdmin, options.isPublished]
  )

  useEffect(() => {
    if (!options.enabled || containerWidth <= 0 || items.length === 0) return
    setBarCount((prev) => resolveBarCount(containerWidth, items, prev))
  }, [containerWidth, items, options.enabled])

  const { inline, overflow, showHamburger } = useMemo(() => {
    const effectiveBarCount = containerWidth <= 0 ? items.length : barCount
    const menuCount = Math.max(0, items.length - effectiveBarCount)
    const overflowIds = items.slice(0, menuCount).map((a) => a.id)
    const inlineIds = items.slice(menuCount).map((a) => a.id)
    const hamburgerTriggerId = items[0]?.id
    const showMenu = Boolean(hamburgerTriggerId && overflowIds.includes(hamburgerTriggerId))

    return {
      inline: inlineIds,
      overflow: overflowIds,
      showHamburger: showMenu,
    }
  }, [barCount, containerWidth, items])

  const barOrder = useMemo(
    () => CHROME_BAR_DISPLAY_ORDER.filter((id) => inline.includes(id)),
    [inline]
  )

  return {
    inline,
    overflow,
    barOrder,
    showHamburger,
  }
}
