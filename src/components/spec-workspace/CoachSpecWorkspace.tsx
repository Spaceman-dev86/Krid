'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  saveSpecMenusFeaturesBatch,
  saveSpecTreeAndMenuPages,
  saveSpecTreeOrder,
} from '../../app/admin/spec/actions'
import {
  buildCoachLiveTree,
  initialLiveFromDoc,
  promoteFeatureToMenu,
  relocateFeature,
  reorderMenus,
  type LiveMenus,
} from '../../lib/spec-workspace/coachTree'
import type { SpecFeature, SpecMenuPage, SpecTreeNode } from '../../lib/spec-workspace/types'
import { emptyMenuPage } from '../../lib/spec-workspace/types'
import { FeatureMenuCard } from './FeatureMenuCard'
import { RouteTree, type RouteTreeDragResult } from './RouteTree'

type Props = {
  sectionId: string
  tree: SpecTreeNode[]
  menus: Record<string, SpecMenuPage> | undefined
}

type Snapshot = {
  orderedTree: SpecTreeNode[]
  live: LiveMenus
  localMenus: Record<string, SpecMenuPage>
}

const MAX_UNDO = 40

function cloneSnapshot(
  orderedTree: SpecTreeNode[],
  live: LiveMenus,
  localMenus: Record<string, SpecMenuPage>
): Snapshot {
  return {
    orderedTree: structuredClone(orderedTree),
    live: structuredClone(live),
    localMenus: structuredClone(localMenus),
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest('[contenteditable="true"]'))
}

