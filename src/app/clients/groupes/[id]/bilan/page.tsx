import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { DeleteBilanBatchButton } from '@/src/components/bilans/DeleteBilanBatchButton'
import { RelanceBilanBatchDialog } from '@/src/components/bilans/RelanceBilanBatchDialog'
import { SendBilanDialog } from '@/src/components/bilans/SendBilanDialog'
import { canAccessCoachApp } from '../../../../../lib/auth/roles'
import {
  listInstancesForCoachGroup,
  listTemplates,
} from '../../../../../lib/bilans/bilans'
import { buildBilanHubRows } from '../../../../../lib/bilans/hubRows'
import { canDeleteBilan, canRelaunchBilan, clientBilanPath } from '../../../../../lib/bilans/relance'
import { clientDisplayName } from '../../../../../lib/chat/chat'
import { createClient } from '../../../../../lib/supabase/server'
import { appUrl } from '../../../../../lib/urls'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ envoyer?: string; sent?: string; error?: string }>
    | { envoyer?: string; sent?: string; error?: string }
}

export default async function GroupBilanPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, name')
    .eq('id', id)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .maybeSingle()

  if (!group) notFound()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')

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

  let templates: Awaited<ReturnType<typeof listTemplates>> = []
  let instances: Awaited<ReturnType<typeof listInstancesForCoachGroup>> = []
  try {
    ;[templates, instances] = await Promise.all([
      listTemplates(supabase, user.id),
      listInstancesForCoachGroup(supabase, user.id, group.id),
    ])
  } catch {
    /* ignore */
  }

  const readyTemplates = templates.filter((t) => t.status === 'ready')
  const clientName = new Map(
    (clients ?? []).map((c) => [
      c.id,
      clientDisplayName({ first_name: c.first_name, last_name: c.last_name, email: c.email }),
    ]),
  )
  const groupName = new Map([[group.id, group.name]])
  const hubRows = buildBilanHubRows(instances, groupName).filter(
    (row) => row.kind === 'group' && row.groupId === group.id,
  )

  const clientOpts = (clients ?? []).map((c) => ({
    id: c.id,
    label: clientName.get(c.id) ?? c.email,
  }))

  function bilanUrl(instanceId: string) {
    return slug ? appUrl(clientBilanPath(slug, instanceId)) : ''
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[color:var(--muted)]">Bilans envoyés à ce groupe</p>
        <SendBilanDialog
          templates={readyTemplates.map((t) => ({ id: t.id, title: t.title }))}
          clients={clientOpts}
          groups={[{ id: group.id, name: group.name }]}
          prestations={(prestations ?? []).map((p) => ({ id: p.id, name: p.name }))}
          preselectedGroupId={group.id}
          defaultOpen={q.envoyer === '1'}
          returnTo={`/clients/groupes/${group.id}/bilan`}
          triggerLabel="Envoyer bilan"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
        {!hubRows.length ? (
          <p className="px-5 py-8 text-sm text-[color:var(--muted)]">
            Aucun envoi groupe pour l’instant.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {hubRows.map((row) => {
              if (row.kind !== 'group') return null
              const pending = row.instances.filter((i) => canRelaunchBilan(i.status))
              const deletable = row.instances.filter((i) => canDeleteBilan(i.status))
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
                      {row.instances.length} client{row.instances.length > 1 ? 's' : ''} ·{' '}
                      {new Date(row.appears_at).toLocaleDateString('fr-FR')}
                      {row.pendingCount ? ` · ${row.pendingCount} en attente` : ''}
                    </p>
                  </Link>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {pending.length && slug ? (
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
                    {deletable.length ? (
                      <DeleteBilanBatchButton
                        batchId={row.batchId}
                        deletableCount={deletable.length}
                        returnTo={`/clients/groupes/${group.id}/bilan`}
                      />
                    ) : null}
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand)]">
                      {row.submittedCount}/{row.instances.length} remplis
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
