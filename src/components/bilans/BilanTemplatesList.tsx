'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'

import { deleteTemplateAction } from '@/src/app/clients/bilans/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import type { BilanSchema } from '@/src/lib/bilans/bilans'

type TemplateItem = {
  id: string
  title: string
  instructions: string | null
  schema: BilanSchema
}

function DeleteSubmit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--danger)] hover:underline disabled:opacity-60"
    >
      {pending ? <FluidSpinner size={10} className="text-[var(--danger)]" /> : null}
      {pending ? '…' : 'Supprimer'}
    </button>
  )
}

function schemaSummary(schema: BilanSchema): string {
  return (
    [
      schema.photos ? 'Photos' : null,
      schema.measurements.length ? `${schema.measurements.length} mens.` : null,
      schema.questions.length ? `${schema.questions.length} q.` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Vide'
  )
}

export function BilanTemplatesList({ templates }: { templates: TemplateItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (!templates.length) {
    return (
      <p className="text-sm text-[color:var(--muted)]">
        Aucun template. Utilise + pour en créer un (ou enregistre un brouillon).
      </p>
    )
  }

  return (
    <ul className="grid gap-2">
      {templates.map((t) => {
        const open = openId === t.id
        return (
          <li
            key={t.id}
            className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : t.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--accent)]/40"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[color:var(--fg)]">{t.title}</p>
                <p className="text-xs text-[color:var(--muted)]">{schemaSummary(t.schema)}</p>
              </div>
              <span className="text-xs font-bold text-[color:var(--brand)]">
                {open ? 'Masquer' : 'Voir'}
              </span>
            </button>

            {open ? (
              <div className="border-t border-[var(--border)] px-4 py-3">
                {t.instructions ? (
                  <p className="mb-3 whitespace-pre-wrap text-sm text-[color:var(--muted)]">
                    {t.instructions}
                  </p>
                ) : null}

                {t.schema.measurements.length ? (
                  <div className="mb-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                      Mensurations
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {t.schema.measurements.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--fg)]"
                        >
                          {m.label}
                          {m.unit ? ` (${m.unit})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {t.schema.questions.length ? (
                  <div className="mb-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                      Questions
                    </p>
                    <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-[color:var(--fg)]">
                      {t.schema.questions.map((q) => (
                        <li key={q.id}>{q.label}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {t.schema.photos ? (
                  <p className="mb-3 text-sm text-[color:var(--fg)]">Photos demandées</p>
                ) : null}

                {!t.schema.photos &&
                !t.schema.measurements.length &&
                !t.schema.questions.length ? (
                  <p className="mb-3 text-sm text-[color:var(--muted)]">Contenu vide.</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    href={`/clients/bilans/templates/${t.id}`}
                    className="text-xs font-bold text-[color:var(--brand)] hover:underline"
                  >
                    Modifier
                  </Link>
                  <form action={deleteTemplateAction}>
                    <input type="hidden" name="template_id" value={t.id} />
                    <DeleteSubmit />
                  </form>
                </div>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
