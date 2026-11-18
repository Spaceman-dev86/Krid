import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { GroupManualTagsCard } from '@/src/components/coach/GroupManualTagsCard'
import { GroupPushContentForm } from '@/src/components/coach/GroupPushContentForm'
import { GroupRemovePushedContentButton } from '@/src/components/coach/GroupRemovePushedContentButton'
import { canAccessCoachApp } from '../../../../../lib/auth/roles'
import { loadSendableCoachTemplates } from '@/src/lib/programs/loadSendableCoachTemplates'
import { createClient } from '../../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

export default async function GroupPrestationPage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, name, type, prestation_id')
    .eq('id', id)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .maybeSingle()

  if (!group) notFound()

  const isLinked = group.type === 'linked'

  const [
    { data: prestations },
    programs,
    { data: nutritionPlans },
    { count: memberCountRaw },
    tagsResult,
    linkedBundle,
  ] = await Promise.all([
    supabase.from('prestations').select('id, name').eq('coach_id', user.id).order('name', { ascending: true }),
    loadSendableCoachTemplates(supabase, user.id),
    supabase
      .from('nutrition_plans')
      .select('id, title')
      .eq('coach_id', user.id)
      .is('deleted_at', null)
      .order('title', { ascending: true }),
    supabase
      .from('client_group_members')
      .select('client_id', { count: 'exact', head: true })
      .eq('group_id', group.id),
    !isLinked
      ? supabase
          .from('client_group_tags')
          .select('kind, ref_id, sort_order')
          .eq('group_id', group.id)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: null as { kind: string; ref_id: string; sort_order: number }[] | null, error: null }),
    group.prestation_id
      ? (async () => {
          const { data: presta } = await supabase
            .from('prestations')
            .select('id, name, program_template_id, nutrition_template_id, drive_folder_id')
            .eq('id', group.prestation_id!)
            .maybeSingle()
          if (!presta) {
            return {
              prestaName: null as string | null,
              linkedProgram: null as { id: string; title: string } | null,
              linkedNutrition: null as { id: string; title: string } | null,
              linkedDriveName: null as string | null,
              activeGrantCount: 0,
            }
          }
          const [progRes, nutRes, folderRes, grantRes] = await Promise.all([
            presta.program_template_id
              ? supabase
                  .from('programs')
                  .select('id, title')
                  .eq('id', presta.program_template_id)
                  .is('deleted_at', null)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            presta.nutrition_template_id
              ? supabase
                  .from('nutrition_plans')
                  .select('id, title')
                  .eq('id', presta.nutrition_template_id)
                  .is('deleted_at', null)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            presta.drive_folder_id
              ? supabase
                  .from('drive_folders')
                  .select('name')
                  .eq('id', presta.drive_folder_id)
                  .is('deleted_at', null)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            supabase
              .from('client_grants')
              .select('id', { count: 'exact', head: true })
              .eq('prestation_id', group.prestation_id!)
              .eq('status', 'active'),
          ])
          return {
            prestaName: presta.name ?? null,
            linkedProgram: progRes.data
              ? { id: progRes.data.id, title: progRes.data.title?.trim() || 'Sans titre' }
              : null,
            linkedNutrition: nutRes.data
              ? { id: nutRes.data.id, title: nutRes.data.title?.trim() || 'Sans titre' }
              : null,
            linkedDriveName: folderRes.data?.name ?? null,
            activeGrantCount: grantRes.count ?? 0,
          }
        })()
      : Promise.resolve({
          prestaName: null as string | null,
          linkedProgram: null as { id: string; title: string } | null,
          linkedNutrition: null as { id: string; title: string } | null,
          linkedDriveName: null as string | null,
          activeGrantCount: 0,
        }),
  ])

  const prestaName = linkedBundle.prestaName
  const linkedProgram = linkedBundle.linkedProgram
  const linkedNutrition = linkedBundle.linkedNutrition
  const linkedDriveName = linkedBundle.linkedDriveName
  const activeGrantCount = linkedBundle.activeGrantCount
  const memberCount = memberCountRaw ?? 0

  type TagRow = { kind: string; ref_id: string; sort_order: number }
  let tagRows: TagRow[] = []
  if (!isLinked) {
    if (!tagsResult.error) tagRows = (tagsResult.data ?? []) as TagRow[]
    if (!tagRows.length && group.prestation_id && prestaName) {
      tagRows = [{ kind: 'prestation', ref_id: group.prestation_id, sort_order: 0 }]
    }
  }

  const programTitleById = new Map(
    (programs ?? []).map((p) => [p.id, p.title?.trim() || 'Sans titre'] as const),
  )
  const prestaNameById = new Map((prestations ?? []).map((p) => [p.id, p.name] as const))

  const resolvedTags = tagRows
    .map((t) => {
      if (t.kind === 'prestation') {
        const label = prestaNameById.get(t.ref_id)
        return label ? { kind: 'prestation' as const, refId: t.ref_id, label } : null
      }
      if (t.kind === 'program') {
        const label = programTitleById.get(t.ref_id)
        return label ? { kind: 'program' as const, refId: t.ref_id, label } : null
      }
      return null
    })
    .filter(Boolean) as { kind: 'prestation' | 'program'; refId: string; label: string }[]

  const canPush = isLinked ? activeGrantCount > 0 : memberCount > 0

  const programOpts = (programs ?? []).map((p) => ({
    id: p.id,
    title: p.title?.trim() || 'Sans titre',
  }))
  const nutritionOpts = (nutritionPlans ?? []).map((p) => ({
    id: p.id,
    title: p.title?.trim() || 'Sans titre',
  }))
  const submitLabel = isLinked ? 'Ajouter aux clients actifs' : 'Ajouter aux membres'

  type PushedRow = {
    id: string
    kind: string
    content_id: string
    last_pushed_at: string
    last_pushed_count: number
  }
  const { data: pushedRowsRaw, error: pushedErr } = await supabase
    .from('client_group_pushed_content')
    .select('id, kind, content_id, last_pushed_at, last_pushed_count')
    .eq('group_id', group.id)
    .order('last_pushed_at', { ascending: false })
  const pushedRows = (!pushedErr ? (pushedRowsRaw ?? []) : []) as PushedRow[]

  const nutritionTitleById = new Map(
    (nutritionPlans ?? []).map((p) => [p.id, p.title?.trim() || 'Sans titre'] as const),
  )

  const pushedList = pushedRows
    .map((row) => {
      const title =
        row.kind === 'nutrition'
          ? nutritionTitleById.get(row.content_id)
          : programTitleById.get(row.content_id)
      if (!title) return null
      const when = new Date(row.last_pushed_at)
      const dateLabel = Number.isNaN(when.getTime())
        ? '—'
        : when.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
      return {
        id: row.id,
        kind: row.kind === 'nutrition' ? ('nutrition' as const) : ('fitness' as const),
        contentId: row.content_id,
        title,
        dateLabel,
        lastCount: row.last_pushed_count,
      }
    })
    .filter(Boolean) as Array<{
    id: string
    kind: 'fitness' | 'nutrition'
    contentId: string
    title: string
    dateLabel: string
    lastCount: number
  }>

  return (
    <div className="grid gap-5">
      {isLinked ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Prestation
          </h2>
          <p className="mt-2 text-sm text-[color:var(--fg)]">
            {prestaName ? (
              <>
                Ce groupe est lié à <strong>{prestaName}</strong>
              </>
            ) : (
              'Presta introuvable'
            )}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Info seule — tu ne changes pas la presta ici.
            {activeGrantCount
              ? ` · ${activeGrantCount} client${activeGrantCount > 1 ? 's' : ''} avec un accès actif`
              : null}
            {group.prestation_id ? (
              <>
                {' · '}
                <Link
                  href={`/profile/prestations/${group.prestation_id}`}
                  className="font-semibold text-[color:var(--brand)] hover:underline"
                >
                  Voir la presta →
                </Link>
              </>
            ) : null}
          </p>

          {linkedProgram || linkedNutrition || linkedDriveName ? (
            <ul className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
              {linkedProgram ? (
                <li className="text-[color:var(--fg)]">
                  <span className="text-[color:var(--muted)]">Programme : </span>
                  <Link
                    href={`/programs/${linkedProgram.id}`}
                    className="font-semibold text-[color:var(--brand)] hover:underline"
                  >
                    {linkedProgram.title}
                  </Link>
                </li>
              ) : null}
              {linkedNutrition ? (
                <li className="text-[color:var(--fg)]">
                  <span className="text-[color:var(--muted)]">Nutrition : </span>
                  <Link
                    href={`/nutrition/${linkedNutrition.id}`}
                    className="font-semibold text-[color:var(--brand)] hover:underline"
                  >
                    {linkedNutrition.title}
                  </Link>
                </li>
              ) : null}
              {linkedDriveName ? (
                <li className="text-[color:var(--fg)]">
                  <span className="text-[color:var(--muted)]">Drive kit : </span>
                  {linkedDriveName}
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-[color:var(--muted)]">
              Aucun programme / nutrition / Drive lié sur cette presta pour l’instant.
            </p>
          )}
        </section>
      ) : (
        <GroupManualTagsCard
          groupId={group.id}
          tags={resolvedTags}
          prestations={(prestations ?? []).map((p) => ({
            kind: 'prestation' as const,
            id: p.id,
            label: p.name,
          }))}
          programs={programOpts.map((p) => ({
            kind: 'program' as const,
            id: p.id,
            label: p.title,
          }))}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Programme sport
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {isLinked
              ? 'Envoie un programme aux clients avec un accès actif — et aux futurs actifs du groupe. S’ils l’ont déjà, rien ne change.'
              : 'Envoie un programme à tous les membres — et aux futurs membres du groupe. S’ils l’ont déjà, rien ne change.'}
          </p>
          <GroupPushContentForm
            groupId={group.id}
            kind="fitness"
            options={programOpts}
            canPush={canPush}
            submitLabel={submitLabel}
            emptyLabel="Aucun programme disponible."
          />
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Nutrition
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {isLinked
              ? 'Envoie un plan nutrition aux clients avec un accès actif — et aux futurs actifs du groupe. S’ils l’ont déjà, rien ne change.'
              : 'Envoie un plan nutrition à tous les membres — et aux futurs membres du groupe. S’ils l’ont déjà, rien ne change.'}
          </p>
          <GroupPushContentForm
            groupId={group.id}
            kind="nutrition"
            options={nutritionOpts}
            canPush={canPush}
            submitLabel={submitLabel}
            emptyLabel="Aucun plan nutrition disponible."
          />
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
          Contenus envoyés depuis ce groupe
        </h2>
        {!pushedList.length ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Aucun programme sport ou nutrition envoyé depuis ce groupe pour l’instant.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {pushedList.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="mr-2 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                    {item.kind === 'nutrition' ? 'Nutrition' : 'Sport'}
                  </span>
                  <Link
                    href={
                      item.kind === 'nutrition'
                        ? `/nutrition/${item.contentId}`
                        : `/programs/${item.contentId}`
                    }
                    className="font-semibold text-[color:var(--brand)] hover:underline"
                  >
                    {item.title}
                  </Link>
                  <span className="ml-2 text-xs text-[color:var(--muted)]">
                    {item.dateLabel}
                    {item.lastCount > 0
                      ? ` · ${item.lastCount} client${item.lastCount > 1 ? 's' : ''}`
                      : null}
                  </span>
                </div>
                <GroupRemovePushedContentButton
                  groupId={group.id}
                  pushedId={item.id}
                  title={item.title}
                  kind={item.kind}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
