import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'

import { ChatCallPhoneButton } from '../../../../../components/chat/ChatCallPhoneButton'
import { ChatThreadWithTools } from '../../../../../components/chat/ChatThreadWithTools'
import { ClientPortalShell } from '../../../../../components/client-portal/ClientPortalShell'
import { IconCaret, IconUsers } from '../../../../../components/ui/icons'
import { portalShellProps, requireClientPortal } from '../../../../../lib/client-portal/context'
import {
  chatDb,
  initialsFromName,
  listClientInbox,
  loadCoachDisplayName,
  loadPeerLastReadAt,
  loadSenderNames,
  loadThreadMessages,
  markThreadRead,
  signedChatMediaUrl,
} from '../../../../../lib/chat/chat'
import { contrastBrandFg } from '../../../../../lib/coach/clientBrandTheme'
import { createClient } from '../../../../../lib/supabase/server'
import {
  clientDeleteMessageAction,
  clientForwardMessageAction,
  clientPinMessageAction,
  clientSendMessageAction,
  clientToggleReactionAction,
  clientUploadChatMediaAction,
} from '../actions'

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

  const db = chatDb(supabase)
  const { data: thread } = await db
    .from('chat_threads')
    .select('id, client_id, type, group_id, title, coach_id')
    .eq('id', threadId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!thread) notFound()
  if (thread.type === 'dm' && thread.client_id !== ctx.client.id) notFound()

  await markThreadRead(supabase, threadId, user!.id)
  try {
    await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user!.id)
      .eq('type', 'chat_message')
      .is('read_at', null)
      .contains('payload', { thread_id: threadId })
  } catch {
    // ignore
  }

  const coachName = await loadCoachDisplayName(supabase, ctx.coachId)
  const [messages, peerLastReadAt, inbox] = await Promise.all([
    loadThreadMessages(supabase, threadId, user!.id),
    loadPeerLastReadAt(supabase, threadId, user!.id).catch(() => null),
    listClientInbox(supabase, ctx.client.id, user!.id, coachName).catch(() => []),
  ])

  const senderNames = await loadSenderNames(
    supabase,
    messages.flatMap((m) => [m.sender_id, m.reply?.sender_id].filter(Boolean) as string[])
  ).catch(() => ({} as Record<string, string>))

  senderNames[ctx.coachId] = coachName
  const meLabel = [ctx.client.first_name, ctx.client.last_name].filter(Boolean).join(' ').trim()
  if (meLabel) senderNames[user!.id] = meLabel
  else senderNames[user!.id] = 'Vous'

  let title = coachName
  if (thread.type === 'group') {
    title = thread.title || 'Groupe'
    if (thread.group_id) {
      const { data: g } = await supabase
        .from('client_groups')
        .select('name')
        .eq('id', thread.group_id)
        .maybeSingle()
      if (g?.name) title = g.name
    }
  }

  const { data: coachProf } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', ctx.coachId)
    .maybeSingle()

  const mediaUrls: Record<string, string> = {}
  await Promise.all(
    messages
      .filter((m) => m.media_path)
      .map(async (m) => {
        const url = await signedChatMediaUrl(supabase, m.media_path!)
        if (url) mediaUrls[m.media_path!] = url
      }),
  )

  const forwardTargets = inbox
    .filter((i) => i.threadId !== threadId && !i.archived)
    .slice(0, 40)
    .map((i) => ({ threadId: i.threadId, title: i.title }))

  const mentionCandidates = [{ id: ctx.coachId, label: coachName }]

  const brandStyle = {
    ['--brand']: ctx.primaryColor,
    ['--brand-fg']: contrastBrandFg(ctx.primaryColor),
    ['--brand-secondary']: ctx.secondaryColor,
  } as CSSProperties

  return (
    <ClientPortalShell {...portalShellProps(ctx)} hideBottomNav chatLayout>
      {q.error ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {q.error}
        </div>
      ) : null}

      <div
        className="coach-chat coach-chat--thread client-chat client-chat--immersive"
        style={brandStyle}
      >
        <section className="coach-chat__panel">
          <div className="flex min-h-0 flex-1 flex-col">
            <ChatThreadWithTools
              messages={messages}
              currentUserId={user!.id}
              primaryColor={ctx.primaryColor}
              threadId={threadId}
              sendAction={clientSendMessageAction}
              uploadAction={clientUploadChatMediaAction}
              reactionAction={clientToggleReactionAction}
              deleteAction={clientDeleteMessageAction}
              pinAction={clientPinMessageAction}
              forwardAction={clientForwardMessageAction}
              hiddenFields={{ slug: ctx.slug }}
              mediaUrls={mediaUrls}
              senderNames={senderNames}
              peerLastReadAt={peerLastReadAt}
              forwardTargets={forwardTargets}
              mentionCandidates={mentionCandidates}
              variant="portal"
              headerLeading={
                thread.type === 'dm' ? (
                  <ChatCallPhoneButton
                    phone={coachProf?.phone ?? null}
                    emptyTitle="Pas de numéro coach"
                    emptyBody="Ton coach n’a pas encore renseigné son téléphone."
                  />
                ) : null
              }
              titleBlock={
                <>
                  <Link
                    key="back"
                    href={`/c/${ctx.slug}/messages`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
                    aria-label="Retour aux messages"
                  >
                    <IconCaret dir="left" />
                  </Link>
                  <span key="avatar" className="coach-chat__avatar" aria-hidden>
                    {thread.type === 'group' ? (
                      <IconUsers size={18} />
                    ) : (
                      initialsFromName(title)
                    )}
                  </span>
                  <div key="meta" className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[color:var(--fg)]">{title}</p>
                    {thread.type === 'group' ? (
                      <p className="truncate text-[10px] font-semibold text-[color:var(--muted)]">
                        Groupe
                      </p>
                    ) : (
                      <p className="truncate text-[10px] font-semibold text-[color:var(--muted)]">
                        Ton coach
                      </p>
                    )}
                  </div>
                </>
              }
            />
          </div>
        </section>
      </div>
    </ClientPortalShell>
  )
}
