'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useRef, useTransition } from 'react'

import { IconSearch, daSelectClass } from '@/src/components/ui'

type SportOption = { id: string; label: string }
/** Label seul (exos) ou { id, label } (blocs). */
type TypeOption = string | { id: string; label: string }

type Props = {
  kind: 'exercises' | 'blocks' | 'tags'
  typeOptions?: TypeOption[]
  sportOptions?: SportOption[]
  basePath: string
}

type Zone = {
  href: string
  label: string
  active: boolean
}

function typeOptionValue(t: TypeOption) {
  return typeof t === 'string' ? t : t.id
}

function typeOptionLabel(t: TypeOption) {
  return typeof t === 'string' ? t : t.label
}

function zoneClass(active: boolean) {
  return active
    ? 'shrink-0 whitespace-nowrap border-b-2 border-[var(--brand)] px-1 pb-1 text-xs font-bold text-[color:var(--brand)] sm:text-sm'
    : 'shrink-0 whitespace-nowrap border-b-2 border-transparent px-1 pb-1 text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)] sm:text-sm'
}

function zonesFor(
  kind: 'exercises' | 'blocks' | 'tags',
  pathname: string,
  tab: string,
): Zone[] {
  if (kind === 'tags') {
    const current = tab === 'types' || tab === 'units' ? tab : 'sports'
    return [
      {
        href: '/exercises/tags?tab=sports',
        label: 'Sports',
        active: current === 'sports',
      },
      {
        href: '/exercises/tags?tab=types',
        label: 'Types',
        active: current === 'types',
      },
      {
        href: '/exercises/tags?tab=units',
        label: 'Unités',
        active: current === 'units',
      },
    ]
  }
  if (kind === 'blocks') {
    return [
      {
        href: '/exercises/blocks/mine',
        label: 'Ma biblio',
        active: pathname.startsWith('/exercises/blocks/mine'),
      },
      {
        href: '/exercises/blocks/catalogue',
        label: 'Catalogue Krid',
        active: pathname.startsWith('/exercises/blocks/catalogue'),
      },
      {
        href: '/exercises/blocks/brouillon',
        label: 'Brouillons',
        active: pathname.startsWith('/exercises/blocks/brouillon'),
      },
    ]
  }
  return [
    {
      href: '/exercises/mine',
      label: 'Ma biblio',
      active: pathname.startsWith('/exercises/mine'),
    },
    {
      href: '/exercises/catalogue',
      label: 'Catalogue Krid',
      active: pathname.startsWith('/exercises/catalogue'),
    },
    {
      href: '/exercises/brouillon',
      label: 'Brouillons',
      active: pathname.startsWith('/exercises/brouillon'),
    },
  ]
}

function ExercisesZoneBarInner({
  kind,
  typeOptions = [],
  sportOptions = [],
  basePath,
}: Props) {
  const pathname = usePathname() || basePath
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tab = sp.get('tab') ?? 'sports'
  const zones = zonesFor(kind, pathname, tab)
  const showFilters = kind !== 'tags'

  const q = sp.get('q') ?? ''
  const type = sp.get('type') ?? ''
  const sport = sp.get('sport') ?? ''

  function patch(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k)
      else params.set(k, v)
    }
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath)
    })
  }

  function goZone(href: string) {
    startTransition(() => {
      router.replace(href)
    })
  }

  const aria =
    kind === 'tags' ? 'Zones tags' : kind === 'blocks' ? 'Zones blocs' : 'Zones exercices'

  return (
    <div
      className={`flex flex-col gap-3 border-b border-[var(--border)] pb-3 lg:flex-row lg:items-end lg:justify-between ${
        pending ? 'opacity-70' : ''
      }`}
      data-builder-chrome
    >
      <nav className="flex min-w-0 flex-wrap gap-3" aria-label={aria}>
        {zones.map((z) => (
          <Link
            key={z.href}
            href={z.href}
            prefetch
            className={zoneClass(z.active)}
            onClick={(e) => {
              e.preventDefault()
              goZone(z.href)
            }}
          >
            {z.label}
          </Link>
        ))}
      </nav>

      {showFilters ? (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="grid min-w-[180px] flex-1 gap-1 text-sm sm:min-w-[200px]">
            <span className="sr-only">Recherche</span>
            <span className="relative">
              <IconSearch
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
              />
              <input
                type="search"
                defaultValue={q}
                placeholder="Recherche…"
                className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] py-2 pl-9 pr-3 text-sm text-[color:var(--fg)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
                onChange={(e) => {
                  const value = e.target.value
                  if (qTimer.current) clearTimeout(qTimer.current)
                  qTimer.current = setTimeout(() => patch({ q: value.trim() }), 250)
                }}
              />
            </span>
          </label>
          <label className="grid w-full gap-1 text-sm sm:w-[140px] sm:shrink-0">
            <span className="sr-only">Type</span>
            <select
              value={type}
              onChange={(e) => patch({ type: e.target.value })}
              className={`${daSelectClass} h-10 w-full`}
              aria-label="Type"
            >
              <option value="">Type</option>
              {typeOptions.map((t) => {
                const value = typeOptionValue(t)
                return (
                  <option key={value} value={value}>
                    {typeOptionLabel(t)}
                  </option>
                )
              })}
            </select>
          </label>
          <label className="grid w-full gap-1 text-sm sm:w-[140px] sm:shrink-0">
            <span className="sr-only">Sport</span>
            <select
              value={sport}
              onChange={(e) => patch({ sport: e.target.value })}
              className={`${daSelectClass} h-10 w-full`}
              aria-label="Sport"
            >
              <option value="">Sport</option>
              {sportOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  )
}

export function ExercisesZoneBar(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="border-b border-[var(--border)] pb-3 text-sm text-[color:var(--muted)]">
          {props.kind === 'tags'
            ? 'Sports · Types · Unités'
            : 'Catalogue Krid · Ma biblio · Brouillons'}
        </div>
      }
    >
      <ExercisesZoneBarInner {...props} />
    </Suspense>
  )
}
