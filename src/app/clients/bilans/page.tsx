import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { BilanTemplateForm } from '../../../components/bilans/BilanTemplateForm'
import { BilanTemplatesList } from '../../../components/bilans/BilanTemplatesList'
import { CreateBilanTemplateDialog } from '../../../components/bilans/CreateBilanTemplateDialog'
import { DeleteBilanButton } from '../../../components/bilans/DeleteBilanButton'
import { RelanceBilanBatchDialog } from '../../../components/bilans/RelanceBilanBatchDialog'
import { RelanceBilanButton } from '../../../components/bilans/RelanceBilanButton'
import { SendBilanDialog } from '../../../components/bilans/SendBilanDialog'
import { BilansListFilters } from '../../../components/coach/BilansListFilters'
import { ClientsHubHeader } from '../../../components/coach/ClientsHubHeader'
import { CoachQueryFlash } from '../../../components/coach/CoachQueryFlash'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import {
  listInstancesForCoach,
  listTemplates,
  statusLabel,
} from '../../../lib/bilans/bilans'
import { buildBilanHubRows, hubRowMatchesFilters } from '../../../lib/bilans/hubRows'
import { canDeleteBilan, canRelaunchBilan, clientBilanPath } from '../../../lib/bilans/relance'
import { clientDisplayName } from '../../../lib/chat/chat'
import { createClient } from '../../../lib/supabase/server'
import { appUrl } from '../../../lib/urls'
import {
  deleteTemplateAction,
  publishDraftTemplateAction,
  saveDraftTemplateAction,
} from './actions'

type Props = {
  searchParams?:
    | Promise<{
        tab?: string
        error?: string
        created?: string
        saved?: string
        deleted?: string
        sent?: string
        q?: string
        client?: string
        status?: string
        group?: string
        nouveau?: string
        envoyer?: string
        draft?: string
        send_group?: string
      }>
    | {
        tab?: string
        error?: string
        created?: string
        saved?: string
        deleted?: string
        sent?: string
        q?: string
        client?: string
        status?: string
        group?: string
        nouveau?: string
        envoyer?: string
        draft?: string
        send_group?: string
      }
}