export function CoachSpecWorkspace({ sectionId, tree, menus }: Props) {
  const [orderedTree, setOrderedTree] = useState<SpecTreeNode[]>(tree)
  const [live, setLive] = useState<LiveMenus>(() => initialLiveFromDoc(tree, menus))
  const [localMenus, setLocalMenus] = useState<Record<string, SpecMenuPage>>(() =>
    structuredClone(menus ?? {})
  )
  const [undoCount, setUndoCount] = useState(0)

  const orderedTreeRef = useRef(orderedTree)
  const liveRef = useRef(live)
  const localMenusRef = useRef(localMenus)
  const pastRef = useRef<Snapshot[]>([])

  orderedTreeRef.current = orderedTree
  liveRef.current = live
  localMenusRef.current = localMenus

  const liveTree = useMemo(() => buildCoachLiveTree(orderedTree, live), [orderedTree, live])

  function pushHistory() {
    pastRef.current.push(
      cloneSnapshot(orderedTreeRef.current, liveRef.current, localMenusRef.current)
    )
    if (pastRef.current.length > MAX_UNDO) {
      pastRef.current.splice(0, pastRef.current.length - MAX_UNDO)
    }
    setUndoCount(pastRef.current.length)
  }

  function undo() {
    const snap = pastRef.current.pop()
    if (!snap) return
    const prevLive = liveRef.current
    const changedMenuIds = new Set<string>()
    for (const id of new Set([...Object.keys(snap.live), ...Object.keys(prevLive)])) {
      if (JSON.stringify(snap.live[id]?.features) !== JSON.stringify(prevLive[id]?.features)) {
        changedMenuIds.add(id)
      }
    }
    const treeChanged =
      snap.orderedTree.map((n) => n.id).join() !== orderedTreeRef.current.map((n) => n.id).join()

    setUndoCount(pastRef.current.length)
    setOrderedTree(snap.orderedTree)
    setLive(snap.live)
    setLocalMenus(snap.localMenus)

    if (treeChanged) {
      void saveSpecTreeOrder(
        sectionId,
        snap.orderedTree.map((n) => n.id)
      ).catch((e) => console.error(e))
    }
    if (changedMenuIds.size) {
      persistFeatures(snap.live, [...changedMenuIds])
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey || e.altKey) return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId])

  function handleRouteChange(menuId: string, route: string) {
    setLive((prev) => ({
      ...prev,
      [menuId]: { route, features: prev[menuId]?.features ?? [] },
    }))
  }

  function handleFeaturesChange(menuId: string, features: SpecFeature[]) {
    setLive((prev) => ({
      ...prev,
      [menuId]: { route: prev[menuId]?.route ?? '', features },
    }))
    setLocalMenus((prev) => ({
      ...prev,
      [menuId]: { ...(prev[menuId] ?? emptyMenuPage()), features },
    }))
  }

  function persistMenusOrder(nextTree: SpecTreeNode[]) {
    void saveSpecTreeOrder(
      sectionId,
      nextTree.map((n) => n.id)
    ).catch((e) => console.error(e))
  }

  function persistFeatures(nextLive: LiveMenus, changedMenuIds: string[]) {
    const updates: Record<string, SpecFeature[]> = {}
    for (const id of changedMenuIds) {
      updates[id] = nextLive[id]?.features ?? []
    }
    void saveSpecMenusFeaturesBatch(sectionId, updates).catch((e) => console.error(e))
  }

  function handleDragResult(result: RouteTreeDragResult) {
    try {
      if (result.type === 'reorder-menus') {
        const next = reorderMenus(orderedTree, result.activeId, result.overId, result.place)
        if (next === orderedTree) return
        pushHistory()
        setOrderedTree(next)
        persistMenusOrder(next)
        return
      }

      if (result.type === 'promote-to-menu') {
        const promoted = promoteFeatureToMenu(
          live,
          orderedTree,
          result.activeId,
          result.overMenuId,
          result.place
        )
        if (!promoted) return

        const sourcePage: SpecMenuPage = {
          ...(localMenus[promoted.sourceMenuId] ?? emptyMenuPage()),
          features: promoted.live[promoted.sourceMenuId]?.features ?? [],
        }

        pushHistory()
        setOrderedTree(promoted.tree)
        setLive(promoted.live)
        setLocalMenus((prev) => ({
          ...prev,
          [promoted.sourceMenuId]: sourcePage,
          [promoted.newMenuId]: promoted.menuPage,
        }))

        void saveSpecTreeAndMenuPages(sectionId, promoted.tree, {
          [promoted.sourceMenuId]: sourcePage,
          [promoted.newMenuId]: promoted.menuPage,
        }).catch((e) => console.error(e))
        return
      }

      const next = relocateFeature(live, result.activeId, result.target)
      if (!next) return
      const changed = Object.keys(next).filter((id) => next[id]?.features !== live[id]?.features)
      if (!changed.length) return
      pushHistory()
      setLive(next)
      setLocalMenus((prev) => {
        const copy = { ...prev }
        for (const id of changed) {
          copy[id] = { ...(copy[id] ?? emptyMenuPage()), features: next[id]?.features ?? [] }
        }
        return copy
      })
      persistFeatures(next, changed)
    } catch (e) {
      console.error('handleDragResult failed', e)
    }
  }

  return (
    <div className="grid gap-8">
      <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur">
        <p className="text-xs text-[color:var(--muted)]">
          Annuler un déplacement / promotion dans l’arbre —{' '}
          <kbd className="rounded bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[10px]">Ctrl</kbd>+
          <kbd className="rounded bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[10px]">Z</kbd>
          {undoCount > 0 ? (
            <span className="ml-2 tabular-nums text-[var(--brand)]">{undoCount} étape{undoCount > 1 ? 's' : ''}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={undo}
          disabled={undoCount === 0}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-4 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          title="Ctrl+Z"
        >
          ↶ Annuler
          {undoCount > 0 ? <span className="tabular-nums opacity-80">({undoCount})</span> : null}
        </button>
      </div>

      <RouteTree nodes={liveTree} onDragResult={handleDragResult} />
      {orderedTree.map((node) => (
        <FeatureMenuCard
          key={node.id}
          sectionId={sectionId}
          node={{ ...node, route: live[node.id]?.route ?? node.route }}
          initial={localMenus[node.id] ?? emptyMenuPage()}
          liveFeatures={live[node.id]?.features}
          onRouteChange={(route) => handleRouteChange(node.id, route)}
          onFeaturesChange={(features) => handleFeaturesChange(node.id, features)}
        />
      ))}
    </div>
  )
}
