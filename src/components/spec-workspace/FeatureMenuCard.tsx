'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import {
  saveSpecMenuArrival,
  saveSpecMenuFeatures,
  saveSpecTreeNodeRoute,
  uploadSpecMenuArrivalImage,
} from '../../app/admin/spec/actions'
import type { SpecFeature, SpecMenuPage, SpecTreeNode } from '../../lib/spec-workspace/types'
import { emptyFeature, emptyMenuPage } from '../../lib/spec-workspace/types'
import { specFeatureStyle } from '../../lib/spec-workspace/depthStyles'
import { CritiqueAside } from './CritiqueAside'
import { markSpecClean, markSpecDirty } from './SpecShell'

function newFeature(): SpecFeature {
  return emptyFeature()
}

function updateFeatureAt(
  list: SpecFeature[],
  id: string,
  patch: Partial<SpecFeature>
): SpecFeature[] {
  return list.map((f) => {
    const kids = f.children ?? []
    if (f.id === id) return { ...f, ...patch, children: patch.children ?? kids }
    if (kids.length) return { ...f, children: updateFeatureAt(kids, id, patch) }
    return { ...f, children: kids }
  })
}

function removeFeatureAt(list: SpecFeature[], id: string): SpecFeature[] {
  return list
    .filter((f) => f.id !== id)
    .map((f) => ({ ...f, children: removeFeatureAt(f.children ?? [], id) }))
}

function addChildAt(list: SpecFeature[], parentId: string, child: SpecFeature): SpecFeature[] {
  return list.map((f) => {
    const kids = f.children ?? []
    if (f.id === parentId) return { ...f, children: [...kids, child] }
    if (kids.length) return { ...f, children: addChildAt(kids, parentId, child) }
    return { ...f, children: kids }
  })
}

function syncDescriptionsFromDom(list: SpecFeature[], root: HTMLElement | null): SpecFeature[] {
  if (!root) return list
  return list.map((f) => {
    const el = root.querySelector(`[data-feature-desc="${f.id}"]`) as HTMLElement | null
    const critiqueEl = root.querySelector(`[data-feature-critique="${f.id}"]`) as HTMLElement | null
    const bodyHtml = el?.innerHTML ?? f.bodyHtml
    const critiqueHtml = critiqueEl?.innerHTML ?? f.critiqueHtml ?? ''
    return {
      ...f,
      bodyHtml,
      critiqueHtml,
      children: syncDescriptionsFromDom(f.children ?? [], root),
    }
  })
}

type FeatureCollapseSignal = { epoch: number; collapsed: boolean }

type FeatureNodeProps = {
  feature: SpecFeature
  depth: number
  pathLabels: string[]
  onChange: (id: string, patch: Partial<SpecFeature>) => void
  onAddChild: (parentId: string) => void
  onRemove: (id: string) => void
  onDirty: () => void
  collapseSignal?: FeatureCollapseSignal
}

function collectFeatureIds(list: SpecFeature[], out: string[] = []): string[] {
  for (const f of list) {
    out.push(f.id)
    collectFeatureIds(f.children ?? [], out)
  }
  return out
}

