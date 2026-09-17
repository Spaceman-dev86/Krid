'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'

import type { FeatureDropTarget } from '../../lib/spec-workspace/coachTree'
import { specTreeDepthMeta } from '../../lib/spec-workspace/depthStyles'
import type { SpecTreeNode } from '../../lib/spec-workspace/types'

const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pointerHits
  const rectHits = rectIntersection(args)
  if (rectHits.length > 0) return rectHits
  return closestCenter(args)
}

function collectExpandableIds(nodes: SpecTreeNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children?.length) {
      out.push(node.id)
      collectExpandableIds(node.children, out)
    }
  }
  return out
}

/** Stable signature of which nodes have children — used to re-sync expand state. */
function expandableSignature(nodes: SpecTreeNode[]): string {
  return collectExpandableIds(nodes).sort().join('|')
}

function findNodeLabel(nodes: SpecTreeNode[], id: string): string {
  for (const n of nodes) {
    if (n.id === id) return n.label
    if (n.children?.length) {
      const found = findNodeLabel(n.children, id)
      if (found) return found
    }
  }
  return id
}

function DragHandle({ id, kind }: { id: string; kind: 'menu' | 'feature' }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: kind === 'menu' ? `drag-menu-${id}` : `drag-feat-${id}`,
    data: { kind, entityId: id },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={[
        'inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded text-sm text-[color:var(--muted)] hover:bg-[var(--accent)] active:cursor-grabbing',
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
      title="Glisser pour déplacer"
      {...listeners}
      {...attributes}
    >
      ⠿
    </button>
  )
}

function DropGap({ id, open }: { id: string; open: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !open })

  return (
    <div
      ref={setNodeRef}
      className={[
        'mx-0.5 rounded-md transition-[height,background-color,border-color] duration-100 ease-out',
        open
          ? isOver
            ? 'h-10 border border-dashed border-emerald-500 bg-emerald-100'
            : 'h-8 border border-dashed border-emerald-300/80 bg-emerald-50/80'
          : 'pointer-events-none h-0 overflow-hidden border-0',
      ].join(' ')}
      aria-hidden
    />
  )
}

function NestHint({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <span className="shrink-0 self-center rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
      ↳
    </span>
  )
}

