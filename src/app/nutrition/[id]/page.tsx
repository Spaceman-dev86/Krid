import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { NutritionPlanEditor } from '../../../components/nutrition/NutritionPlanEditor'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { chatDb, clientDisplayName } from '../../../lib/chat/chat'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import {
  emptyWeekStructure,
  listCoachRecipes,
  parseStructure,
} from '../../../lib/nutrition/plans'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ error?: string; saved?: string; sent?: string }>
    | { error?: string; saved?: string; sent?: string }
}

export default async function NutritionPlanEditPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const db = chatDb(supabase)

  const { data: plan, error } = await db
    .from('nutrition_plans')
    .select('id, title, status, structure')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !plan) {
    redirect('/nutrition?error=' + encodeURIComponent(error?.message || 'Plan introuvable'))
  }

  let recipes: Awaited<ReturnType<typeof listCoachRecipes>> = []
  try {
    recipes = await listCoachRecipes(supabase, user.id)
  } catch {
    recipes = []
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('first_name', { ascending: true })

  const clientOptions = (clients ?? []).map((c) => ({
    id: c.id,
    label: clientDisplayName({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
    }),
  }))

  const structure = parseStructure(plan.structure) ?? emptyWeekStructure()
  const status = plan.status === 'template' ? 'template' : 'draft'

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Éditer plan" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/nutrition" className="text-sm font-semibold text-[color:var(--brand)] underline">
            ← Nutrition
          </Link>
          <Link href="/nutrition/recipes" className="text-sm font-semibold text-[color:var(--muted)] underline">
            Recettes
          </Link>
        </div>

        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error}
          </div>
        ) : null}
        {q.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Plan enregistré.
          </div>
        ) : null}
        {q.sent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Plan envoyé au client (statut En attente).
          </div>
        ) : null}

        <NutritionPlanEditor
          planId={plan.id}
          initialTitle={plan.title}
          initialStatus={status}
          initialStructure={structure}
          recipes={recipes}
          clients={clientOptions}
        />
      </div>
    </CoachAppShell>
  )
}
