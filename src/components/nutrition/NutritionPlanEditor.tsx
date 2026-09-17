'use client'

import { useState } from 'react'

import { Button } from '@/src/components/ui'
import {
  DAY_LABELS,
  MEAL_SLOT_LABELS,
  type MealSlot,
  type NutritionMeal,
  type NutritionRecipeRow,
  type NutritionStructure,
} from '../../lib/nutrition/plans'
import { saveNutritionPlanAction, sendNutritionPlanAction } from '../../app/nutrition/actions'

type ClientOption = { id: string; label: string }

type Props = {
  planId: string
  initialTitle: string
  initialStatus: 'draft' | 'template'
  initialStructure: NutritionStructure
  recipes: NutritionRecipeRow[]
  clients: ClientOption[]
}

function newMealId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function NutritionPlanEditor({
  planId,
  initialTitle,
  initialStatus,
  initialStructure,
  recipes,
  clients,
}: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [status, setStatus] = useState(initialStatus)
  const [structure, setStructure] = useState(initialStructure)
  const [dayIndex, setDayIndex] = useState(0)
  const [sendClientId, setSendClientId] = useState('')

  const week = structure.weeks[0]
  const day = week?.days.find((d) => d.day_index === dayIndex) ?? week?.days[0]

  function updateMeal(mealId: string, patch: Partial<NutritionMeal>) {
    setStructure((prev) => {
      const next = structuredClone(prev) as NutritionStructure
      const d = next.weeks[0]?.days.find((x) => x.day_index === dayIndex)
      if (!d) return prev
      const meal = d.meals.find((m) => m.id === mealId)
      if (!meal) return prev
      Object.assign(meal, patch)
      return next
    })
  }

  function addFreeItem(mealId: string) {
    const name = window.prompt('Nom de l’aliment / plat ?')
    if (!name?.trim()) return
    setStructure((prev) => {
      const next = structuredClone(prev) as NutritionStructure
      const d = next.weeks[0]?.days.find((x) => x.day_index === dayIndex)
      const meal = d?.meals.find((m) => m.id === mealId)
      if (!meal) return prev
      meal.items.push({ name: name.trim() })
      return next
    })
  }

  function addRecipe(mealId: string, recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId)
    if (!recipe) return
    setStructure((prev) => {
      const next = structuredClone(prev) as NutritionStructure
      const d = next.weeks[0]?.days.find((x) => x.day_index === dayIndex)
      const meal = d?.meals.find((m) => m.id === mealId)
      if (!meal) return prev
      meal.items.push({
        name: recipe.title,
        recipe_id: recipe.id,
        kcal: recipe.kcal ?? undefined,
        protein_g: recipe.protein_g ?? undefined,
        carbs_g: recipe.carbs_g ?? undefined,
        fat_g: recipe.fat_g ?? undefined,
      })
      return next
    })
  }

  function removeItem(mealId: string, itemIndex: number) {
    setStructure((prev) => {
      const next = structuredClone(prev) as NutritionStructure
      const d = next.weeks[0]?.days.find((x) => x.day_index === dayIndex)
      const meal = d?.meals.find((m) => m.id === mealId)
      if (!meal) return prev
      meal.items.splice(itemIndex, 1)
      return next
    })
  }

  function addCollation() {
    setStructure((prev) => {
      const next = structuredClone(prev) as NutritionStructure
      const d = next.weeks[0]?.days.find((x) => x.day_index === dayIndex)
      if (!d) return prev
      d.meals.push({
        id: newMealId(),
        slot: 'collation' as MealSlot,
        title: 'Collation',
        items: [],
      })
      return next
    })
  }

  const targets = structure.targets ?? {}

  return (
    <div className="grid gap-5">
      <form action={saveNutritionPlanAction} className="grid gap-4">
        <input type="hidden" name="plan_id" value={planId} />
        <input type="hidden" name="structure_json" value={JSON.stringify(structure)} />

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
              Titre
            </label>
            <input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
              Statut
            </label>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'template')}
              className="mt-1 block rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="draft">Brouillon</option>
              <option value="template">Template</option>
            </select>
          </div>
          <Button type="submit" className="!rounded-xl !px-4 !py-2.5 text-sm">
            Enregistrer
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            name="target_kcal"
            type="number"
            defaultValue={targets.kcal ?? ''}
            placeholder="Cible kcal"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
          <input
            name="target_protein"
            type="number"
            defaultValue={targets.protein_g ?? ''}
            placeholder="Prot (g)"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
          <input
            name="target_carbs"
            type="number"
            defaultValue={targets.carbs_g ?? ''}
            placeholder="Glucides (g)"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
          <input
            name="target_fat"
            type="number"
            defaultValue={targets.fat_g ?? ''}
            placeholder="Lipides (g)"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
        </div>
      </form>

      <div className="flex gap-1 overflow-x-auto">
        {DAY_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setDayIndex(i)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${
              dayIndex === i
                ? 'bg-[color:var(--brand)] text-[color:var(--icon-solid-fg)]'
                : 'border border-[var(--border)] bg-[var(--surface)] text-[color:var(--muted)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!day ? (
        <p className="text-sm text-[color:var(--muted)]">Jour invalide.</p>
      ) : (
        <ul className="grid gap-3">
          {day.meals.map((meal) => (
            <li key={meal.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input
                  value={meal.title}
                  onChange={(e) => updateMeal(meal.id, { title: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-transparent px-1 text-sm font-extrabold text-[color:var(--brand)] hover:border-[var(--border)]"
                />
                <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                  {MEAL_SLOT_LABELS[meal.slot]}
                </span>
              </div>

              <ul className="mt-2 divide-y divide-[var(--border)]">
                {meal.items.map((item, idx) => (
                  <li key={`${meal.id}-${idx}`} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span>
                      {item.name}
                      {item.kcal != null ? (
                        <span className="ml-2 text-xs text-[color:var(--muted)]">{item.kcal} kcal</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(meal.id, idx)}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Retirer
                    </button>
                  </li>
                ))}
                {!meal.items.length ? (
                  <li className="py-2 text-xs text-[color:var(--muted)]">Aucun aliment — ajoute une recette ou une ligne.</li>
                ) : null}
              </ul>

              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addRecipe(meal.id, e.target.value)
                      e.target.value = ''
                    }
                  }}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
                >
                  <option value="" disabled>
                    + Recette…
                  </option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => addFreeItem(meal.id)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold"
                >
                  + Ligne libre
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={addCollation}
        className="justify-self-start rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs font-bold text-[color:var(--muted)]"
      >
        + Collation ce jour
      </button>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
        <h2 className="text-sm font-extrabold text-[color:var(--brand)]">Envoyer au client</h2>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Crée un plan client en attente (le client démarre depuis Accueil).
        </p>
        <form action={sendNutritionPlanAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="plan_id" value={planId} />
          <select
            name="client_id"
            required
            value={sendClientId}
            onChange={(e) => setSendClientId(e.target.value)}
            className="min-w-[12rem] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choisir un client…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
          >
            Envoyer
          </button>
        </form>
      </section>
    </div>
  )
}
