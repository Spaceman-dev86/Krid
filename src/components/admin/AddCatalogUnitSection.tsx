'use client'

import { useRouter } from 'next/navigation'

import { CreateUnitForm } from '@/src/components/admin/CreateUnitForm'

/** Formulaire inline « Ajouter une unité » (page catalogue). */
export function AddCatalogUnitSection() {
  const router = useRouter()

  return (
    <section className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
        Ajouter une unité
      </p>
      <div className="mt-3">
        <CreateUnitForm
          submitLabel="+ Unité"
          onCreated={() => {
            router.refresh()
          }}
        />
      </div>
    </section>
  )
}
