import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { PageTitle } from '@/src/components/ui'
import { ChatThreadClient } from '../../../components/chat/ChatThreadClient'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import {
  chatDb,
  clientDisplayName,
  loadThreadMessages,
  markThreadRead,
} from '../../../lib/chat/chat'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'
import { coachSendMessageAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ threadId: string }> | { threadId: string }
  searchParams?: Promise<{ error?: string }> | { error?: string }
}

export default async function CoachChatThreadPage({ params, searchParams }: Props) {
  const { threadId } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const db = chatDb(supabase)
  const { data: thread } = await db
    .from('chat_threads')
    .select('id, coach_id, client_id, type, clients(first_name, last_name, email)')
    .eq('id', threadId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!thread) notFound()

  const clientRaw = Array.isArray(thread.clients) ? thread.clients[0] : thread.clients
  const title = clientRaw ? clientDisplayName(clientRaw) : 'Conversation'

  await markThreadRead(supabase, threadId, user.id)
  const messages = await loadThreadMessages(supabase, threadId)
  const shell = await loadCoachShellContext(user.id)

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title={title} savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-4">
        <div>
          <Link href="/chat" className="text-xs font-bold text-[color:var(--muted)] hover:text-[color:var(--fg)]">
            ← Messages
          </Link>
          <PageTitle className="mt-2 text-2xl">{title}</PageTitle>
        </div>

        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error}
          </div>
        ) : null}

        <ChatThreadClient
          messages={messages}
          currentUserId={user.id}
          threadId={threadId}
          sendAction={coachSendMessageAction}
        />
      </div>
    </CoachAppShell>
  )
}
