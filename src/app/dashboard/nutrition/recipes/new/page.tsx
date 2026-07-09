'use client'

import Link from 'next/link'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { Card, Container } from '../../../../../components/marketing'
import { coachDashboardCardClass } from '../../../../../lib/coachDashboardUi'
import { createClient } from '../../../../../lib/supabase/client'
import StickyHeader from '../../StickyHeader'

function TrashIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" className={props.className}>
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type PostgrestErrorLike = {
  message?: string
}

type InsertSelectSingleResult = {
  data: Record<string, unknown> | null
  error: PostgrestErrorLike | null
}

type WriteResult = {
  error: PostgrestErrorLike | null
}

type PostgrestTableLike = {
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => {
    select: (columns: string) => {
      single: () => Promise<InsertSelectSingleResult>
    }
  }
}

type SupabaseUntypedLike = {
  from: (table: string) => {
    insert: PostgrestTableLike['insert']
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

type IngredientRow = {
  id: string
  name: string
  calories: number
}

type IngredientLine = {
  ingredientId: string
  quantityG: string
}

function IngredientSearchSelect(props: {
  value: string
  onChange: (nextId: string) => void
  ingredients: IngredientRow[]
  placeholder?: string
}) {
  const { value, onChange, ingredients, placeholder } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(() => ingredients.find((i) => i.id === value) ?? null, [ingredients, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ingredients.slice(0, 30)
    return ingredients.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 30)
  }, [ingredients, query])

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = containerRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false)
      }
    }

    if (!open) return
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={containerRef} className={`min-w-0 ${open ? 'relative z-50' : 'relative'}`}>
      <input
        value={open ? query : selected?.name ?? query}
        onFocus={() => {
          setOpen(true)
          setQuery(selected?.name ?? query)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (value) onChange('')
        }}
        placeholder={placeholder ?? 'Rechercher…'}
        className="h-11 w-full rounded-2xl bg-white px-3 pr-9 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
      />

      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/30">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {open ? (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-2xl bg-white p-1 ring-1 ring-black/10 shadow-sm">
          {filtered.length > 0 ? (
            filtered.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  onChange(i.id)
                  setQuery(i.name)
                  setOpen(false)
                }}
                className={
                  (i.id === value ? 'bg-[#341c44] text-white' : 'bg-white text-[#341c44] hover:bg-[#f5f5f5]') +
                  ' flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm font-extrabold'
                }
              >
                <span className="truncate">{i.name}</span>
                <span className={i.id === value ? 'text-white/70' : 'text-black/30'}>{i.calories.toFixed(0)} (Kcal/100g)</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm font-semibold text-black/50">Aucun résultat</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function DashboardNutritionNewRecipePage() {
  const [steps, setSteps] = useState<string[]>([''])
  const supabase = useMemo(() => createClient(), [])
  const supabaseUntyped = supabase as unknown as SupabaseUntypedLike

  const photoInputId = useId()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<'petit-dej' | 'snack' | 'repas'>('repas')
  const [note, setNote] = useState('')

  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [ingredientLines, setIngredientLines] = useState<IngredientLine[]>([{ ingredientId: '', quantityG: '' }])
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase
        .from('nutrition_ingredients')
        .select('id,name,calories')
        .order('name', { ascending: true })

      if (!mounted) return
      const rows = (data ?? []) as unknown as { id?: string; name?: string; calories?: number }[]
      setIngredients(
        rows
          .filter((r) => typeof r.id === 'string' && typeof r.name === 'string')
          .map((r) => ({ id: r.id as string, name: r.name as string, calories: Number(r.calories ?? 0) }))
      )
    }

    load()
    return () => {
      mounted = false
    }
  }, [supabase])

  const ingredientById = useMemo(() => {
    const m = new Map<string, IngredientRow>()
    for (const i of ingredients) m.set(i.id, i)
    return m
  }, [ingredients])

  const lineTotals = useMemo(() => {
    return ingredientLines.map((l) => {
      const ing = ingredientById.get(l.ingredientId)
      const qty = Number(String(l.quantityG ?? '').replace(',', '.'))
      if (!ing || !Number.isFinite(qty) || qty <= 0) return 0
      return (ing.calories * qty) / 100
    })
  }, [ingredientById, ingredientLines])

  const totalCalories = useMemo(() => lineTotals.reduce((acc, v) => acc + v, 0), [lineTotals])

  async function onPublish() {
    setError(null)
    const t = title.trim()
    if (!t) return setError('Nom requis.')

    const cleanedSteps = steps.map((s) => String(s ?? '').trim()).filter(Boolean)
    const cleanedLines = ingredientLines
      .map((l) => ({
        ingredientId: String(l.ingredientId ?? ''),
        quantityG: Number(String(l.quantityG ?? '').replace(',', '.')),
      }))
      .filter((l) => l.ingredientId && Number.isFinite(l.quantityG) && l.quantityG > 0)

    if (cleanedLines.length === 0) return setError('Ajoute au moins un ingrédient.')

    setLoading(true)
    try {
      const { data: recipeRow, error: recipeErr } = await supabaseUntyped
        .from('nutrition_recipes')
        .insert({
          title: t,
          note: note.trim() || null,
          photo_url: photoUrl,
          category,
          steps: cleanedSteps,
        })
        .select('id')
        .single()

      if (recipeErr) throw recipeErr
      const recipeId = String(recipeRow?.id ?? '')
      if (!recipeId) throw new Error('Recette créée sans id.')

      const ingPayload = cleanedLines.map((l) => ({
        recipe_id: recipeId,
        ingredient_id: l.ingredientId,
        quantity_g: l.quantityG,
      }))

      const { error: ingErr } = (await supabaseUntyped.from('nutrition_recipe_ingredients').insert(ingPayload)) as unknown as WriteResult
      if (ingErr) throw ingErr

      window.location.href = `/dashboard/nutrition/recipes/${recipeId}`
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message ?? 'Erreur inconnue.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen min-w-0 bg-transparent">
      <Container className="py-6 sm:py-10">
        <StickyHeader opaquePageBackdrop>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#341c44]">Nouvelle recette</h1>
              <p className="mt-1 text-sm text-black/60">Crée ta nouvelle recette origical pour ton plan d&apos;entrainement.</p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/nutrition/recipes"
                aria-label="Retour"
                title="Retour"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </StickyHeader>

        <div className="relative z-0 mt-5 min-w-0">
          <Card className={`${coachDashboardCardClass} min-w-0 overflow-x-clip`}>
            {error ? <div className="mb-3 text-sm font-semibold text-red-600">{error}</div> : null}
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="grid min-w-0 gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid min-w-0 gap-1">
                    <span className="text-xs font-extrabold text-[#341c44]">Nom</span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-11 w-full min-w-0 rounded-2xl bg-black/5 px-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                    />
                  </label>

                  <label className="grid min-w-0 gap-1">
                    <span className="text-xs font-extrabold text-[#341c44]">Catégorie</span>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as 'petit-dej' | 'snack' | 'repas')}
                        className="h-11 w-full min-w-0 appearance-none rounded-2xl bg-black/5 px-3 pr-10 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                      >
                        <option value="petit-dej">Petit-dej</option>
                        <option value="snack">Snack</option>
                        <option value="repas">Repas</option>
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/30">
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </label>
                </div>

                <label className="grid min-w-0 gap-1">
                  <span className="text-xs font-extrabold text-[#341c44]">Note</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="min-h-[100px] w-full min-w-0 rounded-2xl bg-white p-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                  />
                </label>

                <div className="grid min-w-0 gap-2">
                  <div className="text-xs font-extrabold text-[#341c44]">Liste d&apos;ingrédients</div>
                  <div className="relative min-w-0 overflow-x-clip rounded-2xl bg-white ring-1 ring-black/10">
                    <div className="rounded-t-2xl bg-black/5">
                      <div className="hidden min-[450px]:grid min-[450px]:grid-cols-[minmax(0,1fr)_88px_88px] border-b border-black/10 px-4 py-2 text-xs font-extrabold text-[#341c44]">
                        <div>Ingrédient</div>
                        <div className="text-right">Quantité (g)</div>
                        <div className="text-right">Total (kcal)</div>
                      </div>
                    </div>

                    <div className="grid gap-2 p-3 sm:p-4">
                      {ingredientLines.map((line, idx) => {
                        const kcal = lineTotals[idx] ?? 0
                        return (
                          <div
                            key={idx}
                            className="grid min-w-0 gap-2 rounded-2xl border border-black/10 p-3 min-[450px]:grid-cols-[minmax(0,1fr)_88px_88px_44px] min-[450px]:items-center min-[450px]:rounded-none min-[450px]:border-0 min-[450px]:p-0"
                          >
                            <div className="min-w-0">
                              <div className="mb-1 text-xs font-extrabold text-[#341c44] min-[450px]:hidden">Ingrédient</div>
                              <IngredientSearchSelect
                                value={line.ingredientId}
                                ingredients={ingredients}
                                onChange={(nextId) =>
                                  setIngredientLines((prev) => prev.map((p, i) => (i === idx ? { ...p, ingredientId: nextId } : p)))
                                }
                                placeholder="Rechercher un ingrédient…"
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="mb-1 text-xs font-extrabold text-[#341c44] min-[450px]:hidden">Quantité (g)</div>
                              <input
                                inputMode="decimal"
                                value={line.quantityG}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setIngredientLines((prev) => prev.map((p, i) => (i === idx ? { ...p, quantityG: v } : p)))
                                }}
                                placeholder="0"
                                className="h-11 w-full min-w-0 rounded-2xl bg-white px-3 text-right text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="mb-1 text-xs font-extrabold text-[#341c44] min-[450px]:hidden">Total (kcal)</div>
                              <div className="flex h-11 w-full min-w-0 items-center justify-end rounded-2xl bg-black/5 px-3 text-sm font-extrabold tabular-nums text-[#341c44] ring-1 ring-black/10">
                                {kcal > 0 ? kcal.toFixed(1) : '—'}
                              </div>
                            </div>

                            <button
                              type="button"
                              aria-label="Supprimer l'ingrédient"
                              title="Supprimer l'ingrédient"
                              onClick={() => {
                                setIngredientLines((prev) => {
                                  if (prev.length <= 1) return [{ ingredientId: '', quantityG: '' }]
                                  return prev.filter((_, i) => i !== idx)
                                })
                              }}
                              className="inline-flex h-11 w-11 shrink-0 items-center justify-center justify-self-end rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5] min-[450px]:justify-self-auto"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )
                      })}

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="text-xs font-extrabold text-black/50">Total recette</div>
                        <div className="text-sm font-extrabold tabular-nums text-[#341c44]">{totalCalories.toFixed(1)} kcal</div>
                      </div>

                      <div className="flex justify-center pt-2">
                        <button
                          type="button"
                          aria-label="Ajouter un ingrédient"
                          title="Ajouter un ingrédient"
                          onClick={() => setIngredientLines((prev) => [...prev, { ingredientId: '', quantityG: '' }])}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#341c44] text-white shadow-sm hover:opacity-90"
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none">
                            <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-extrabold text-[#341c44]">Étapes</div>
                  </div>

                  <div className="grid gap-2">
                    {steps.map((s, idx) => (
                      <div key={idx} className="grid min-w-0 grid-cols-[minmax(0,1fr)_44px] gap-2">
                        <input
                          value={s}
                          onChange={(e) => {
                            const v = e.target.value
                            setSteps((prev) => prev.map((p, i) => (i === idx ? v : p)))
                          }}
                          className="h-11 w-full min-w-0 rounded-2xl bg-white px-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                          placeholder={`Étape ${idx + 1}`}
                        />

                        <button
                          type="button"
                          aria-label="Supprimer l'étape"
                          title="Supprimer l'étape"
                          onClick={() => {
                            setSteps((prev) => {
                              if (prev.length <= 1) return ['']
                              return prev.filter((_, i) => i !== idx)
                            })
                          }}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      aria-label="Ajouter une étape"
                      title="Ajouter une étape"
                      onClick={() => setSteps((prev) => [...prev, ''])}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#341c44] text-white shadow-sm hover:opacity-90"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none">
                        <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:sticky lg:top-28 self-start">
                <div className="text-xs font-extrabold text-[#341c44]">Photo</div>
                <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
                  <div className="flex min-h-[140px] items-center justify-center bg-black/5">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl} alt="Photo recette" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-sm font-semibold text-black/50">Ajouter une photo</div>
                    )}
                  </div>
                  <div className="border-t border-black/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <input
                        id={photoInputId}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          const next = URL.createObjectURL(f)
                          setPhotoUrl((prev) => {
                            if (prev) URL.revokeObjectURL(prev)
                            return next
                          })
                        }}
                        className="sr-only"
                      />
                      <label
                        htmlFor={photoInputId}
                        className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#341c44] px-4 text-sm font-extrabold text-white shadow-sm hover:opacity-90"
                      >
                        Choisir une photo
                      </label>
                      {photoUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoUrl((prev) => {
                              if (prev) URL.revokeObjectURL(prev)
                              return null
                            })
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                        >
                          Supprimer
                        </button>
                      ) : (
                        <div className="text-sm font-semibold text-black/50">&nbsp;</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#341c44] px-6 text-sm font-extrabold text-white shadow-sm hover:opacity-90"
                disabled={loading}
                onClick={() => void onPublish()}
              >
                {loading ? 'Publication…' : 'Publier'}
              </button>
            </div>
          </Card>
        </div>
      </Container>
    </main>
  )
}
