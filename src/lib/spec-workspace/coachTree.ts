import type { SpecBlock, SpecFeature, SpecMenuPage, SpecTreeNode } from '../../lib/spec-workspace/types'

export type LiveMenus = Record<string, { route: string; features: SpecFeature[] }>

export type FeatureDropTarget =
  | { mode: 'before'; featureId: string }
  | { mode: 'after'; featureId: string }
  | { mode: 'inside'; featureId: string }
  | { mode: 'menu-root'; menuId: string; at?: 'start' | 'end' }

export function featuresToTreeNodes(features: SpecFeature[]): SpecTreeNode[] {
  return features.map((f) => ({
    id: f.id,
    label: f.label.trim() || 'Sans nom',
    route: f.route || undefined,
    kind: 'feature' as const,
    children: f.children?.length ? featuresToTreeNodes(f.children) : undefined,
  }))
}

export function buildCoachLiveTree(baseTree: SpecTreeNode[], live: LiveMenus): SpecTreeNode[] {
  return baseTree.map((node) => {
    const state = live[node.id]
    return {
      ...node,
      route: state?.route ?? node.route,
      children: featuresToTreeNodes(state?.features ?? []),
    }
  })
}

export function initialLiveFromDoc(
  tree: SpecTreeNode[],
  menus: Record<string, SpecMenuPage> | undefined
): LiveMenus {
  const out: LiveMenus = {}
  for (const node of tree) {
    out[node.id] = {
      route: node.route ?? '',
      features: structuredClone(menus?.[node.id]?.features ?? []),
    }
  }
  return out
}

export function reorderMenus(
  tree: SpecTreeNode[],
  activeId: string,
  overId: string,
  place: 'before' | 'after' = 'before'
): SpecTreeNode[] {
  const oldIndex = tree.findIndex((n) => n.id === activeId)
  const overIndex = tree.findIndex((n) => n.id === overId)
  if (oldIndex < 0 || overIndex < 0) return tree

  const next = [...tree]
  const [item] = next.splice(oldIndex, 1)
  let insertAt = place === 'after' ? overIndex + 1 : overIndex
  if (oldIndex < insertAt) insertAt -= 1
  if (insertAt === oldIndex) return tree
  next.splice(insertAt, 0, item)
  return next
}

type Loc = { menuId: string; parentId: string | null; index: number; path: number[] }

function findLoc(live: LiveMenus, featureId: string): Loc | null {
  for (const [menuId, state] of Object.entries(live)) {
    const found = walk(state.features ?? [], featureId, menuId, null, [])
    if (found) return found
  }
  return null
}

function walk(
  list: SpecFeature[],
  id: string,
  menuId: string,
  parentId: string | null,
  path: number[]
): Loc | null {
  for (let i = 0; i < list.length; i++) {
    const f = list[i]
    const nextPath = [...path, i]
    if (f.id === id) return { menuId, parentId, index: i, path: nextPath }
    const nested = walk(f.children ?? [], id, menuId, f.id, nextPath)
    if (nested) return nested
  }
  return null
}

function getChildren(live: LiveMenus, menuId: string, parentId: string | null): SpecFeature[] {
  const roots = live[menuId]?.features ?? []
  if (!parentId) return roots
  const parent = findFeatureById(roots, parentId)
  return parent?.children ?? []
}

function findFeatureById(list: SpecFeature[], id: string): SpecFeature | null {
  for (const f of list) {
    if (f.id === id) return f
    const nested = findFeatureById(f.children ?? [], id)
    if (nested) return nested
  }
  return null
}

function updateChildren(
  features: SpecFeature[],
  parentId: string | null,
  nextChildren: SpecFeature[]
): SpecFeature[] {
  if (!parentId) return nextChildren
  return features.map((f) => {
    if (f.id === parentId) return { ...f, children: nextChildren }
    return { ...f, children: updateChildren(f.children ?? [], parentId, nextChildren) }
  })
}

function removeFeature(features: SpecFeature[], id: string): { next: SpecFeature[]; removed: SpecFeature | null } {
  const idx = features.findIndex((f) => f.id === id)
  if (idx >= 0) {
    const next = [...features]
    const [removed] = next.splice(idx, 1)
    return { next, removed }
  }
  let removed: SpecFeature | null = null
  const next = features.map((f) => {
    const res = removeFeature(f.children ?? [], id)
    if (res.removed) removed = res.removed
    return { ...f, children: res.next }
  })
  return { next, removed }
}

function isDescendant(features: SpecFeature[], ancestorId: string, maybeChildId: string): boolean {
  const ancestor = findFeatureById(features, ancestorId)
  if (!ancestor) return false
  return Boolean(findFeatureById(ancestor.children ?? [], maybeChildId))
}