function FeatureNode({
  feature,
  depth,
  pathLabels,
  onChange,
  onAddChild,
  onRemove,
  onDirty,
  collapseSignal,
}: FeatureNodeProps) {
  const descRef = useRef<HTMLDivElement>(null)
  const style = specFeatureStyle(depth)
  const crumb = [...pathLabels, feature.label.trim() || 'Sans nom'].join(' › ')
  const kids = feature.children ?? []
  const [collapsed, setCollapsed] = useState(false)
  /** Remount children collapsed so expand only reveals the next level. */
  const [childMountKey, setChildMountKey] = useState(0)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(`spec-feature-collapsed:${feature.id}`) === '1')
    } catch {
      /* ignore */
    }
  }, [feature.id])

  useEffect(() => {
    if (!collapseSignal) return
    setCollapsed(collapseSignal.collapsed)
    try {
      window.localStorage.setItem(
        `spec-feature-collapsed:${feature.id}`,
        collapseSignal.collapsed ? '1' : '0'
      )
    } catch {
      /* ignore */
    }
  }, [collapseSignal, feature.id])

  useEffect(() => {
    if (descRef.current) {
      descRef.current.innerHTML = feature.bodyHtml || '<p></p>'
    }
  }, [feature.id])

  function persistCollapsed(id: string, value: boolean) {
    try {
      window.localStorage.setItem(`spec-feature-collapsed:${id}`, value ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  function collapseSubtree(list: SpecFeature[]) {
    for (const f of list) {
      persistCollapsed(f.id, true)
      collapseSubtree(f.children ?? [])
    }
  }

  function toggleCollapsed() {
    if (!collapsed && descRef.current) {
      onChange(feature.id, { bodyHtml: descRef.current.innerHTML })
      onDirty()
    }
    setCollapsed((prev) => {
      const next = !prev
      persistCollapsed(feature.id, next)
      if (prev && !next) {
        // Opening: only reveal immediate children, each collapsed (hides N+2…)
        collapseSubtree(kids)
        setChildMountKey((k) => k + 1)
      }
      return next
    })
  }

  return (
    <div className={depth > 0 ? 'mt-3' : undefined}>
      <div
        className={
          collapsed
            ? 'grid gap-2'
            : 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] lg:items-start'
        }
      >
        <div
          id={feature.id}
          className={`scroll-mt-28 ${collapsed ? 'rounded-lg border border-[var(--border)] bg-white px-3 py-2 shadow-sm' : style.card} ${collapsed ? '' : style.rail}`}
          style={depth > 0 ? { marginLeft: `${Math.min(depth, 5) * 16}px` } : undefined}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold text-[var(--brand)] hover:bg-[var(--accent)]"
              title={collapsed ? 'Déplier' : 'Réduire (titre + route)'}
              aria-expanded={!collapsed}
            >
              {collapsed ? '▸' : '▾'}
            </button>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${style.badge}`}>
              {collapsed ? `N${depth + 1}` : style.label}
            </span>
            {!collapsed ? (
              <span className="min-w-0 flex-1 truncate text-[11px] text-[color:var(--muted)]" title={crumb}>
                {crumb}
              </span>
            ) : null}
            {collapsed ? (
              <button
                type="button"
                onClick={() => onRemove(feature.id)}
                className="ml-auto rounded-full px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Supprimer
              </button>
            ) : null}
          </div>

          <div className={`flex flex-wrap items-start gap-2 ${collapsed ? 'mt-1.5' : 'mt-2'}`}>
            {!collapsed ? (
              <span
                className={`mt-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-extrabold text-white ${style.badge}`}
              >
                {depth + 1}
              </span>
            ) : null}
            <div
              className={`grid min-w-0 flex-1 gap-2 ${collapsed ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]' : 'sm:grid-cols-2'}`}
            >
              <label className="grid gap-1 text-[11px] font-semibold text-[color:var(--muted)]">
                {collapsed ? 'Titre' : 'Nom du bouton / fonctionnalité'}
                <input
                  value={feature.label}
                  onChange={(e) => {
                    onChange(feature.id, { label: e.target.value })
                    onDirty()
                  }}
                  className="rounded-md border border-[var(--border)] px-2 py-1.5 text-sm font-semibold text-[color:var(--fg)]"
                  placeholder="ex. Créer un programme"
                />
              </label>
              <label className="grid gap-1 text-[11px] font-semibold text-[color:var(--muted)]">
                Route
                <input
                  value={feature.route}
                  onChange={(e) => {
                    onChange(feature.id, { route: e.target.value })
                    onDirty()
                  }}
                  className="rounded-md border border-[var(--border)] px-2 py-1.5 font-mono text-sm text-[color:var(--fg)]"
                  placeholder="ex. /dashboard/programs/new"
                />
              </label>
            </div>
            {!collapsed ? (
              <button
                type="button"
                onClick={() => onRemove(feature.id)}
                className="mt-6 rounded-full px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Supprimer
              </button>
            ) : null}
          </div>

          <div className={collapsed ? 'hidden' : 'mt-3'}>
            <p className="mb-1 text-[11px] font-semibold text-[color:var(--muted)]">Description</p>
            <div
              ref={descRef}
              data-feature-desc={feature.id}
              contentEditable
              suppressContentEditableWarning
              onInput={onDirty}
              className="min-h-[4rem] rounded-md border border-dashed border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </div>

          {!collapsed ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onAddChild(feature.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-lg font-bold leading-none text-white hover:opacity-90"
                title="Ajouter une sous-fonctionnalité"
                aria-label="Ajouter une sous-fonctionnalité"
              >
                +
              </button>
              <span className="text-[11px] text-[color:var(--muted)]">
                Ajouter une sous-fonction (niveau {depth + 2})
              </span>
            </div>
          ) : kids.length > 0 ? (
            <p className="mt-1 text-[10px] text-[color:var(--muted)]">
              {kids.length} sous-carte{kids.length > 1 ? 's' : ''} masquée{kids.length > 1 ? 's' : ''}
            </p>
          ) : null}
        </div>

        <div className={collapsed ? 'hidden' : undefined}>
          <CritiqueAside
            entityId={feature.id}
            initialHtml={feature.critiqueHtml}
            dataAttr="data-feature-critique"
            dataValue={feature.id}
            onInput={onDirty}
          />
        </div>
      </div>

      {!collapsed && kids.length > 0
        ? kids.map((child) => (
            <FeatureNode
              key={`${child.id}-${childMountKey}`}
              feature={child}
              depth={depth + 1}
              pathLabels={[...pathLabels, feature.label.trim() || 'Sans nom']}
              onChange={onChange}
              onAddChild={onAddChild}
              onRemove={onRemove}
              onDirty={onDirty}
              collapseSignal={collapseSignal}
            />
          ))
        : null}
    </div>
  )
}

function statusLabel(status: 'idle' | 'pending' | 'saving' | 'saved' | 'error') {
  if (status === 'saving') return 'Enregistrement…'
  if (status === 'pending') return 'Non sauvé'
  if (status === 'saved') return 'Enregistré'
  if (status === 'error') return 'Erreur'
  return ''
}

type Props = {
  sectionId: string
  node: SpecTreeNode
  initial: SpecMenuPage
  liveFeatures?: SpecFeature[]
  onRouteChange?: (route: string) => void
  onFeaturesChange?: (features: SpecFeature[]) => void
}

export function FeatureMenuCard({
  sectionId,
  node,
  initial,
  liveFeatures,
  onRouteChange,
  onFeaturesChange,
}: Props) {
  const menu = initial ?? emptyMenuPage()
  const arrivalRef = useRef<HTMLDivElement>(null)
  const treeRootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [localFeatures, setLocalFeatures] = useState<SpecFeature[]>(menu.features ?? [])
  const features = liveFeatures ?? localFeatures
  const featuresRef = useRef(features)
  featuresRef.current = features
  const [images, setImages] = useState(menu.arrival?.images ?? [])
  const [arrivalCritique, setArrivalCritique] = useState(menu.arrival?.critiqueHtml ?? '')
  const [cardRoute, setCardRoute] = useState(node.route ?? '')
  const cardRouteRef = useRef(cardRoute)
  cardRouteRef.current = cardRoute
  const dirtyArrivalRef = useRef(false)
  const dirtyFeaturesRef = useRef(false)
  const dirtyRouteRef = useRef(false)
  const [arrivalStatus, setArrivalStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [featuresStatus, setFeaturesStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [routeStatus, setRouteStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [collapsed, setCollapsed] = useState(false)
  const [arrivalCollapsed, setArrivalCollapsed] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState<FeatureCollapseSignal | undefined>(undefined)

  const dirtyIdArrival = `${sectionId}:${node.id}:arrival`
  const dirtyIdFeatures = `${sectionId}:${node.id}:features`
  const dirtyIdRoute = `${sectionId}:${node.id}:route`

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(`spec-card-collapsed:${node.id}`) === '1')
      setArrivalCollapsed(window.localStorage.getItem(`spec-arrival-collapsed:${node.id}`) === '1')
    } catch {
      /* ignore */
    }
  }, [node.id])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(`spec-card-collapsed:${node.id}`, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function toggleArrivalCollapsed() {
    setArrivalCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(`spec-arrival-collapsed:${node.id}`, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function setFeatures(next: SpecFeature[] | ((prev: SpecFeature[]) => SpecFeature[])) {
    const value = typeof next === 'function' ? next(featuresRef.current) : next
    featuresRef.current = value
    setLocalFeatures(value)
    onFeaturesChange?.(value)
  }

  useEffect(() => {
    setCardRoute(node.route ?? '')
  }, [node.id, node.route])

  // Hydrate arrival only when switching menu — not after autosave revalidate
  useEffect(() => {
    if (arrivalRef.current) {
      arrivalRef.current.innerHTML = menu.arrival?.bodyHtml || '<p></p>'
    }
    setArrivalCritique(menu.arrival?.critiqueHtml ?? '')
    setImages(menu.arrival?.images ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id])

  async function persistRoute(route: string) {
    if (!dirtyRouteRef.current) return
    setError(null)
    setRouteStatus('saving')
    try {
      await saveSpecTreeNodeRoute(sectionId, node.id, route)
      onRouteChange?.(route)
      dirtyRouteRef.current = false
      markSpecClean(dirtyIdRoute)
      setRouteStatus('saved')
      window.setTimeout(() => setRouteStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
    } catch (e) {
      setRouteStatus('error')
      setError(e instanceof Error ? e.message : 'Erreur route')
    }
  }

  async function persistArrival() {
    if (!dirtyArrivalRef.current) return
    const html = arrivalRef.current?.innerHTML ?? ''
    const critiqueHtml =
      (document.querySelector(`[data-arrival-critique="${node.id}"]`) as HTMLElement | null)?.innerHTML ??
      arrivalCritique
    setError(null)
    setArrivalStatus('saving')
    try {
      await saveSpecMenuArrival(sectionId, node.id, html, critiqueHtml)
      setArrivalCritique(critiqueHtml)
      dirtyArrivalRef.current = false
      markSpecClean(dirtyIdArrival)
      setArrivalStatus('saved')
      window.setTimeout(() => setArrivalStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
    } catch (e) {
      setArrivalStatus('error')
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  async function persistFeatures() {
    if (!dirtyFeaturesRef.current) return
    const synced = syncDescriptionsFromDom(featuresRef.current, treeRootRef.current)
    setFeatures(synced)
    featuresRef.current = synced
    setError(null)
    setFeaturesStatus('saving')
    try {
      await saveSpecMenuFeatures(sectionId, node.id, synced)
      dirtyFeaturesRef.current = false
      markSpecClean(dirtyIdFeatures)
      setFeaturesStatus('saved')
      window.setTimeout(() => setFeaturesStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
    } catch (e) {
      setFeaturesStatus('error')
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  function markArrivalDirty() {
    dirtyArrivalRef.current = true
    setArrivalStatus('pending')
    markSpecDirty(dirtyIdArrival)
  }

  function markFeaturesDirty() {
    dirtyFeaturesRef.current = true
    setFeaturesStatus('pending')
    markSpecDirty(dirtyIdFeatures)
  }

  function markRouteDirty() {
    dirtyRouteRef.current = true
    setRouteStatus('pending')
    markSpecDirty(dirtyIdRoute)
  }

  function setAllFeaturesCollapsed(nextCollapsed: boolean) {
    for (const id of collectFeatureIds(featuresRef.current)) {
      try {
        window.localStorage.setItem(`spec-feature-collapsed:${id}`, nextCollapsed ? '1' : '0')
      } catch {
        /* ignore */
      }
    }
    setCollapseSignal((prev) => ({
      epoch: (prev?.epoch ?? 0) + 1,
      collapsed: nextCollapsed,
    }))
  }

  useEffect(() => {
    const onFlush = () => {
      startTransition(async () => {
        await persistArrival()
        await persistFeatures()
        await persistRoute(cardRouteRef.current)
      })
    }
    window.addEventListener('spec-flush-save', onFlush)
    return () => window.removeEventListener('spec-flush-save', onFlush)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, sectionId])

  function handleUpload(file: File) {
    const fd = new FormData()
    fd.set('file', file)
    setError(null)
    startTransition(async () => {
      try {
        const res = await uploadSpecMenuArrivalImage(sectionId, node.id, fd)
        setImages((prev) => [...prev, res.url])
        setArrivalStatus('saved')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur upload')
      }
    })
  }

  return (
    <div className="scroll-mt-28" id={node.id}>
      <article className="overflow-hidden rounded-[var(--radius-lg)] border-2 border-[var(--brand)]/15 bg-white shadow-sm">
        <header className="border-b border-[var(--border)] bg-[var(--brand)]/5 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-[var(--brand)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
              title={collapsed ? 'Déplier la card' : 'Replier la card'}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Déplier la card' : 'Replier la card'}
            >
              {collapsed ? '▸' : '▾'}
            </button>
            <h3 className="text-xl font-extrabold tracking-tight text-[var(--brand)]">{node.label}</h3>
            <a
              href="#route-tree"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-[var(--brand)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
              title="Retour à l’arbre des routes"
              aria-label="Retour à l’arbre des routes"
            >
              ↑
            </a>
            <span className="text-[10px] font-semibold text-[color:var(--muted)]">
              {[arrivalStatus, featuresStatus, routeStatus].includes('pending') ? 'Modifs non sauvées' : null}
            </span>
            {collapsed ? (
              <code className="ml-auto font-mono text-[11px] text-[color:var(--muted)]">{cardRoute || '—'}</code>
            ) : null}
          </div>
          {!collapsed ? (
          <label className="mt-2 grid max-w-xl gap-1 text-[11px] font-semibold text-[color:var(--muted)]">
            Route de la page
            <input
              value={cardRoute}
              onChange={(e) => {
                setCardRoute(e.target.value)
                onRouteChange?.(e.target.value)
                markRouteDirty()
              }}
              placeholder="ex. /dashboard/programs"
              className="min-w-0 w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 font-mono text-sm font-normal text-[color:var(--fg)] outline-none focus:border-[var(--brand)]"
            />
          </label>
          ) : null}
        </header>

        {!collapsed ? (
        <>
        <section className="border-b border-[var(--border)] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <button
                type="button"
                onClick={toggleArrivalCollapsed}
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold text-[var(--brand)] hover:bg-[var(--accent)]"
                title={arrivalCollapsed ? 'Déplier' : 'Réduire'}
                aria-expanded={!arrivalCollapsed}
              >
                {arrivalCollapsed ? '▸' : '▾'}
              </button>
              <div>
                <h4 className="text-sm font-extrabold text-[color:var(--fg)]">À l’arrivée</h4>
                {!arrivalCollapsed ? (
                  <p className="text-xs text-[color:var(--muted)]">
                    Ce que je vois quand j’ouvre cette page depuis la sidebar.
                  </p>
                ) : null}
              </div>
            </div>
            {!arrivalCollapsed ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)] disabled:opacity-50"
                >
                  Photo
                </button>
                {arrivalStatus !== 'idle' ? (
                  <span className="text-[10px] font-semibold text-[color:var(--muted)]">{statusLabel(arrivalStatus)}</span>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) handleUpload(file)
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className={arrivalCollapsed ? 'hidden' : undefined}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] lg:items-start">
            <div>
              <div
                ref={arrivalRef}
                contentEditable
                suppressContentEditableWarning
                onInput={markArrivalDirty}
                className="min-h-[5rem] rounded-lg border border-dashed border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
              />
              {images.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {images.map((url) => (
                    <figure key={url} className="overflow-hidden rounded-lg border border-[var(--border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="max-h-48 w-full object-contain bg-[var(--accent)]/30" />
                    </figure>
                  ))}
                </div>
              ) : null}
            </div>
            <CritiqueAside
              entityId={`arrival-${node.id}`}
              initialHtml={arrivalCritique}
              dataAttr="data-arrival-critique"
              dataValue={node.id}
              onInput={markArrivalDirty}
            />
          </div>
          </div>
        </section>

        <section className="p-5" ref={treeRootRef}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-[color:var(--fg)]">Header</h4>
              <p className="text-xs text-[color:var(--muted)]">
                <strong>+</strong> ajoute une action. ▾ réduit une fiche à titre + route.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAllFeaturesCollapsed(true)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand)] ring-1 ring-[var(--border)]"
              >
                Tout réduire
              </button>
              <button
                type="button"
                onClick={() => setAllFeaturesCollapsed(false)}
                className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]"
              >
                Tout déplier
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setFeatures((prev) => [...prev, newFeature()])
                  markFeaturesDirty()
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-2xl font-bold leading-none text-white shadow hover:opacity-90 disabled:opacity-50"
                title="Ajouter une fonctionnalité"
                aria-label="Ajouter une fonctionnalité"
              >
                +
              </button>
              {featuresStatus !== 'idle' ? (
                <span className="text-[10px] font-semibold text-[color:var(--muted)]">{statusLabel(featuresStatus)}</span>
              ) : null}
            </div>
          </div>

          {features.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[color:var(--muted)]">
              Aucune fonctionnalité. Clique sur <strong>+</strong> pour en ajouter une.
            </p>
          ) : (
            <div className="grid gap-3">
              {features.map((f) => (
                <FeatureNode
                  key={f.id}
                  feature={f}
                  depth={0}
                  pathLabels={[node.label]}
                  onChange={(id, patch) => setFeatures((prev) => updateFeatureAt(prev, id, patch))}
                  onAddChild={(parentId) => {
                    setFeatures((prev) => addChildAt(prev, parentId, newFeature()))
                    markFeaturesDirty()
                  }}
                  onRemove={(id) => {
                    setFeatures((prev) => removeFeatureAt(prev, id))
                    markFeaturesDirty()
                  }}
                  onDirty={markFeaturesDirty}
                  collapseSignal={collapseSignal}
                />
              ))}
            </div>
          )}
        </section>

        {error ? <p className="px-5 pb-4 text-sm text-red-600">{error}</p> : null}
        </>
        ) : null}
      </article>
    </div>
  )
}
