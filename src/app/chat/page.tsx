import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { clientDisplayName, listCoachInbox, relativeChatTime } from '../../lib/chat/chat'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { createClient } from '../../lib/supabase/server'
import { openDmWithClientAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Promise<{ error?: string; q?: string }> | { error?: string; q?: string }
}

export default async function CoachChatInboxPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  let inbox: Awaited<ReturnType<typeof listCoachInbox>> = []
  let inboxError: string | null = null
  try {
    inbox = await listCoachInbox(supabase, user.id, user.id)
  } catch (e) {
    inboxError = e instanceof Error ? e.message : 'Erreur chargement inbox'
  }

  const query = String(q.q ?? '').trim().toLowerCase()
  const filtered = query
    ? inbox.filter((i) => i.title.toLowerCase().includes(query))
    : inbox

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('first_name', { ascending: true })
    .limit(80)

  const existingClientIds = new Set(inbox.map((i) => i.clientId).filter(Boolean))
  const startable = (clients ?? []).filter((c) => !existingClientIds.has(c.id))

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Chat" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-6">
        <div>
          <PageTitle className="text-2xl">Messages</PageTitle>
          <Muted className="mt-1">Conversations 1:1 avec tes clients</Muted>
        </div>

        {q.error || inboxError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error || inboxError}
          </div>
        ) : null}

        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q.q ?? ''}
            placeholder="Rechercher un client…"
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none ring-[var(--brand)] focus:ring-2"
          />
          <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">Filtrer</Button>
        </form>

        {!filtered.length ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[color:var(--muted)] shadow-da-sm">
            Aucune conversation{query ? ' pour cette recherche' : ''}.
          </section>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
            {filtered.map((item) => (
              <li key={item.threadId}>
                <Link
                  href={`/chat/${item.threadId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--accent)]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[color:var(--fg)]">
                      {item.unread ? (
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--brand)]" />
                      ) : null}
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-[color:var(--muted)]">{item.preview}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[color:var(--muted)]">
                    {relativeChatTime(item.at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {startable.length > 0 ? (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            <h2 className="text-sm font-bold text-[color:var(--brand)]">Nouveau chat 1:1</h2>
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {startable.slice(0, 12).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-sm font-medium text-[color:var(--fg)]">{clientDisplayName(c)}</span>
                  <form action={openDmWithClientAction}>
                    <input type="hidden" name="client_id" value={c.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] px-3 py-1.5 text-xs font-bold text-[color:var(--brand)]"
                    >
                      Écrire
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </CoachAppShell>
  )
}
