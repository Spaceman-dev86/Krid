'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { saveCoachTestimonialPhotoAction } from '@/src/app/profile/actions'
import { daFieldClass } from '@/src/components/ui'
import {
  newTestimonialId,
  type ShowroomTestimonial,
} from '@/src/lib/coach/showroomTestimonials'

type Props = {
  initial: ShowroomTestimonial[]
  onChange?: (items: ShowroomTestimonial[]) => void
}

/** Édition multi-témoignages (photo · nom · citation). */
export function ShowroomTestimonialsEditor({ initial, onChange }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<ShowroomTestimonial[]>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function commit(next: ShowroomTestimonial[]) {
    setItems(next)
    // Après le tick courant — évite setState parent pendant le render enfant
    setTimeout(() => {
      onChange?.(next)
      document
        .getElementById('coach-showroom-presentation-form')
        ?.dispatchEvent(new Event('change', { bubbles: true }))
    }, 0)
  }

  function add() {
    if (items.length >= 12) return
    commit([
      ...items,
      { id: newTestimonialId(), name: '', quote: '', photo_url: null },
    ])
  }

  function update(id: string, patch: Partial<ShowroomTestimonial>) {
    commit(items.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  function remove(id: string) {
    commit(items.filter((t) => t.id !== id))
  }

  function uploadPhoto(id: string, file: File) {
    setError(null)
    const previousUrl = items.find((t) => t.id === id)?.photo_url ?? null
    const preview = URL.createObjectURL(file)
    update(id, { photo_url: preview })
    const fd = new FormData()
    fd.set('testimonial_id', id)
    fd.set('file', file)
    startTransition(async () => {
      const res = await saveCoachTestimonialPhotoAction(fd)
      if (!res.ok) {
        setError(res.error)
        update(id, { photo_url: previousUrl })
        return
      }
      update(id, { photo_url: res.imageUrl })
      router.refresh()
    })
  }

  return (
    <div className="grid gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--accent)]/35 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[color:var(--fg)]">Témoignages</p>
        <button
          type="button"
          onClick={add}
          disabled={items.length >= 12}
          className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] font-bold text-[color:var(--fg)] hover:bg-[var(--surface)] disabled:opacity-40"
        >
          + Ajouter
        </button>
      </div>
      <p className="text-[10px] text-[color:var(--muted)]">
        Carrousel auto 4s · flèche · swipe téléphone
      </p>

      <input
        type="hidden"
        name="showroom_testimonials_json"
        value={JSON.stringify(items)}
      />

      {!items.length ? (
        <p className="text-[11px] text-[color:var(--muted)]">Aucun témoignage pour l’instant.</p>
      ) : (
        <ul className="grid gap-2.5">
          {items.map((t, i) => (
            <li
              key={t.id}
              className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5"
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => fileRefs.current[t.id]?.click()}
                  className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--accent)]"
                >
                  {t.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-[color:var(--muted)]">
                      Photo
                    </span>
                  )}
                </button>
                <input
                  ref={(el) => {
                    fileRefs.current[t.id] = el
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadPhoto(t.id, file)
                    e.target.value = ''
                  }}
                />
                <div className="min-w-0 flex-1 grid gap-1.5">
                  <input
                    value={t.name}
                    onChange={(e) => update(t.id, { name: e.target.value.slice(0, 80) })}
                    placeholder={`Nom ${i + 1}`}
                    className={daFieldClass}
                  />
                  <textarea
                    value={t.quote}
                    onChange={(e) => update(t.id, { quote: e.target.value.slice(0, 600) })}
                    rows={2}
                    placeholder="Citation…"
                    className={daFieldClass}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="justify-self-start text-[11px] font-semibold text-[var(--danger)] hover:underline"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="text-[10px] font-semibold text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  )
}
