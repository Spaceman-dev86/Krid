import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DeleteBilanBatchButton } from '@/src/components/bilans/DeleteBilanBatchButton'
import { DeleteBilanButton } from '@/src/components/bilans/DeleteBilanButton'
import { RelanceBilanBatchDialog } from '@/src/components/bilans/RelanceBilanBatchDialog'
import { RelanceBilanButton } from '@/src/components/bilans/RelanceBilanButton'
import { ClientsSubnav } from '../../../../../components/coach/ClientsSubnav'
import { PageTitle } from '@/src/components/ui'
import { canAccessCoachApp } from '../../../../../lib/auth/roles'
import { listInstancesForBatch, statusLabel } from '../../../../../lib/bilans/bilans'
import {
  canDeleteBilan,
  canRelaunchBilan,
  clientBilanPath,
} from '../../../../../lib/bilans/relance'
import { clientDisplayName } from '../../../../../lib/chat/chat'
import { createClient } from '../../../../../lib/supabase/server'
import { appUrl } from '../../../../../lib/urls'

type Props = {
  params: Promise<{ batchId: string }> | { batchId: string }
}

export default async function BilanBatchPage({ params }: Props) {
  const { batchId } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')
  let instances: Awaited<ReturnType<typeof listInstancesForBatch>> = []
  try {
    instances = await listInstancesForBatch(supabase, user.id, batchId)
  } catch {
    instances = []
  }
  if (!instances.length) {
    redirect('/clients/bilans?error=' + encodeURIComponent('Envoi groupe introuvable'))
  }

  const lead = instances[0]
  const clientIds = [...new Set(instances.map((i) => i.client_id))]
  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .in('id', clientIds)

  const clientName = new Map(
    (clients ?? []).map((c) => [
      c.id,
      clientDisplayName({ first_name: c.first_name, last_name: c.last_name, email: c.email }),
    ])
  )

  const groupId = instances.find((i) => i.source_group_id)?.source_group_id ?? null
  let groupName = 'Groupe'
  if (groupId) {
    const { data: g } = await supabase
      .from('client_groups')
      .select('name')
      .eq('id', groupId)
      .maybeSingle()
    if (g?.name) groupName = g.name
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', user.id)
    .maybeSingle()
  const slug = branding?.slug ?? ''

  const pending = instances.filter((i) => canRelaunchBilan(i.status))
  const deletable = instances.filter((i) => canDeleteBilan(i.status))
  const submitted = instances.filter((i) => i.status === 'submitted').length

  function bilanUrl(id: string) {
    if (!slug) return ''
    return appUrl(clientBilanPath(slug, id))
  }

  return (
    <>
      <div className="mx-auto grid max-w-3xl gap-5">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <PageTitle className="text-2xl">{lead.title}</PageTitle>
            <Link
              href="/clients/bilans"
              className="mt-1.5 inline-block text-sm font-semibold text-[color:var(--brand)] hover:underline"
            >
              ← Bilans
            </Link>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Envoi groupe · {groupName} · {instances.length} client
              {instances.length > 1 ? 's' : ''} · {submitted} rempli
              {submitted > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-nowrap items-center justify-end gap-2 sm:w-auto">
            <div className="min-w-0 max-w-[min(100%,28rem)] overflow-x-auto">
              <ClientsSubnav />
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              Clients ({instances.length})
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {deletable.length ? (
                <DeleteBilanBatchButton
                  batchId={batchId}
                  deletableCount={deletable.length}
                  returnTo={`/clients/bilans/batch/${batchId}`}
                />
              ) : null}
              {pending.length ? (
                <RelanceBilanBatchDialog
                  batchId={batchId}
                  bilanTitle={lead.title}
                  pending={pending.map((i) => ({
                    clientId: i.client_id,
                    instanceId: i.id,
                    label: clientName.get(i.client_id) || 'Client',
                    bilanUrl: bilanUrl(i.id),
                  }))}
                />
              ) : null}
            </div>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {instances.map((inst) => (
              <li
                key={inst.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
              >
                <Link
                  href={`/clients/bilans/${inst.id}?from=hub`}
                  className="min-w-0 flex-1 hover:opacity-90"
                >
                  <p className="font-semibold text-[color:var(--fg)]">
                    {clientName.get(inst.client_id) || 'Client'}
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">
                    {statusLabel(inst.status)}
                    {inst.submitted_at
                      ? ` · ${new Date(inst.submitted_at).toLocaleDateString('fr-FR')}`
                      : inst.due_at
                        ? ` · échéance ${new Date(inst.due_at).toLocaleDateString('fr-FR')}`
                        : ''}
                    {inst.client_opened_at ? ' · Ouvert' : ' · Pas encore ouvert'}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {canRelaunchBilan(inst.status) ? (
                    <RelanceBilanButton
                      clientId={inst.client_id}
                      instanceId={inst.id}
                      bilanTitle={inst.title}
                      bilanUrl={bilanUrl(inst.id)}
                    />
                  ) : null}
                  {canDeleteBilan(inst.status) ? (
                    <DeleteBilanButton
                      instanceId={inst.id}
                      returnTo={`/clients/bilans/batch/${batchId}`}
                    />
                  ) : null}
                  <Link
                    href={`/clients/${inst.client_id}/bilan`}
                    className="text-xs font-bold text-[color:var(--brand)] hover:underline"
                  >
                    Fiche
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
