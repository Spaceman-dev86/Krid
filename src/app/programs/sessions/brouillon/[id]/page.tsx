import Link from 'next/link'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'

import {
  publishCoachSessionAction,
  saveDraftCoachSessionAction,
  softDeleteCoachSessionAction,
} from '@/src/app/programs/sessions/actions'
import { SessionFicheEditor } from '@/src/components/admin/SessionFicheEditor'
import {
  CoachQueryFlash,
  PROGRAMS_OMIT_SUCCESS_FLASH,
} from '@/src/components/coach/CoachQueryFlash'
import { ConfirmSubmitButton, Muted, PageTitle, PendingFormButton } from '@/src/components/ui'
import { canAccessCoachApp } from '@/src/lib/auth/roles'
import { returnToBackLabel, safeReturnTo } from '@/src/lib/navigation/safeReturnTo'
import { loadSessionBlockDetails } from '@/src/lib/sessions/blockDetail'
import {
  restSecondsFromPrescriptions,
  type SessionSlot,
} from '@/src/lib/sessions/constants'
import { loadCoachSessionFicheOptions } from '@/src/lib/sessions/loadCoachSessionFicheOptions'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ error?: string; saved?: string; forked?: string; returnTo?: string }>
    | { error?: string; saved?: string; forked?: string; returnTo?: string }
}

export default async function CoachSessionBrouillonEditPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const backHref = safeReturnTo(q.returnTo, '/programs/sessions/brouillon')
  const backLabel = returnToBackLabel(backHref, '← Brouillons')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: sessionRaw } = await supabase
    .from('session_library' as never)
    .select(
      'id, name, notes, status, allow_duplicate, objective_ressenti, objective_note, objective_difficulty',
    )
    .eq('id' as never, id as never)
    .eq('coach_id' as never, user.id as never)
    .eq('status' as never, 'draft')
    .is('deleted_at' as never, null)
    .maybeSingle()

  if (!sessionRaw) notFound()

  const session = sessionRaw as {
    id: string
    name: string
    notes: string | null
    status: string
    allow_duplicate: boolean
    objective_ressenti: boolean
    objective_note: boolean
    objective_difficulty: boolean
  }

  const [{ data: itemsRaw }, { data: hiddenTypesRaw }, { data: hiddenSportsRaw }, opts] =
    await Promise.all([
      supabase
        .from('session_library_items' as never)
        .select('item_kind, block_id, exercise_id, prescriptions, position')
        .eq('session_id' as never, id as never)
        .order('position' as never, { ascending: true }),
      supabase
        .from('session_library_hidden_types' as never)
        .select('exercise_type_id')
        .eq('session_id' as never, id as never),
      supabase
        .from('session_library_hidden_sports' as never)
        .select('sport_id')
        .eq('session_id' as never, id as never),
      loadCoachSessionFicheOptions(supabase, user.id),
    ])

  const items = (itemsRaw ?? []) as {
    item_kind: string
    block_id: string | null
    exercise_id: string | null
    prescriptions: unknown
    position: number
  }[]

  const blockIds = items.filter((i) => i.item_kind === 'block' && i.block_id).map((i) => i.block_id!)
  const initialBlockDetails = await loadSessionBlockDetails(supabase, blockIds)

  const slots: SessionSlot[] = items.map((r, i) => {
    if (r.item_kind === 'block') {
      return {
        key: `b-${r.block_id}-${i}`,
        kind: 'block' as const,
        blockId: r.block_id ?? undefined,
        prescriptions: [],
      }
    }
    if (r.item_kind === 'rest') {
      return {
        key: `r-${i}`,
        kind: 'rest' as const,
        restSeconds: restSecondsFromPrescriptions(r.prescriptions),
        prescriptions: [],
      }
    }
    return {
      key: `e-${r.exercise_id}-${i}`,
      kind: 'exercise' as const,
      exerciseId: r.exercise_id ?? undefined,
      prescriptions: Array.isArray(r.prescriptions)
        ? (r.prescriptions as SessionSlot['prescriptions'])
        : [],
    }
  })

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <Suspense fallback={null}>
        <CoachQueryFlash omitKeys={PROGRAMS_OMIT_SUCCESS_FLASH} />
      </Suspense>
      <div>
        <p className="text-sm text-[color:var(--muted)]">
          <Link href={backHref} className="font-semibold text-[var(--brand)] hover:underline">
            {backLabel}
          </Link>
        </p>
        <PageTitle className="mt-2">{session.name}</PageTitle>
        <Muted className="mt-1">Brouillon · hors builder tant que non publiée</Muted>
      </div>

      <form className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm md:p-5">
        <input type="hidden" name="id" value={session.id} />
        <input type="hidden" name="current_status" value="draft" />
        {q.returnTo ? (
          <input type="hidden" name="returnTo" value={safeReturnTo(q.returnTo, backHref)} />
        ) : null}
        <SessionFicheEditor
          coachMode
          blocks={opts.blocks}
          exercises={opts.exercises}
          units={opts.units}
          blockCatalog={opts.blockCatalog}
          initialBlockDetails={initialBlockDetails}
          returnToForNewBlock={`/programs/sessions/brouillon/${id}`}
          initial={{
            name: session.name,
            notes: session.notes ?? '',
            allow_duplicate: session.allow_duplicate !== false,
            objective_ressenti: session.objective_ressenti !== false,
            objective_note: session.objective_note !== false,
            objective_difficulty: session.objective_difficulty !== false,
            slots,
            hidden_type_ids: ((hiddenTypesRaw ?? []) as { exercise_type_id: string }[]).map(
              (r) => r.exercise_type_id,
            ),
            hidden_sport_ids: ((hiddenSportsRaw ?? []) as { sport_id: string }[]).map((r) => r.sport_id),
          }}
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <input type="hidden" name="from" value="brouillon" />
          <ConfirmSubmitButton
            formAction={softDeleteCoachSessionAction}
            confirmMessage={`Supprimer « ${session.name} » ?`}
            variant="secondary"
            size="md"
            pendingLabel="Suppression…"
          >
            Supprimer
          </ConfirmSubmitButton>
          <PendingFormButton
            type="submit"
            formAction={saveDraftCoachSessionAction}
            variant="secondary"
          >
            Garder en brouillon
          </PendingFormButton>
          <ConfirmSubmitButton
            confirmMessage="Publier cette séance dans Ma biblio ?"
            formAction={publishCoachSessionAction}
            size="md"
          >
            Publier → Ma biblio
          </ConfirmSubmitButton>
        </div>
      </form>
    </div>
  )
}