export default async function ClientsBilansPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const tab =
    q.tab === 'templates' || q.tab === 'brouillon' ? q.tab : 'tous'
  const openCreate = q.nouveau === '1' || q.tab === 'nouveau'
  const sendGroupId = q.send_group || (q.envoyer === '1' || q.tab === 'envoyer' ? q.group : null)
  const openSend = q.envoyer === '1' || q.tab === 'envoyer' || Boolean(q.send_group)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')
  let templates: Awaited<ReturnType<typeof listTemplates>> = []
  let instances: Awaited<ReturnType<typeof listInstancesForCoach>> = []
  let loadError: string | null = null
  try {
    templates = await listTemplates(supabase, user.id)
    instances = await listInstancesForCoach(supabase, user.id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('first_name', { ascending: true })

  const { data: groups } = await supabase
    .from('client_groups')
    .select('id, name')
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .order('name', { ascending: true })

  const { data: prestations } = await supabase
    .from('prestations')
    .select('id, name')
    .eq('coach_id', user.id)
    .order('name', { ascending: true })

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', user.id)
    .maybeSingle()
  const slug = branding?.slug ?? ''

  const clientName = new Map(
    (clients ?? []).map((c) => [
      c.id,
      clientDisplayName({ first_name: c.first_name, last_name: c.last_name, email: c.email }),
    ])
  )
  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]))

  const readyTemplates = templates.filter((t) => t.status === 'ready')
  const drafts = templates.filter((t) => t.status === 'draft')
  const draftCount = drafts.length
  const unreadCount = instances.filter((i) => i.status === 'submitted' && !i.coach_read_at).length

  const searchQ = (q.q ?? '').trim().toLowerCase()
  const statusFilter = q.status ?? ''

  const hubRows = buildBilanHubRows(instances, groupName).filter((row) =>
    hubRowMatchesFilters(row, {
      statusFilter,
      searchQ,
      clientName,
    })
  )

  const clientOpts = (clients ?? []).map((c) => ({
    id: c.id,
    label: clientName.get(c.id) ?? c.email,
  }))

  const editingDraft = q.draft
    ? drafts.find((d) => d.id === q.draft) ?? null
    : drafts[0] ?? null

  function bilanUrl(instanceId: string) {
    if (!slug) return ''
    return appUrl(clientBilanPath(slug, instanceId))
  }

  return (
    <>
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            sent: { tone: 'success', message: 'Bilan(s) envoyé(s)' },
            created: { tone: 'success', message: 'Template créé' },
            deleted: { tone: 'success', message: 'Supprimé' },
            saved: {
              tone: 'success',
              message: tab === 'brouillon' ? 'Brouillon enregistré' : 'Modèle enregistré',
            },
          }}
        />
      </Suspense>

      <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
        <ClientsHubHeader
          title="Bilans"
          subtitle={
            <>
              {unreadCount ? `${unreadCount} non lu${unreadCount > 1 ? 's' : ''} · ` : null}
              {instances.length} envoyé{instances.length > 1 ? 's' : ''}
              {draftCount ? ` · ${draftCount} brouillon${draftCount > 1 ? 's' : ''}` : null}
            </>
          }
          actions={<CreateBilanTemplateDialog defaultOpen={openCreate} />}
        />

        <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--accent)] p-1">
          {(
            [
              ['tous', 'Envoyés'],
              ['templates', 'Templates'],
              ['brouillon', 'Brouillons'],
            ] as const
          ).map(([id, label]) => {
            const href = id === 'tous' ? '/clients/bilans' : `/clients/bilans?tab=${id}`
            const active = tab === id
            return (
              <Link
                key={id}
                href={href}
                className={
                  active
                    ? 'rounded-lg bg-[var(--surface)] px-3 py-1.5 text-sm font-bold text-[color:var(--brand)] shadow-da-sm'
                    : 'rounded-lg px-3 py-1.5 text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)]'
                }
              >
                {label}
                {id === 'brouillon' && draftCount ? (
                  <span className="ml-1.5 rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--brand-fg)]">
                    {draftCount}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>

        {loadError ? (
          <p className="text-sm font-semibold text-[var(--danger)]">{loadError}</p>
        ) : null}

        {tab === 'tous' ? (
          <>
            <Suspense fallback={null}>
              <BilansListFilters
                clients={clientOpts}
                groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name }))}
                trailing={
                  <SendBilanDialog
                    templates={readyTemplates.map((t) => ({ id: t.id, title: t.title }))}
                    clients={clientOpts}
                    groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name }))}
                    prestations={(prestations ?? []).map((p) => ({ id: p.id, name: p.name }))}
                    preselectedGroupId={sendGroupId ?? null}
                    defaultOpen={openSend}
                  />
                }
              />
            </Suspense>
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
              {!hubRows.length ? (
                <p className="px-5 py-8 text-sm text-[color:var(--muted)]">
                  {instances.length
                    ? 'Aucun bilan ne correspond aux filtres.'
                    : 'Aucun bilan envoyé. Crée un template (+) puis Envoyer.'}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {hubRows.map((row) => {
                    if (row.kind === 'group') {
                      const pending = row.instances.filter((i) => canRelaunchBilan(i.status))
                      return (
                        <li
                          key={`batch-${row.batchId}`}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
                        >
                          <Link
                            href={`/clients/bilans/batch/${row.batchId}`}
                            className="min-w-0 flex-1 hover:opacity-90"
                          >
                            <p className="font-semibold text-[color:var(--fg)]">{row.title}</p>
                            <p className="text-xs text-[color:var(--muted)]">
                              Groupe · {row.groupName} · {row.instances.length} client
                              {row.instances.length > 1 ? 's' : ''} ·{' '}
                              {new Date(row.appears_at).toLocaleDateString('fr-FR')}
                              {row.unreadCount ? ` · ${row.unreadCount} non lu` : ''}
                              {row.pendingCount
                                ? ` · ${row.pendingCount} en attente`
                                : ''}
                            </p>
                          </Link>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {pending.length ? (
                              <RelanceBilanBatchDialog
                                batchId={row.batchId}
                                bilanTitle={row.title}
                                pending={pending.map((i) => ({
                                  clientId: i.client_id,
                                  instanceId: i.id,
                                  label: clientName.get(i.client_id) || 'Client',
                                  bilanUrl: bilanUrl(i.id),
                                }))}
                                label="Relancer"
                              />
                            ) : null}
                            <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand)]">
                              {row.submittedCount}/{row.instances.length} remplis
                            </span>
                          </div>
                        </li>
                      )
                    }

                    const inst = row.instance
                    return (
                      <li
                        key={inst.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
                      >
                        <Link
                          href={`/clients/bilans/${inst.id}?from=hub`}
                          className="min-w-0 flex-1 hover:opacity-90"
                        >
                          <p className="font-semibold text-[color:var(--fg)]">{inst.title}</p>
                          <p className="text-xs text-[color:var(--muted)]">
                            {clientName.get(inst.client_id) || 'Client'} ·{' '}
                            {new Date(inst.appears_at).toLocaleDateString('fr-FR')}
                            {!inst.coach_read_at && inst.status === 'submitted' ? ' · Non lu' : ''}
                          </p>
                        </Link>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {canRelaunchBilan(inst.status) ? (
                            <RelanceBilanButton
                              clientId={inst.client_id}
                              instanceId={inst.id}
                              bilanTitle={inst.title}
                              bilanUrl={bilanUrl(inst.id)}
                              label="Relancer"
                            />
                          ) : null}
                          {canDeleteBilan(inst.status) ? (
                            <DeleteBilanButton
                              instanceId={inst.id}
                              returnTo="/clients/bilans"
                            />
                          ) : null}
                          <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand)]">
                            {statusLabel(inst.status)}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        ) : null}

        {tab === 'templates' ? (
          <section className="grid gap-2">
            <BilanTemplatesList
              templates={readyTemplates.map((t) => ({
                id: t.id,
                title: t.title,
                instructions: t.instructions,
                schema: t.schema,
              }))}
            />
          </section>
        ) : null}

        {tab === 'brouillon' ? (
          <section className="grid gap-4">
            {!drafts.length ? (
              <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-sm text-[color:var(--muted)] shadow-da-sm">
                Aucun brouillon. Dans + → « Nouveau bilan », clique{' '}
                <strong className="text-[color:var(--fg)]">Brouillon</strong> pour y revenir plus
                tard.
              </p>
            ) : (
              <>
                {drafts.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {drafts.map((d) => (
                      <Link
                        key={d.id}
                        href={`/clients/bilans?tab=brouillon&draft=${d.id}`}
                        className={
                          editingDraft?.id === d.id
                            ? 'rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-bold text-[color:var(--brand-fg)]'
                            : 'rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[color:var(--muted)]'
                        }
                      >
                        {d.title}
                      </Link>
                    ))}
                  </div>
                ) : null}

                {editingDraft ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
                    <p className="mb-4 text-xs text-[color:var(--muted)]">
                      Finis le template puis « Enregistrer → Templates » pour pouvoir l’envoyer.
                    </p>
                    <BilanTemplateForm
                      action={publishDraftTemplateAction}
                      secondaryAction={saveDraftTemplateAction}
                      secondaryLabel="Garder brouillon"
                      submitLabel="Enregistrer → Templates"
                      templateId={editingDraft.id}
                      titleRequired
                      initial={{
                        title: editingDraft.title,
                        instructions: editingDraft.instructions,
                        schema: editingDraft.schema,
                      }}
                    />
                    <form action={deleteTemplateAction} className="mt-4">
                      <input type="hidden" name="template_id" value={editingDraft.id} />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-[var(--danger)] hover:underline"
                      >
                        Supprimer ce brouillon
                      </button>
                    </form>
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}
      </div>
    </>
  )
}
