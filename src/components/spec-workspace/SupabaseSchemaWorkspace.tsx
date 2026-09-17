'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  SCHEMA_DOMAINS,
  STATUS_LABEL,
  TARGET_SCHEMA_TABLES,
  buildSchemaEdges,
  type SchemaDomainId,
  type SchemaTable,
} from '../../lib/spec-workspace/supabaseSchema'

const CARD_W = 240
const ROW_H = 22
const HEADER_H = 36
const GAP_X = 48
const GAP_Y = 40
const COLS = 4

function tableHeight(t: SchemaTable) {
  return HEADER_H + t.columns.length * ROW_H + 8
}

function layoutTables(tables: SchemaTable[]) {
  const positions = new Map<string, { x: number; y: number; h: number }>()
  const colHeights = Array(COLS).fill(0)
  tables.forEach((t, i) => {
    const col = i % COLS
    const x = col * (CARD_W + GAP_X)
    const y = colHeights[col]
    const h = tableHeight(t)
    positions.set(t.name, { x, y, h })
    colHeights[col] = y + h + GAP_Y
  })
  const width = COLS * (CARD_W + GAP_X)
  const height = Math.max(...colHeights, 400)
  return { positions, width, height }
}

function statusColor(status: SchemaTable['status']) {
  switch (status) {
    case 'existing':
      return 'bg-emerald-500/20 text-emerald-300'
    case 'extend':
      return 'bg-sky-500/20 text-sky-300'
    case 'create':
      return 'bg-amber-500/20 text-amber-200'
    case 'replace':
      return 'bg-rose-500/20 text-rose-300'
  }
}

type SpecTab = 'schema' | 'sql' | 'new-project'

type SqlSlicePayload = {
  id: string
  title: string
  file: string
  sql: string
  runNow: boolean
  summary: string
}

