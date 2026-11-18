import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'

import {
  CoachQueryFlash,
  PROGRAMS_OMIT_SUCCESS_FLASH,
} from '@/src/components/coach/CoachQueryFlash'
import { ProgramsPlanFicheClient } from '@/src/components/programs/ProgramsPlanFicheClient'
import { canAccessCoachApp } from '@/src/lib/auth/roles'
import {
  effectiveStatus,
  listInstancesForCoachClient,
  listTemplates,
  statusLabel,
} from '@/src/lib/bilans/bilans'
import { loadPlanFiche } from '@/src/lib/programs/loadPlanFiche'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ planId: string }> | { planId: string }
  searchParams?:
    | Promise<{ w?: string; sid?: string; saved?: string }>
    | { w?: string; sid?: string; saved?: string }
}

export default async function ProgramsPlanFichePage({ params, searchParams }: Props) {
  const { planId } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const wRaw = Number.parseInt(String(q.w ?? ''), 10)
  const initialWeekIndex = Number.isFinite(wRaw) && wRaw >= 0 ? wRaw : null
  const sid = String(q.sid ?? '').trim()
  const initialSessionId = /^[0-9a-f-]{36}$/i.test(sid) ? sid : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  let data: Awaited<ReturnType<typeof loadPlanFiche>> = null
  let loadError: string | null = null
  try {
    data = await loadPlanFiche(supabase, user.id, planId)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  if (!loadError && !data) notFound()

  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-[color:var(--muted)]">{loadError ?? 'Plan introuvable.'}</p>
      </div>
    )
  }

  let bilanTemplates: { id: string; title: string }[] = []
  let recentBilans: {
    id: string
    title: string
    statusLabel: string
    dateLabel: string
  }[] = []
  try {
    const [templates, instances] = await Promise.all([
      listTemplates(supabase, user.id),
      listInstancesForCoachClient(supabase, user.id, data.clientId),
    ])
    bilanTemplates = templates
      .filter((t) => t.status === 'ready')
      .map((t) => ({ id: t.id, title: t.title }))
    recentBilans = instances.slice(0, 5).map((inst) => {
      const status = effectiveStatus(inst.status, inst.due_at)
      const when = inst.submitted_at || inst.appears_at || inst.created_at
      return {
        id: inst.id,
        title: inst.title,
        statusLabel: statusLabel(status),
        dateLabel: when
          ? new Date(when).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '—',
      }
    })
  } catch {
    // bilans optionnels — CTAs restent utilisables si templates vides (bouton disabled)
  }

  return (
    <>
      <Suspense fallback={null}>
        <CoachQueryFlash omitKeys={PROGRAMS_OMIT_SUCCESS_FLASH} />
      </Suspense>
      <ProgramsPlanFicheClient
        data={data}
        bilanTemplates={bilanTemplates}
        recentBilans={recentBilans}
        initialWeekIndex={initialWeekIndex}
        initialSessionId={initialSessionId}
      />
    </>
  )
}
