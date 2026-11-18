'use client'

import { useState } from 'react'

import {
  PRESET_MEASUREMENTS,
  type BilanMeasurementField,
  type BilanSchema,
} from '../../lib/bilans/bilans'
import { daFieldClass } from '@/src/components/ui'

type Props = {
  initial?: {
    title?: string
    instructions?: string | null
    schema?: BilanSchema
  }
  templateId?: string
  /** Si false, le titre n’est pas required (brouillon). */
  titleRequired?: boolean
}

export function BilanTemplateFormFields({ initial, templateId, titleRequired = true }: Props) {
  const [photos, setPhotos] = useState(Boolean(initial?.schema?.photos))
  const [measurements, setMeasurements] = useState<BilanMeasurementField[]>(
    initial?.schema?.measurements?.length ? initial.schema.measurements : []
  )
  const [questions, setQuestions] = useState<string[]>(
    initial?.schema?.questions?.map((q) => q.label) ?? ['']
  )

  function togglePreset(preset: BilanMeasurementField) {
    setMeasurements((prev) => {
      if (prev.some((m) => m.id === preset.id)) return prev.filter((m) => m.id !== preset.id)
      return [...prev, preset]
    })
  }

  function addCustomMeasurement() {
    const id = `custom_${crypto.randomUUID().slice(0, 8)}`
    setMeasurements((prev) => [...prev, { id, label: '', unit: 'cm' }])
  }

  return (
    <div className="grid gap-5">
      {templateId ? <input type="hidden" name="template_id" value={templateId} /> : null}

      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-[color:var(--fg)]">Titre</span>
        <input
          name="title"
          required={titleRequired}
          defaultValue={initial?.title ?? ''}
          className={daFieldClass}
          placeholder="Ex. Bilan mensuel"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-[color:var(--fg)]">Consigne (optionnel)</span>
        <textarea
          name="instructions"
          rows={3}
          defaultValue={initial?.instructions ?? ''}
          className={daFieldClass}
          placeholder="Message visible par le client"
        />
      </label>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--page-bg)] p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-[color:var(--fg)]">
          <input
            type="checkbox"
            name="photos"
            value="1"
            checked={photos}
            onChange={(e) => setPhotos(e.target.checked)}
          />
          Bloc Photos (libre côté client)
        </label>
      </section>

      <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--page-bg)] p-4">
        <p className="text-sm font-bold text-[color:var(--brand)]">Mensurations</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_MEASUREMENTS.map((p) => {
            const on = measurements.some((m) => m.id === p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePreset(p)}
                className={
                  on
                    ? 'rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-bold text-[color:var(--brand-fg)]'
                    : 'rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--muted)]'
                }
              >
                {p.label}
              </button>
            )
          })}
        </div>
        {measurements.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="measurement_id" value={m.id} />
            <input
              name={`m_label_${m.id}`}
              defaultValue={m.label}
              required
              placeholder="Libellé"
              className={`min-w-0 flex-1 ${daFieldClass}`}
            />
            <input
              name={`m_unit_${m.id}`}
              defaultValue={m.unit}
              placeholder="unité"
              className={`w-20 ${daFieldClass}`}
            />
            <button
              type="button"
              className="text-xs font-semibold text-[var(--danger)]"
              onClick={() => setMeasurements((prev) => prev.filter((x) => x.id !== m.id))}
            >
              Retirer
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addCustomMeasurement}
          className="text-left text-xs font-bold text-[color:var(--brand)]"
        >
          + Champ custom
        </button>
      </section>

      <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--page-bg)] p-4">
        <p className="text-sm font-bold text-[color:var(--brand)]">Questions</p>
        {questions.map((q, i) => (
          <div key={i} className="flex gap-2">
            <input
              name="question_label"
              value={q}
              onChange={(e) =>
                setQuestions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
              }
              placeholder={`Question ${i + 1}`}
              className={`min-w-0 flex-1 ${daFieldClass}`}
            />
            <button
              type="button"
              className="text-xs font-semibold text-[var(--danger)]"
              onClick={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setQuestions((prev) => [...prev, ''])}
          className="text-left text-xs font-bold text-[color:var(--brand)]"
        >
          + Question
        </button>
      </section>
    </div>
  )
}
