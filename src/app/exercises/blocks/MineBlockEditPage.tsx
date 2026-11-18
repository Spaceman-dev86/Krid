import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { BlockFicheEditor } from '@/src/components/admin/BlockFicheEditor'
import { ConfirmSubmitButton, Muted, PageTitle, PendingFormButton } from '@/src/components/ui'
import { CoachQueryFlash } from '../../../components/coach/CoachQueryFlash'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { returnToBackLabel, safeReturnTo } from '../../../lib/navigation/safeReturnTo'
import { createClient } from '../../../lib/supabase/server'
import {
  moveCoachBlockToDraftAction,
  saveCoachBlockAction,
  softDeleteCoachBlockAction,
} from './actions'
import { loadCoachBlockEdit } from './_loadCoachBlockEdit'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ error?: string; saved?: string; returnTo?: string }>
    | { error?: string; saved?: string; returnTo?: string }
}

export default async function EditMineBlockPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const backHref = safeReturnTo(q.returnTo, '/exercises/blocks/mine')
  const backLabel = returnToBackLabel(backHref, '← Ma biblio')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const loaded = await loadCoachBlockEdit(supabase, user.id, id)
  if (!loaded) redirect('/exercises/blocks/mine?error=' + encodeURIComponent('Bloc introuvable'))
  if (loaded.block.status === 'draft') {
    const draftQs = q.returnTo
      ? `?returnTo=${encodeURIComponent(safeReturnTo(q.returnTo, '/exercises/blocks/brouillon'))}`
      : ''
    redirect(`/exercises/blocks/brouillon/${id}${draftQs}`)
  }

  const { block, sports, units, candidates, exerciseIds, exercisePrescriptions, hiddenTypeIds } =
    loaded

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <Suspense fallback={null}>
        <CoachQueryFlash />
      </Suspense>
      <div>
        <p className="text-sm text-[color:var(--muted)]">
          <Link href={backHref} className="font-semibold text-[var(--brand)] hover:underline">
            {backLabel}
          </Link>
        </p>
        <PageTitle className="mt-2">{block.name}</PageTitle>
        <Muted className="mt-1">Édition · publié · utilisable dans le builder</Muted>
      </div>
      <form className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm md:p-5">
        <input type="hidden" name="id" value={block.id} />
        {q.returnTo ? (
          <input type="hidden" name="returnTo" value={safeReturnTo(q.returnTo, backHref)} />
        ) : null}
        <BlockFicheEditor
          candidates={candidates}
          sports={sports}
          units={units}
          showDuplicate={false}
          initial={{
            name: block.name,
            notes: block.notes ?? '',
            timer_note: block.timer_note ?? '',
            sport_id: block.sport_id ?? undefined,
            expected_result_unit_id: block.expected_result_unit_id ?? undefined,
            exercise_ids: exerciseIds,
            exercise_prescriptions: exercisePrescriptions,
            hidden_type_ids: hiddenTypeIds,
          }}
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <input type="hidden" name="from" value="mine" />
          <ConfirmSubmitButton
            formAction={softDeleteCoachBlockAction}
            confirmMessage={`Supprimer « ${block.name} » ? Cette action archive le bloc.`}
            variant="secondary"
            size="md"
            pendingLabel="Suppression…"
          >
            Supprimer
          </ConfirmSubmitButton>
          <PendingFormButton
            type="submit"
            formAction={moveCoachBlockToDraftAction}
            variant="secondary"
          >
            → Brouillon
          </PendingFormButton>
          <PendingFormButton type="submit" formAction={saveCoachBlockAction}>
            Enregistrer
          </PendingFormButton>
        </div>
      </form>
    </div>
  )
}
