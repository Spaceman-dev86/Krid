import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { CreateBilanTemplateDialog } from '@/src/components/bilans/CreateBilanTemplateDialog'
import { DeleteBilanButton } from '@/src/components/bilans/DeleteBilanButton'
import { RelanceBilanButton } from '@/src/components/bilans/RelanceBilanButton'
import { SendBilanDialog } from '@/src/components/bilans/SendBilanDialog'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import {
  listInstancesForCoachClient,
  listTemplates,
  statusLabel,
} from '../../../../lib/bilans/bilans'
import {
  canDeleteBilan,
  canRelaunchBilan,
  clientBilanPath,
} from '../../../../lib/bilans/relance'
import { clientDisplayName } from '../../../../lib/chat/chat'
import { createClient } from '../../../../lib/supabase/server'
import { appUrl } from '../../../../lib/urls'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{
        envoyer?: string
        template_created?: string
        sent?: string
        saved?: string
        deleted?: string
        error?: string
      }>
    | {
        envoyer?: string
        template_created?: string
        sent?: string
        saved?: string
        deleted?: string
        error?: string
      }
}

/**
 * Flux 1 — Liste → fiche client → bilans :
 * timeline + lien vers le détail (réponses) sans `from=hub`.
 */
export default async function ClientBilanPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) notFound()

  const clientLabel = clientDisplayName({
    first_name: client.first_name,
    last_name: client.last_name,
    email: client.email,
  })

  let instances: Awaited<ReturnType<typeof listInstancesForCoachClient>> = []
  let readyTemplates: { id: string; title: string }[] = []
  try {
    const [inst, templates] = await Promise.all([
      listInstancesForCoachClient(supabase, user.id, id),
      listTemplates(supabase, user.id),
    ])
    instances = inst
    readyTemplates = templates.filter((t) => t.status === 'ready').map((t) => ({ id: t.id, title: t.title }))
  } catch {
    instances = []
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', user.id)
    .maybeSingle()
  const slug = branding?.slug ?? ''

  const unread = instances.filter((i) => i.status === 'submitted' && !i.coach_read_at).length
  const returnTo = `/clients/${client.id}/bilan`
  const openSend = q.envoyer === '1'

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
          Bilans
          {unread ? (
            <span className="ml-2 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand-fg)]">
              {unread}
            </span>
          ) : null}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <CreateBilanTemplateDialog
            returnTo={returnTo}
            trigger="button"
            triggerLabel="Créer"
          />
          <SendBilanDialog
            templates={readyTemplates}
            clients={[{ id: client.id, label: clientLabel }]}
            groups={[]}
            preselectedClientId={client.id}
            returnTo={returnTo}
            defaultOpen={openSend}
            triggerLabel="Envoyer"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-[color:var(--muted)]">
        Timeline — clic = détail (réponses si rempli).
      </p>

      {!instances.length ? (
        <p className="mt-3 text-sm text-[color:var(--muted)]">Aucun bilan pour ce client.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {instances.map((inst) => (
            <li
              key={inst.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <Link
                href={`/clients/bilans/${inst.id}`}
                className="min-w-0 flex-1 hover:opacity-90"
              >
                <p className="text-sm font-semibold text-[color:var(--brand)]">{inst.title}</p>
                <p className="text-xs text-[color:var(--muted)]">
                  {statusLabel(inst.status)}
                  {inst.submitted_at
                    ? ` · ${new Date(inst.submitted_at).toLocaleDateString('fr-FR')}`
                    : inst.due_at
                      ? ` · échéance ${new Date(inst.due_at).toLocaleDateString('fr-FR')}`
                      : ''}
                </p>
              </Link>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {canRelaunchBilan(inst.status) ? (
                  <RelanceBilanButton
                    clientId={client.id}
                    instanceId={inst.id}
                    bilanTitle={inst.title}
                    bilanUrl={slug ? appUrl(clientBilanPath(slug, inst.id)) : ''}
                  />
                ) : null}
                {canDeleteBilan(inst.status) ? (
                  <DeleteBilanButton instanceId={inst.id} returnTo={returnTo} />
                ) : null}
                {inst.status === 'submitted' && !inst.coach_read_at ? (
                  <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand-fg)]">
                    Nouveau
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