/** Safe relocate: reorder siblings or change parent (level). */
export function relocateFeature(
  live: LiveMenus,
  activeId: string,
  target: FeatureDropTarget
): LiveMenus | null {
  try {
    const from = findLoc(live, activeId)
    if (!from) return null

    let destMenuId: string
    let destParentId: string | null
    let destIndex: number

    if (target.mode === 'menu-root') {
      destMenuId = target.menuId
      destParentId = null
      destIndex = target.at === 'start' ? 0 : getChildren(live, destMenuId, null).length
    } else {
      const to = findLoc(live, target.featureId)
      if (!to) return null
      if (activeId === target.featureId) return null

      destMenuId = to.menuId
      if (target.mode === 'inside') {
        // Can't nest a node under one of its own descendants
        if (isDescendant(live[from.menuId]?.features ?? [], activeId, target.featureId)) return null
        destParentId = target.featureId
        destIndex = getChildren(live, destMenuId, destParentId).length
      } else {
        if (isDescendant(live[from.menuId]?.features ?? [], activeId, target.featureId)) return null
        destParentId = to.parentId
        destIndex = target.mode === 'before' ? to.index : to.index + 1
      }
    }

    // Remove first
    const sourceFeatures = live[from.menuId]?.features ?? []
    const { next: withoutActive, removed } = removeFeature(sourceFeatures, activeId)
    if (!removed) return null

    let working: LiveMenus = {
      ...live,
      [from.menuId]: { ...live[from.menuId], features: withoutActive },
    }

    // Recompute dest index if same list and we removed an earlier item
    if (from.menuId === destMenuId && from.parentId === destParentId && from.index < destIndex) {
      destIndex -= 1
    }

    // After removal, if dest parent was the active node (shouldn't happen), abort
    if (destParentId === activeId) return null

    const destList = [...getChildren(working, destMenuId, destParentId)]
    const idx = Math.max(0, Math.min(destIndex, destList.length))
    destList.splice(idx, 0, removed)

    const destRoots = working[destMenuId]?.features ?? []
    const newDestRoots = updateChildren(destRoots, destParentId, destList)

    working = {
      ...working,
      [destMenuId]: {
        route: working[destMenuId]?.route ?? '',
        features: newDestRoots,
      },
    }

    return working
  } catch (e) {
    console.error('relocateFeature failed', e)
    return null
  }
}

export type PromoteToMenuResult = {
  live: LiveMenus
  tree: SpecTreeNode[]
  menuPage: SpecMenuPage
  sourceMenuId: string
  newMenuId: string
}

/**
 * Lift a feature to top-level menu: feature → Menu, its children → N1.
 * Inserted before/after the target menu in the sidebar tree.
 */
export function promoteFeatureToMenu(
  live: LiveMenus,
  tree: SpecTreeNode[],
  featureId: string,
  overMenuId: string,
  place: 'before' | 'after'
): PromoteToMenuResult | null {
  try {
    if (tree.some((n) => n.id === featureId)) return null

    const from = findLoc(live, featureId)
    if (!from) return null

    const overIndex = tree.findIndex((n) => n.id === overMenuId)
    if (overIndex < 0) return null

    const sourceFeatures = live[from.menuId]?.features ?? []
    const { next: withoutActive, removed } = removeFeature(sourceFeatures, featureId)
    if (!removed) return null

    const children = removed.children ?? []
    const menuNode: SpecTreeNode = {
      id: removed.id,
      label: removed.label.trim() || 'Sans nom',
      route: removed.route || undefined,
      kind: 'menu',
    }

    const nextTree = [...tree]
    const insertAt = place === 'after' ? overIndex + 1 : overIndex
    nextTree.splice(insertAt, 0, menuNode)

    const arrival: SpecBlock = {
      bodyHtml: removed.bodyHtml || '<p></p>',
      images: [...(removed.images ?? [])],
      critiqueHtml: removed.critiqueHtml,
    }

    const menuPage: SpecMenuPage = {
      arrival,
      features: structuredClone(children),
    }

    const nextLive: LiveMenus = {
      ...live,
      [from.menuId]: {
        route: live[from.menuId]?.route ?? '',
        features: withoutActive,
      },
      [removed.id]: {
        route: removed.route ?? '',
        features: structuredClone(children),
      },
    }

    return {
      live: nextLive,
      tree: nextTree,
      menuPage,
      sourceMenuId: from.menuId,
      newMenuId: removed.id,
    }
  } catch (e) {
    console.error('promoteFeatureToMenu failed', e)
    return null
  }
}
