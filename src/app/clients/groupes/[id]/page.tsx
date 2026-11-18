import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Button, daSelectClass } from '@/src/components/ui'
import { CoachRdvEntryButton } from '../../../../components/coach/calendar/CoachRdvEntryButton'
import { GroupQuickActions } from '../../../../components/coach/GroupQuickActions'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import { clientDisplayName } from '../../../../lib/chat/chat'
import {
  clientListDisplayName,
  clientListStatusLabel,
  loadClientsListRows,
} from '../../../../lib/coach/loadClientsListRows'
import { createClient } from '../../../../lib/supabase/server'
import {
  addGroupMemberAction,
  deleteGroupAction,
  removeGroupMemberAction,
} from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

export default async function GroupInfosPage({ params }: Props) {
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
    .select('*')
    .eq('id', id)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .maybeSingle()

  if (!group) notFound()

  const isLinked = group.type === 'linked'

  const { data: memberRows } = await supabase
    .from('client_group_members')
    .select('client_id')
    .eq('group_id', id)

  const memberIds = (memberRows ?? []).map((m) => m.client_id)

  const members = memberIds.length
    ? await loadClientsListRows(supabase, user.id, { clientIds: memberIds })
    : []

  const { data: allClients } = await supabase
    .from('clients')
    .select('id, email, first_name, last_name, status')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  const memberSet = new Set(memberIds)
  const candidates = (allClients ?? []).filter((c) => !memberSet.has(c.id))

  const memberCount = members.length

  let chatThreadId: string | null = null
  if (group.chat_enabled) {
    const { data: thread } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('group_id', group.id)
      .eq('coach_id', user.id)
      .eq('type', 'group')
      .is('deleted_at', null)
      .maybeSingle()
    chatThreadId = thread?.id ?? null
  }

  return (
    <div className="grid gap-5 sm:gap-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <GroupQuickActions
          group={{
            id: group.id,
            name: group.name,
            description: group.description,
            chat_enabled: Boolean(group.chat_enabled),
          }}
          chatThreadId={chatThreadId}
        />
        <CoachRdvEntryButton
          clients={members.map((m) => ({
            id: m.id,
            label: clientListDisplayName(m),
          }))}
          groups={[
            {
              id: group.id,
              label: group.name,
              memberIds,
            },
          ]}
          defaultAudience={`group:${group.id}`}
          returnTo={`/clients/groupes/${group.id}`}
          nameMap={new Map(members.map((m) => [m.id, clientListDisplayName(m)]))}
        />
      </div>

      {!isLinked && memberCount < 2 ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--accent)] px-4 py-3 text-xs text-[color:var(--muted)]">
          Ajoute au moins 2 membres pour l’utiliser en envoi groupé.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Membres
          </h2>
        </div>
        {!members.length ? (
          <p className="px-5 py-8 text-sm text-[color:var(--muted)]">
            {isLinked
              ? 'Aucun membre — les clients avec un accès actif à la presta seront ajoutés automatiquement.'
              : 'Aucun membre.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                  <th className="px-5 py-2.5 font-extrabold">Client</th>
                  <th className="px-3 py-2.5 font-extrabold">Prestation(s)</th>
                  <th className="px-3 py-2.5 font-extrabold">Dernier bilan</th>
                  <th className="px-3 py-2.5 font-extrabold">Dernière séance</th>
                  <th className="px-3 py-2.5 font-extrabold">Statut</th>
                  <th className="px-5 py-2.5 font-extrabold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {members.map((m) => {
                  const alumni =
                    isLinked &&
                    Boolean(group.prestation_id) &&
                    !m.prestationIds.includes(group.prestation_id)
                  const archived = m.status === 'archived'

                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)] ${archived ? 'opacity-50' : ''}`}
                    >
                      <td className="px-5 py-3">
                        <Link href={`/clients/${m.id}`} className="block min-w-0">
                          <p className="truncate font-semibold text-[color:var(--brand)]">
                            {clientListDisplayName(m)}
                            {alumni ? (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                                Alumni
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-[color:var(--muted)]">{m.email}</p>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[color:var(--fg)]">
                        {m.prestationNames.length ? m.prestationNames.join(' · ') : '—'}
                      </td>
                      <td className="px-3 py-3 text-[color:var(--fg)]">{m.lastBilanLabel}</td>
                      <td className="px-3 py-3 text-[color:var(--muted)]">{m.lastSessionLabel}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]">
                          {clientListStatusLabel(m.status)}
                          {m.is_demo ? ' · démo' : ''}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!isLinked || alumni ? (
                          <form action={removeGroupMemberAction}>
                            <input type="hidden" name="group_id" value={group.id} />
                            <input type="hidden" name="client_id" value={m.id} />
                            <button
                              type="submit"
                              className="text-xs font-semibold text-[var(--danger)] hover:underline"
                            >
                              Retirer
                            </button>
                          </form>
                        ) : (
                          <span className="text-[10px] font-semibold text-[color:var(--muted)]">
                            Sync
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLinked ? (
          <div className="border-t border-[var(--border)] px-5 py-4">
            <form action={addGroupMemberAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="group_id" value={group.id} />
              <label className="grid min-w-[12rem] flex-1 gap-1 text-xs font-semibold text-[color:var(--muted)]">
                Ajouter un client
                <select name="client_id" required className={daSelectClass}>
                  <option value="">Choisir…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {clientDisplayName({
                        first_name: c.first_name,
                        last_name: c.last_name,
                        email: c.email,
                      })}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm">
                Ajouter
              </Button>
            </form>
            <p className="mt-2 text-[11px] text-[color:var(--muted)]">
              Les contenus déjà envoyés depuis ce groupe lui seront aussi attribués.
            </p>
          </div>
        ) : null}
      </section>

      <form action={deleteGroupAction}>
        <input type="hidden" name="group_id" value={group.id} />
        <button
          type="submit"
          className="text-xs font-semibold text-[var(--danger)] hover:underline"
        >
          Supprimer le groupe
        </button>
      </form>
    </div>
  )
}
