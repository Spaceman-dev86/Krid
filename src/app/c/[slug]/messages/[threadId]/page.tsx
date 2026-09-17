import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ChatThreadClient } from '../../../../../components/chat/ChatThreadClient'
import { ClientPortalShell } from '../../../../../components/client-portal/ClientPortalShell'
import { requireClientPortal, requirePortalModule } from '../../../../../lib/client-portal/context'
import { chatDb, loadCoachDisplayName, loadThreadMessages, markThreadRead } from '../../../../../lib/chat/chat'
import { createClient } from '../../../../../lib/supabase/server'
import { clientSendMessageAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string; threadId: string }> | { slug: string; threadId: string }
  searchParams?: Promise<{ error?: string }> | { error?: string }
}

export default async function ClientMessageThreadPage({ params, searchParams }: Props) {
  const { slug, threadId } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const ctx = await requireClientPortal(supabase, slug, user?.id)
  requirePortalModule(ctx, 'messaging')

  const db = chatDb(supabase)
  const { data: thread } = await db
    .from('chat_threads')
    .select('id, client_id, type')
    .eq('id', threadId)
    .eq('client_id', ctx.client.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!thread) notFound()

  await markThreadRead(supabase, threadId, user!.id)
  const [messages, coachName] = await Promise.all([
    loadThreadMessages(supabase, threadId),
    loadCoachDisplayName(supabase, ctx.coachId),
  ])

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-4">
        <div>
          <Link
            href={`/c/${ctx.slug}/messages`}
            className="text-xs font-bold text-black/45 hover:text-black/65"
          >
            ← Messages
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            {coachName}
          </h1>
        </div>

        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error}
          </div>
        ) : null}

        <ChatThreadClient
          messages={messages}
          currentUserId={user!.id}
          primaryColor={ctx.primaryColor}
          threadId={threadId}
          sendAction={clientSendMessageAction}
          hiddenFields={{ slug: ctx.slug }}
        />
      </div>
    </ClientPortalShell>
  )
}
