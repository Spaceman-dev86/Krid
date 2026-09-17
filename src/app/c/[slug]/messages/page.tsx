import Link from 'next/link'

import { ClientPortalShell } from '../../../../components/client-portal/ClientPortalShell'
import { requireClientPortal, requirePortalModule } from '../../../../lib/client-portal/context'
import { listClientInbox, loadCoachDisplayName, relativeChatTime } from '../../../../lib/chat/chat'
import { createClient } from '../../../../lib/supabase/server'
import { startCoachDmAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> | { slug: string } }

export default async function ClientMessagesPage({ params }: Props) {
  const { slug } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const ctx = await requireClientPortal(supabase, slug, user?.id)
  requirePortalModule(ctx, 'messaging')

  const coachName = await loadCoachDisplayName(supabase, ctx.coachId)

  let inbox: Awaited<ReturnType<typeof listClientInbox>> = []
  let inboxError: string | null = null
  try {
    inbox = await listClientInbox(supabase, ctx.client.id, user!.id, coachName)
  } catch (e) {
    inboxError = e instanceof Error ? e.message : 'Erreur chargement messages'
  }

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
              Messages
            </h1>
            <p className="mt-1 text-sm text-black/55">Chat avec ton coach</p>
          </div>
          {!inbox.length ? (
            <form action={startCoachDmAction}>
              <input type="hidden" name="slug" value={ctx.slug} />
              <button
                type="submit"
                className="rounded-xl px-3 py-2 text-xs font-bold text-white"
                style={{ backgroundColor: ctx.primaryColor }}
              >
                Écrire au coach
              </button>
            </form>
          ) : null}
        </div>

        {inboxError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {inboxError}
          </div>
        ) : null}

        {!inbox.length && !inboxError ? (
          <section className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/50 shadow-sm">
            Pas encore de conversation. Touche « Écrire au coach » pour démarrer.
          </section>
        ) : inbox.length ? (
          <ul className="divide-y divide-black/5 rounded-2xl border border-black/10 bg-white shadow-sm">
            {inbox.map((item) => (
              <li key={item.threadId}>
                <Link
                  href={`/c/${ctx.slug}/messages/${item.threadId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-black/[0.02]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#1a1220]">
                      {item.unread ? (
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: ctx.primaryColor }}
                        />
                      ) : null}
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-black/45">{item.preview}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-black/40">
                    {relativeChatTime(item.at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {inbox.length > 0 ? (
          <form action={startCoachDmAction} className="text-center">
            <input type="hidden" name="slug" value={ctx.slug} />
            <button type="submit" className="text-xs font-bold underline-offset-2 hover:underline" style={{ color: ctx.primaryColor }}>
              Ouvrir le fil coach
            </button>
          </form>
        ) : null}
      </div>
    </ClientPortalShell>
  )
}
