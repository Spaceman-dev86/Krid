'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  CreateUnitForm,
  type CreatedCatalogUnit,
} from '@/src/components/admin/CreateUnitForm'

export type { CreatedCatalogUnit }

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (unit: CreatedCatalogUnit) => void
}

export function CreateUnitDialog({ open, onClose, onCreated }: Props) {
  const [mounted, setMounted] = useState(false)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    setFormKey((k) => k + 1)
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className="absolute left-1/2 top-1/2 z-10 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-unit-title"
      >
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 id="create-unit-title" className="text-sm font-bold text-[color:var(--fg)]">
              Nouvelle unité
            </h2>
            <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
              Libellé + symbole — catalogue plateforme
            </p>
          </div>
          <div className="p-4" key={formKey}>
            <CreateUnitForm
              showCancel
              onCancel={onClose}
              onCreated={(unit) => {
                onCreated(unit)
                onClose()
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
