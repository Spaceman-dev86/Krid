'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Button, daFieldClass, daSelectClass } from '@/src/components/ui'

type Opt = { id: string; label: string }

type Props = {
  basePath: string
  mode: 'trainly' | 'coach'
  kind?: 'exercises' | 'blocks' | 'sessions'
  view?: string
  initialQ?: string
  initialCoach?: string
  initialSport?: string
  initialType?: string
  showCoachFilter?: boolean
  sportOptions?: Opt[]
  typeOptions?: Opt[]
  titlePlaceholder?: string
}

function buildHref(
  basePath: string,
  opts: {
    kind?: string
    mode: string
    view?: string
    q: string
    coach: string
    sport?: string
    type?: string
  },
) {
  const params = new URLSearchParams()
  if (opts.kind === 'blocks' || opts.kind === 'sessions') params.set('kind', opts.kind)
  if (opts.mode === 'coach' || opts.view === 'coach') params.set('view', 'coach')
  else if (opts.view && opts.view !== 'all') params.set('view', opts.view)
  if (opts.q.trim()) params.set('q', opts.q.trim())
  if (opts.coach.trim()) params.set('coach', opts.coach.trim())
  if (opts.sport?.trim()) params.set('sport', opts.sport.trim())
  if (opts.type?.trim()) params.set('type', opts.type.trim())
  const s = params.toString()
  return s ? `${basePath}?${s}` : basePath
}

/** Recherche live (debounce) — met à jour l’URL sans bouton Chercher. */
export function CatalogLiveSearch({
  basePath,
  mode,
  kind = 'exercises',
  view = 'all',
  initialQ = '',
  initialCoach = '',
  initialSport = '',
  initialType = '',
  showCoachFilter = false,
  sportOptions,
  typeOptions,
  titlePlaceholder = 'Rechercher par titre…',
}: Props) {
  const router = useRouter()
  const [q, setQ] = useState(initialQ)
  const [coach, setCoach] = useState(initialCoach)
  const [sport, setSport] = useState(initialSport)
  const [typeId, setTypeId] = useState(initialType)
  const [pending, startTransition] = useTransition()
  const first = useRef(true)

  useEffect(() => {
    setQ(initialQ)
    setCoach(initialCoach)
    setSport(initialSport)
    setTypeId(initialType)
  }, [initialQ, initialCoach, initialSport, initialType])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = window.setTimeout(() => {
      const href = buildHref(basePath, {
        kind,
        mode,
        view,
        q,
        coach,
        sport,
        type: typeId,
      })
      startTransition(() => {
        router.replace(href, { scroll: false })
      })
    }, 280)
    return () => window.clearTimeout(t)
  }, [q, coach, sport, typeId, basePath, kind, mode, view, router])

  const showTaxonomy = Boolean(sportOptions?.length || typeOptions?.length)
  const hasFilters = Boolean(q.trim() || coach.trim() || sport || typeId)

  return (
    <div className="mb-4 grid gap-2">
      {showTaxonomy ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {sportOptions?.length ? (
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold text-[color:var(--muted)]">Sport</span>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className={daSelectClass}
              >
                <option value="">Tous les sports</option>
                {sportOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {typeOptions?.length ? (
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold text-[color:var(--muted)]">Type</span>
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className={daSelectClass}
              >
                <option value="">Tous les types</option>
                {typeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={titlePlaceholder}
          className={`${daFieldClass} min-w-[12rem] flex-1`}
          aria-label="Recherche titre"
        />
        {showCoachFilter ? (
          <input
            value={coach}
            onChange={(e) => setCoach(e.target.value)}
            placeholder="Filtrer par coach (nom / email)…"
            className={`${daFieldClass} min-w-[12rem] flex-1`}
            aria-label="Recherche coach"
          />
        ) : null}
        {pending ? (
          <span className="text-[11px] font-semibold text-[color:var(--muted)]">…</span>
        ) : null}
        {hasFilters ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setQ('')
              setCoach('')
              setSport('')
              setTypeId('')
            }}
          >
            Effacer
          </Button>
        ) : null}
      </div>
    </div>
  )
}
