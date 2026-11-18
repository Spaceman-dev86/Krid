'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'

import { IconButton, IconClose, daSelectClass } from '@/src/components/ui'

type Option = { id: string; label: string }

type Props = {
  programOptions: Option[]
  nutritionOptions: Option[]
  driveOptions: Option[]
  initialProgramIds: string[]
  initialNutritionIds: string[]
  initialDriveIds: string[]
}

function MultiSelectDropdown({
  title,
  field,
  options,
  initialIds,
  emptyHint,
  catalogHref,
  catalogLabel,
  addLabel,
}: {
  title: string
  field: string
  options: Option[]
  initialIds: string[]
  emptyHint: string
  catalogHref: string
  catalogLabel: string
  addLabel: string
}) {
  const [ids, setIds] = useState(() =>
    initialIds.filter((id) => options.some((o) => o.id === id)),
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const available = options.filter((o) => !ids.includes(o.id))

  function pingForm() {
    const form = rootRef.current?.closest('form')
    setTimeout(() => {
      form?.dispatchEvent(new Event('change', { bubbles: true }))
    }, 0)
  }

  function add(id: string) {
    if (!id || ids.includes(id)) return
    setIds((prev) => [...prev, id])
    pingForm()
  }

  function remove(id: string) {
    setIds((prev) => prev.filter((x) => x !== id))
    pingForm()
  }

  return (
    <div
      ref={rootRef}
      className="grid grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-1.5 self-start text-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-[color:var(--fg)]">{title}</span>
        <span className="text-[11px] text-[color:var(--muted)]">
          {ids.length ? `${ids.length}` : '0'}
        </span>
      </div>

      {/* Rangée fixe : le select ne descend jamais quand la liste grandit */}
      <div className="min-h-[2.5rem]">
        {options.length ? (
          <select
            className={daSelectClass}
            value=""
            onChange={(e) => {
              add(e.target.value)
              e.target.value = ''
            }}
            disabled={!available.length}
            aria-label={addLabel}
          >
            <option value="">{available.length ? addLabel : 'Tout est déjà ajouté'}</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-2 text-[11px] text-[color:var(--muted)]">
            {emptyHint}
          </p>
        )}
      </div>

      <ul className="grid content-start gap-1">
        {ids.map((id) => {
          const label = byId.get(id)?.label ?? id
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[color:var(--fg)]">
                {label}
              </span>
              <input type="hidden" name={field} value={id} />
              <IconButton
                type="button"
                label={`Retirer ${label}`}
                tone="soft"
                size="sm"
                onClick={() => remove(id)}
              >
                <IconClose size={14} />
              </IconButton>
            </li>
          )
        })}
      </ul>

      <p className="text-[11px] text-[color:var(--muted)]">
        Catalogue{' '}
        <Link href={catalogHref} className="font-semibold text-[color:var(--brand)] hover:underline">
          {catalogLabel}
        </Link>
      </p>
    </div>
  )
}

/** Multi-sélection : dropdowns alignés · listes en dessous. */
export function PrestationContentLinksFields({
  programOptions,
  nutritionOptions,
  driveOptions,
  initialProgramIds,
  initialNutritionIds,
  initialDriveIds,
}: Props) {
  return (
    <div className="mt-4 grid items-start gap-4 sm:grid-cols-3">
      <MultiSelectDropdown
        title="Programmes sport"
        field="program_template_ids"
        options={programOptions}
        initialIds={initialProgramIds}
        emptyHint="Aucun programme dans ton catalogue."
        catalogHref="/programs"
        catalogLabel="Programme"
        addLabel="Ajouter un programme…"
      />
      <MultiSelectDropdown
        title="Plans nutrition"
        field="nutrition_template_ids"
        options={nutritionOptions}
        initialIds={initialNutritionIds}
        emptyHint="Aucun plan nutrition."
        catalogHref="/nutrition"
        catalogLabel="Nutrition"
        addLabel="Ajouter un plan…"
      />
      <MultiSelectDropdown
        title="Dossiers Drive"
        field="drive_folder_ids"
        options={driveOptions}
        initialIds={initialDriveIds}
        emptyHint="Aucun dossier Drive."
        catalogHref="/drive"
        catalogLabel="Drive"
        addLabel="Ajouter un dossier…"
      />
    </div>
  )
}