export function SupabaseSchemaWorkspace({
  sqlSlices = [],
}: {
  sqlSlices?: SqlSlicePayload[]
}) {
  const [tab, setTab] = useState<SpecTab>('sql')
  const [activeSlice, setActiveSlice] = useState(sqlSlices[0]?.id ?? '01_helpers_profiles')
  const [domain, setDomain] = useState<SchemaDomainId>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [scale, setScale] = useState(0.85)
  const [pan, setPan] = useState({ x: 24, y: 24 })
  const [copied, setCopied] = useState(false)
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const currentSlice = sqlSlices.find((s) => s.id === activeSlice) ?? sqlSlices[0]

  const tables = useMemo(() => {
    let list = TARGET_SCHEMA_TABLES
    if (domain !== 'all') list = list.filter((t) => t.domain === domain)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.name.includes(q) ||
          t.columns.some((c) => c.name.includes(q) || (c.fk && c.fk.includes(q)))
      )
    }
    return list
  }, [domain, query])

  const edges = useMemo(() => buildSchemaEdges(tables), [tables])
  const { positions, width, height } = useMemo(() => layoutTables(tables), [tables])

  const related = useMemo(() => {
    if (!selected) return new Set<string>()
    const s = new Set<string>([selected])
    for (const e of edges) {
      const [fromT] = e.from.split('.')
      const [toT] = e.to.split('.')
      if (fromT === selected || toT === selected) {
        s.add(fromT)
        s.add(toT)
      }
    }
    return s
  }, [selected, edges])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-table-card]')) return
      drag.current = { ox: e.clientX, oy: e.clientY, px: pan.x, py: pan.y }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [pan]
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    setPan({
      x: drag.current.px + (e.clientX - drag.current.ox),
      y: drag.current.py + (e.clientY - drag.current.oy),
    })
  }, [])

  const onPointerUp = useCallback(() => {
    drag.current = null
  }, [])

  useEffect(() => {
    setPan({ x: 24, y: 24 })
  }, [domain, query])

  const edgePaths = useMemo(() => {
    const paths: { key: string; d: string; active: boolean }[] = []
    for (const e of edges) {
      const [fromT, fromC] = e.from.split('.')
      const [toT, toC] = e.to.split('.')
      const fromPos = positions.get(fromT)
      const toPos = positions.get(toT)
      if (!fromPos || !toPos) continue
      const fromTable = tables.find((t) => t.name === fromT)
      const toTable = tables.find((t) => t.name === toT)
      if (!fromTable || !toTable) continue
      const fromIdx = fromTable.columns.findIndex((c) => c.name === fromC)
      const toIdx = toTable.columns.findIndex((c) => c.name === toC)
      if (fromIdx < 0 || toIdx < 0) continue

      const x1 = fromPos.x + CARD_W
      const y1 = fromPos.y + HEADER_H + fromIdx * ROW_H + ROW_H / 2
      const x2 = toPos.x
      const y2 = toPos.y + HEADER_H + toIdx * ROW_H + ROW_H / 2
      const mx = (x1 + x2) / 2
      const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
      paths.push({
        key: `${e.from}->${e.to}`,
        d,
        active: selected ? related.has(fromT) && related.has(toT) : true,
      })
    }
    return paths
  }, [edges, positions, tables, selected, related])

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[var(--brand)]">Supabase · Schéma cible</h2>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)]">
            Spec + SQL Phase 2. Ne pas exécuter sur l’ancien projet Trainly — nouveau projet Supabase dédié.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
          {(['existing', 'extend', 'create', 'replace'] as const).map((s) => (
            <span key={s} className={`rounded-full px-2 py-0.5 ${statusColor(s)}`}>
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
        {(
          [
            { id: 'schema' as const, label: 'Visualiseur' },
            { id: 'sql' as const, label: 'SQL par tranches' },
            { id: 'new-project' as const, label: 'Nouveau projet' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-bold text-white'
                : 'rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--brand)]'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sql' ? (
        <div className="grid gap-3">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            <strong>Exécuter une tranche à la fois</strong> sur le nouveau projet seulement. Ordre : 01 → 02 → (plus
            tard) 03. Ne pas coller le monolithe entier.
          </div>
          <div className="flex flex-wrap gap-2">
            {sqlSlices.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSlice(s.id)}
                className={
                  activeSlice === s.id
                    ? 'rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-bold text-white'
                    : 'rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold'
                }
              >
                {s.title}
                {!s.runNow ? ' · plus tard' : ''}
              </button>
            ))}
          </div>
          {currentSlice ? (
            <>
              <p className="text-sm text-[color:var(--muted)]">
                <code className="text-xs">{currentSlice.file}</code> — {currentSlice.summary}
                {currentSlice.runNow ? (
                  <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    À RUN MAINTENANT
                  </span>
                ) : (
                  <span className="ml-2 rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px] font-bold">ATTENDRE</span>
                )}
              </p>
              <button
                type="button"
                className="w-fit rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-bold text-white"
                onClick={async () => {
                  await navigator.clipboard.writeText(currentSlice.sql)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2000)
                }}
              >
                {copied ? 'Copié' : `Copier ${currentSlice.title}`}
              </button>
              <pre className="max-h-[min(70vh,900px)] overflow-auto rounded-xl border border-slate-700 bg-[#0f1419] p-4 font-mono text-[11px] leading-relaxed text-slate-200">
                {currentSlice.sql}
              </pre>
            </>
          ) : (
            <p className="text-sm text-[color:var(--muted)]">Aucune tranche SQL chargée.</p>
          )}
        </div>
      ) : null}

      {tab === 'new-project' ? (
        <div className="grid max-w-3xl gap-4 text-sm leading-relaxed text-[var(--foreground)]">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--accent)]/40 p-4">
            <h3 className="text-base font-extrabold text-[var(--brand)]">Stratégie propre (recommandée)</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>
                Créer un <strong>nouveau projet Supabase</strong> (ex. <code>trainly-saas</code>) — région proche,
                vide.
              </li>
              <li>
                <strong>Ne jamais</strong> coller le SQL Phase 2 dans l’ancien projet (demo_*, policies ouvertes,
                historique programmes).
              </li>
              <li>
                Dans le <em>nouveau</em> projet : SQL Editor → coller les tranches une par une (01 puis 02) depuis
                l’onglet « SQL par tranches » — pas le monolithe.
              </li>
              <li>
                Côté app : garder l’ancien <code>.env.local</code> intact. Créer{' '}
                <code>.env.local.saas</code> (ou basculer quand tu es prêt) avec les{' '}
                <strong>nouvelles</strong> clés URL / anon / service_role.
              </li>
              <li>
                Tant que tu développes le SaaS : pointer le code vers le nouveau projet. L’ancien reste pour
                démos / programmes existants.
              </li>
            </ol>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <h3 className="font-extrabold text-[var(--brand)]">Ce qu’on ne fait pas</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--muted)]">
              <li>Pas de migration « big bang » des tables demo_* vers le nouveau schéma</li>
              <li>Pas de RLS partielle sur l’ancien monolithe (risque de casser l’existant)</li>
              <li>Pas de partage service_role entre les deux projets</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <h3 className="font-extrabold text-[var(--brand)]">Quand basculer l’app</h3>
            <p className="mt-2 text-[color:var(--muted)]">
              Quand le shell coach + clients tournent sur le nouveau projet : remplacer les 3 variables Supabase
              dans <code>.env.local</code>, redémarrer <code>npm run dev</code>, vérifier login coach / admin.
              L’ancien projet peut rester en lecture / archive.
            </p>
          </div>
        </div>
      ) : null}

      {tab === 'schema' ? (
        <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher table / colonne…"
          className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-1">
          {SCHEMA_DOMAINS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDomain(d.id)}
              className={
                domain === d.id
                  ? 'rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]'
              }
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs font-bold"
            onClick={() => setScale((s) => Math.max(0.4, s - 0.1))}
          >
            −
          </button>
          <span className="w-12 text-center text-xs text-[color:var(--muted)]">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs font-bold"
            onClick={() => setScale((s) => Math.min(1.6, s + 0.1))}
          >
            +
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs font-semibold"
            onClick={() => {
              setScale(0.85)
              setPan({ x: 24, y: 24 })
              setSelected(null)
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <p className="text-xs text-[color:var(--muted)]">
        {tables.length} table{tables.length > 1 ? 's' : ''} · {edgePaths.length} lien
        {edgePaths.length > 1 ? 's' : ''} FK
        {selected ? (
          <>
            {' '}
            · sélection <code className="text-[var(--brand)]">{selected}</code>
          </>
        ) : null}
      </p>

      <div
        ref={canvasRef}
        className="relative h-[min(75vh,900px)] cursor-grab overflow-hidden rounded-xl border border-[var(--border)] bg-[#0f1419] active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={(e) => {
          e.preventDefault()
          setScale((s) => Math.min(1.6, Math.max(0.4, s - e.deltaY * 0.001)))
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            width,
            height,
          }}
        >
          <svg
            className="pointer-events-none absolute left-0 top-0"
            width={width}
            height={height}
            style={{ overflow: 'visible' }}
          >
            {edgePaths.map((p) => (
              <path
                key={p.key}
                d={p.d}
                fill="none"
                stroke={p.active ? '#3ecf8e' : '#334155'}
                strokeWidth={p.active ? 2 : 1}
                opacity={selected && !p.active ? 0.15 : 0.85}
              />
            ))}
          </svg>

          {tables.map((t) => {
            const pos = positions.get(t.name)!
            const isSel = selected === t.name
            const dim = selected && !related.has(t.name)
            return (
              <div
                key={t.name}
                data-table-card
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected((cur) => (cur === t.name ? null : t.name))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelected((cur) => (cur === t.name ? null : t.name))
                  }
                }}
                className={`absolute overflow-hidden rounded-lg border text-left shadow-lg transition-opacity ${
                  isSel ? 'border-[#3ecf8e] ring-2 ring-[#3ecf8e]/40' : 'border-slate-600'
                } ${dim ? 'opacity-25' : 'opacity-100'}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: CARD_W,
                  background: '#1c2333',
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-600 bg-[#151b28] px-2.5 py-2">
                  <span className="truncate font-mono text-xs font-bold text-white">{t.name}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${statusColor(t.status)}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <ul className="py-1">
                  {t.columns.map((c) => (
                    <li
                      key={c.name}
                      className="flex items-center gap-1.5 px-2.5 font-mono text-[10px] leading-[22px] text-slate-300"
                      title={c.note || (c.fk ? `→ ${c.fk}` : undefined)}
                    >
                      <span className="w-3 shrink-0 text-center text-[11px]" aria-hidden>
                        {c.pk ? '🔑' : c.fk ? '🔗' : c.unique ? '⌁' : c.nullable === false ? '◆' : '◇'}
                      </span>
                      <span className={`min-w-0 flex-1 truncate ${c.pk ? 'font-semibold text-white' : ''}`}>
                        {c.name}
                      </span>
                      <span className="shrink-0 text-slate-500">{c.type}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {tables.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Aucune table pour ce filtre.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--accent)]/40 px-3 py-2 text-xs text-[color:var(--muted)]">
        Légende colonnes : 🔑 PK · 🔗 FK · ⌁ unique · ◆ non-null · ◇ nullable. Survol d’une ligne pour note / cible
        FK. Les liens verts = relations filtrées (domaine visible).
      </div>
        </>
      ) : null}
    </div>
  )
}
