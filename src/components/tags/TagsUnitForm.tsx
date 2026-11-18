'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button, IconMinus, IconPlus, daFieldClass, daSelectClass } from '@/src/components/ui'

type ValueMode = 'number' | 'time' | 'text' | 'list'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? '…' : label}
    </Button>
  )
}

export function TagsUnitForm({
  action,
  initial,
  submitLabel = 'Enregistrer',
  hiddenId,
}: {
  action: (formData: FormData) => void | Promise<void>
  initial?: {
    label?: string
    short_label?: string | null
    value_mode?: string | null
    list_options?: string[] | null
  }
  submitLabel?: string
  hiddenId?: string
}) {
  const [valueMode, setValueMode] = useState<ValueMode>(
    initial?.value_mode === 'time' ||
      initial?.value_mode === 'text' ||
      initial?.value_mode === 'list'
      ? initial.value_mode
      : 'number',
  )
  const [listOptions, setListOptions] = useState<string[]>(
    initial?.list_options?.length ? initial.list_options : [''],
  )

  return (
    <form action={action} className="grid gap-3">
      {hiddenId ? <input type="hidden" name="id" value={hiddenId} /> : null}
      <input type="hidden" name="tab" value="units" />
      <label className="grid gap-1 text-xs font-semibold text-[color:var(--muted)]">
        Nom affiché
        <input
          name="label"
          required
          defaultValue={initial?.label ?? ''}
          placeholder="ex. Charge"
          className={daFieldClass}
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-[color:var(--muted)]">
        Abrégé
        <input
          name="short_label"
          defaultValue={initial?.short_label ?? ''}
          placeholder="ex. kg"
          maxLength={12}
          className={daFieldClass}
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-[color:var(--muted)]">
        Mode de saisie
        <select
          name="value_mode"
          className={daSelectClass}
          value={valueMode}
          onChange={(e) => {
            const next = e.target.value as ValueMode
            setValueMode(next)
            if (next === 'list' && listOptions.length === 0) setListOptions([''])
          }}
        >
          <option value="number">Nombre</option>
          <option value="time">Temps</option>
          <option value="text">Texte</option>
          <option value="list">Liste</option>
        </select>
      </label>
      {valueMode === 'list' ? (
        <div className="grid gap-2">
          <p className="text-xs font-semibold text-[color:var(--muted)]">Options</p>
          {listOptions.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={opt}
                onChange={(e) =>
                  setListOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                }
                className={`${daFieldClass} flex-1`}
                placeholder={`Option ${i + 1}`}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setListOptions((prev) =>
                    prev.length <= 1 ? [''] : prev.filter((_, j) => j !== i),
                  )
                }
              >
                <IconMinus size={14} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setListOptions((prev) => [...prev, ''])}
          >
            <IconPlus size={14} /> Ajouter
          </Button>
          <input type="hidden" name="list_options" value={listOptions.join('\n')} />
        </div>
      ) : null}
      <div>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  )
}