function TreeRow({
  node,
  kind,
  depth,
  isOpen,
  onToggle,
  dnd = true,
  showNestHint = false,
}: {
  node: SpecTreeNode
  kind: 'menu' | 'feature'
  depth: number
  isOpen: boolean
  onToggle: () => void
  dnd?: boolean
  showNestHint?: boolean
}) {
  const meta = specTreeDepthMeta(kind, depth)
  const hasChildren = Boolean(node.children?.length)

  return (
    <div className="flex items-stretch gap-1.5">
      <div
        className={[
          'flex min-w-0 flex-1 items-center gap-1.5 rounded-md border-l-4 bg-white px-2 py-2 text-sm shadow-sm',
          meta.border,
        ].join(' ')}
      >
        {dnd ? (
          <DragHandle id={node.id} kind={kind} />
        ) : (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-sm text-[color:var(--muted)]">
            ⠿
          </span>
        )}
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold text-[var(--brand)] hover:bg-[var(--accent)]"
            title={isOpen ? 'Replier' : 'Ouvrir'}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="inline-block w-8 shrink-0" />
        )}
        <a href={`#${node.id}`} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${meta.badgeClass}`}>
            {meta.badge}
          </span>
          <span className="font-semibold text-[var(--brand)] hover:underline">{node.label}</span>
          {node.route ? <code className="truncate text-[11px] text-[color:var(--muted)]">{node.route}</code> : null}
        </a>
      </div>
      {kind === 'feature' && dnd ? <NestHint active={showNestHint} /> : null}
    </div>
  )
}

function FeatureList({
  features,
  depth,
  open,
  toggle,
  dragging,
  listKey,
}: {
  features: SpecTreeNode[]
  depth: number
  open: Set<string>
  toggle: (id: string) => void
  dragging: boolean
  listKey: string
}) {
  if (!features.length) {
    return (
      <DropGap
        id={depth === 1 ? `drop-menu-start-${listKey}` : `drop-inside-${listKey}`}
        open={dragging}
      />
    )
  }

  return (
    <div className="grid" style={{ marginLeft: depth > 1 ? 12 : 0 }}>
      <DropGap
        id={depth === 1 ? `drop-menu-start-${listKey}` : `drop-before-${features[0].id}`}
        open={dragging}
      />

      {features.map((f) => {
        const childOpen = open.has(f.id)
        const hasKids = (f.children?.length ?? 0) > 0
        return (
          <div key={f.id} className="grid">
            <TreeRow
              node={f}
              kind="feature"
              depth={depth}
              isOpen={childOpen}
              onToggle={() => toggle(f.id)}
              showNestHint={dragging}
            />
            {/* Nest lane: only while dragging — first child or add under this feature */}
            <DropGap id={`drop-inside-${f.id}`} open={dragging} />
            {childOpen && hasKids ? (
              <div className="border-l-2 border-[var(--brand)]/20 pl-3">
                <FeatureList
                  features={f.children ?? []}
                  depth={depth + 1}
                  open={open}
                  toggle={toggle}
                  dragging={dragging}
                  listKey={f.id}
                />
              </div>
            ) : null}
            <DropGap id={`drop-after-${f.id}`} open={dragging} />
          </div>
        )
      })}
    </div>
  )
}

export type RouteTreeDragResult =
  | { type: 'reorder-menus'; activeId: string; overId: string; place: 'before' | 'after' }
  | { type: 'promote-to-menu'; activeId: string; overMenuId: string; place: 'before' | 'after' }
  | { type: 'relocate-feature'; activeId: string; target: FeatureDropTarget }

type Props = {
  nodes: SpecTreeNode[]
  onDragResult?: (result: RouteTreeDragResult) => void
}

function parseOverId(
  overId: string
):
  | FeatureDropTarget
  | { type: 'menu-reorder'; menuId: string; place: 'before' | 'after' }
  | null {
  if (overId.startsWith('drop-before-')) {
    return { mode: 'before', featureId: overId.slice('drop-before-'.length) }
  }
  if (overId.startsWith('drop-after-')) {
    return { mode: 'after', featureId: overId.slice('drop-after-'.length) }
  }
  if (overId.startsWith('drop-inside-')) {
    return { mode: 'inside', featureId: overId.slice('drop-inside-'.length) }
  }
  if (overId.startsWith('drop-menu-start-')) {
    return { mode: 'menu-root', menuId: overId.slice('drop-menu-start-'.length), at: 'start' }
  }
  if (overId.startsWith('drop-menu-end-')) {
    return { mode: 'menu-root', menuId: overId.slice('drop-menu-end-'.length), at: 'end' }
  }
  if (overId.startsWith('gap-before-menu-')) {
    return { type: 'menu-reorder', menuId: overId.slice('gap-before-menu-'.length), place: 'before' }
  }
  if (overId.startsWith('gap-after-menu-')) {
    return { type: 'menu-reorder', menuId: overId.slice('gap-after-menu-'.length), place: 'after' }
  }
  return null
}

/** Static tree (SSR + first paint) — no dnd-kit attrs → no hydration mismatch. */
function StaticTree({
  nodes,
  open,
  toggle,
}: {
  nodes: SpecTreeNode[]
  open: Set<string>
  toggle: (id: string) => void
}) {
  return (
    <div className="grid gap-2">
      {nodes.map((menu) => {
        const menuOpen = open.has(menu.id)
        return (
          <div key={menu.id} className="rounded-lg border border-[var(--border)] bg-[var(--accent)]/20 p-2">
            <TreeRow
              node={menu}
              kind="menu"
              depth={0}
              isOpen={menuOpen}
              onToggle={() => toggle(menu.id)}
              dnd={false}
            />
            {menuOpen && (menu.children?.length ?? 0) > 0 ? (
              <div className="mt-1 grid gap-1 pl-1">
                {(menu.children ?? []).map((f) => (
                  <TreeRow
                    key={f.id}
                    node={f}
                    kind="feature"
                    depth={1}
                    isOpen={open.has(f.id)}
                    onToggle={() => toggle(f.id)}
                    dnd={false}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function DndTree({
  nodes,
  open,
  toggle,
  ensureOpen,
  onDragResult,
}: {
  nodes: SpecTreeNode[]
  open: Set<string>
  toggle: (id: string) => void
  ensureOpen: (id: string) => void
  onDragResult?: (result: RouteTreeDragResult) => void
}) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const dragging = Boolean(activeId)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id)
  }

  function handleDragOver(event: { over: { id: UniqueIdentifier } | null }) {
    const overRaw = event.over ? String(event.over.id) : ''
    if (overRaw.startsWith('drop-inside-')) {
      ensureOpen(overRaw.slice('drop-inside-'.length))
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const overRaw = String(over.id)
    const entityId = String(active.data.current?.entityId ?? '')
    const kind = active.data.current?.kind as 'menu' | 'feature' | undefined
    if (!entityId || !kind) return
    if (String(active.id) === overRaw) return

    try {
      const parsed = parseOverId(overRaw)
      if (!parsed) return

      if (kind === 'menu') {
        if ('type' in parsed && parsed.type === 'menu-reorder') {
          if (entityId !== parsed.menuId) {
            onDragResult?.({
              type: 'reorder-menus',
              activeId: entityId,
              overId: parsed.menuId,
              place: parsed.place,
            })
          }
        }
        return
      }

      // Feature dropped on a menu-level gap → promote to Menu (children become N1)
      if ('type' in parsed && parsed.type === 'menu-reorder') {
        onDragResult?.({
          type: 'promote-to-menu',
          activeId: entityId,
          overMenuId: parsed.menuId,
          place: parsed.place,
        })
        return
      }

      if (!('mode' in parsed)) return

      onDragResult?.({
        type: 'relocate-feature',
        activeId: entityId,
        target: parsed,
      })

      if (parsed.mode === 'inside') {
        ensureOpen(parsed.featureId)
      }
    } catch (e) {
      console.error('RouteTree drag end failed', e)
    }
  }

  const overlayLabel = activeId
    ? findNodeLabel(nodes, String(activeId).replace(/^drag-(menu|feat)-/, ''))
    : null
  const lastMenuId = nodes[nodes.length - 1]?.id

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Pour déplacer, maintenir puis glisser.',
        },
      }}
    >
      <div className="grid">
        {nodes.map((menu) => {
          const menuOpen = open.has(menu.id)
          return (
            <div key={menu.id} className="grid">
              <DropGap id={`gap-before-menu-${menu.id}`} open={dragging} />
              <div className="rounded-lg border border-[var(--border)] bg-[var(--accent)]/20 p-2">
                <TreeRow
                  node={menu}
                  kind="menu"
                  depth={0}
                  isOpen={menuOpen}
                  onToggle={() => toggle(menu.id)}
                />
                {menuOpen ? (
                  <div className="pl-1">
                    <FeatureList
                      features={menu.children ?? []}
                      depth={1}
                      open={open}
                      toggle={toggle}
                      dragging={dragging}
                      listKey={menu.id}
                    />
                  </div>
                ) : dragging ? (
                  <DropGap id={`drop-menu-start-${menu.id}`} open />
                ) : null}
              </div>
            </div>
          )
        })}
        {lastMenuId ? <DropGap id={`gap-after-menu-${lastMenuId}`} open={dragging} /> : null}
      </div>

      <DragOverlay dropAnimation={null}>
        {overlayLabel ? (
          <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2.5 text-sm font-semibold shadow-lg">
            {overlayLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export function RouteTree({ nodes, onDragResult }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [ready, setReady] = useState(false)
  const knownExpandableRef = useRef<Set<string>>(new Set())
  const expandSig = expandableSignature(nodes)

  useEffect(() => {
    const all = collectExpandableIds(nodes)
    try {
      const raw = window.localStorage.getItem('spec-route-tree-open')
      if (raw) {
        const saved = JSON.parse(raw) as string[]
        const menuIds = new Set(nodes.map((n) => n.id))
        // Ancien storage = menus seuls → arbre « plat » vs timeline toujours dépliée
        const opensNested = saved.some((id) => !menuIds.has(id))
        setOpen(opensNested ? new Set(saved) : new Set(all))
      } else {
        setOpen(new Set(all))
      }
    } catch {
      setOpen(new Set(all))
    }
    knownExpandableRef.current = new Set(all)
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Nouveaux parents (DnD / sous-fonctions) : les ouvrir pour coller à la timeline
  useEffect(() => {
    if (!ready) return
    const all = collectExpandableIds(nodes)
    const known = knownExpandableRef.current
    setOpen((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const id of all) {
        if (!known.has(id)) {
          next.add(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
    knownExpandableRef.current = new Set(all)
  }, [expandSig, ready, nodes])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem('spec-route-tree-open', JSON.stringify([...open]))
    } catch {
      /* ignore */
    }
  }, [open, ready])

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function ensureOpen(id: string) {
    setOpen((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  if (!nodes.length) return null

  return (
    <section
      id="route-tree"
      className="scroll-mt-28 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/60 p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[color:var(--muted)]">
            Arbre des routes
          </h2>
          <p className="mt-1 max-w-xl text-xs text-[color:var(--muted)]">
            Même hiérarchie que la timeline (menus → N1 → N2…). Glisser <strong>⠿</strong> pour
            déplacer ; bande sous une fiche = enfant ; espaces entre menus = promotion Menu.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(new Set(collectExpandableIds(nodes)))}
            className="rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-semibold text-[var(--brand)]"
          >
            Tout ouvrir
          </button>
          <button
            type="button"
            onClick={() => setOpen(new Set())}
            className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--brand)] ring-1 ring-[var(--border)]"
          >
            Tout fermer
          </button>
        </div>
      </div>

      <div className="mt-4">
        {ready ? (
          <DndTree
            nodes={nodes}
            open={open}
            toggle={toggle}
            ensureOpen={ensureOpen}
            onDragResult={onDragResult}
          />
        ) : (
          <StaticTree nodes={nodes} open={open} toggle={toggle} />
        )}
      </div>
    </section>
  )
}
