import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { listCoachRecipes } from '../../../lib/nutrition/plans'
import { createClient } from '../../../lib/supabase/server'
import { deleteRecipeAction, saveRecipeAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; saved?: string; deleted?: string }>
    | { error?: string; saved?: string; deleted?: string }
}

export default async function NutritionRecipesPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  let recipes: Awaited<ReturnType<typeof listCoachRecipes>> = []
  let loadError: string | null = null
  try {
    recipes = await listCoachRecipes(supabase, user.id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Recettes" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Recettes</PageTitle>
            <Muted className="mt-1">Briques réutilisables dans le builder</Muted>
          </div>
          <Link href="/nutrition" className="text-sm font-semibold text-[color:var(--brand)] underline">
            ← Plans
          </Link>
        </div>

        {q.error || loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error || loadError}
          </div>
        ) : null}
        {q.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Recette enregistrée.
          </div>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
          <h2 className="text-sm font-extrabold text-[color:var(--brand)]">Nouvelle recette</h2>
          <form action={saveRecipeAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              name="title"
              required
              placeholder="Nom *"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              name="kcal"
              type="number"
              step="1"
              placeholder="kcal"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <input
              name="protein_g"
              type="number"
              step="0.1"
              placeholder="Protéines (g)"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <input
              name="carbs_g"
              type="number"
              step="0.1"
              placeholder="Glucides (g)"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <input
              name="fat_g"
              type="number"
              step="0.1"
              placeholder="Lipides (g)"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <textarea
              name="notes"
              rows={2}
              placeholder="Notes"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm sm:col-span-2"
            />
            <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold justify-self-start sm:col-span-2">Ajouter</Button>
          </form>
        </section>

        <ul className="grid gap-2">
          {recipes.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm"
            >
              <div>
                <p className="font-extrabold text-[color:var(--brand)]">{r.title}</p>
                <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                  {[
                    r.kcal != null ? `${r.kcal} kcal` : null,
                    r.protein_g != null ? `P ${r.protein_g}g` : null,
                    r.carbs_g != null ? `G ${r.carbs_g}g` : null,
                    r.fat_g != null ? `L ${r.fat_g}g` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Macros non renseignées'}
                </p>
                {r.notes ? <p className="mt-1 text-xs text-[color:var(--muted)]">{r.notes}</p> : null}
              </div>
              <form action={deleteRecipeAction}>
                <input type="hidden" name="recipe_id" value={r.id} />
                <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
                  Supprimer
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </CoachAppShell>
  )
}
