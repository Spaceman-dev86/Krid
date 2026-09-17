'use client'

import { useState } from 'react'

import { Button } from '@/src/components/ui'
import {
  PRESET_MEASUREMENTS,
  type BilanMeasurementField,
  type BilanSchema,
} from '../../lib/bilans/bilans'

type Props = {
  action: (formData: FormData) => Promise<void>
  initial?: {
    title?: string
    instructions?: string | null
    schema?: BilanSchema
  }
  templateId?: string
  submitLabel?: string
}

export function BilanTemplateForm({ action, initial, templateId, submitLabel = 'Enregistrer' }: Props) {
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
    <form action={action} className="grid gap-5">
      {templateId ? <input type="hidden" name="template_id" value={templateId} /> : null}

      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Titre</span>
        <input
          name="title"
          required
          defaultValue={initial?.title ?? ''}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          placeholder="Ex. Bilan mensuel"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Consigne (optionnel)</span>
        <textarea
          name="instructions"
          rows={3}
          defaultValue={initial?.instructions ?? ''}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          placeholder="Message visible par le client"
        />
      </label>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
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

      <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
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
                    ? 'rounded-full bg-[color:var(--brand)] px-3 py-1 text-xs font-bold text-[color:var(--icon-solid-fg)]'
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
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            />
            <input
              name={`m_unit_${m.id}`}
              defaultValue={m.unit}
              placeholder="unité"
              className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              className="text-xs font-semibold text-red-700"
              onClick={() => setMeasurements((prev) => prev.filter((x) => x.id !== m.id))}
            >
              Retirer
            </button>
          </div>
        ))}
        <button type="button" onClick={addCustomMeasurement} className="text-left text-xs font-bold text-[color:var(--brand)]">
          + Champ custom
        </button>
      </section>

      <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
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
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              className="text-xs font-semibold text-red-700"
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

      <Button type="submit" className="!rounded-xl !px-4 !py-2.5 text-sm">
        {submitLabel}
      </Button>
    </form>
  )
}
