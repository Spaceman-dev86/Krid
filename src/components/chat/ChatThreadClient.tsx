'use client'

import { useEffect, useRef } from 'react'

import { formatChatTime, type ChatMessageRow } from '../../lib/chat/chat'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '../../lib/coach/defaultClientPrimaryColor'

type Props = {
  messages: ChatMessageRow[]
  currentUserId: string
  primaryColor?: string
  sendAction: (formData: FormData) => void | Promise<void>
  threadId: string
  /** Extra hidden fields (ex. slug portail). */
  hiddenFields?: Record<string, string>
}

export function ChatThreadClient({
  messages,
  currentUserId,
  // Client-app brand fallback (coach primary_color for portal chat)
  primaryColor = DEFAULT_CLIENT_PRIMARY_COLOR,
  sendAction,
  threadId,
  hiddenFields,
}: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto pb-4">
        {!messages.length ? (
          <p className="py-8 text-center text-sm text-[color:var(--muted)]">Écris le premier message.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-da-sm ${
                    mine
                      ? 'rounded-br-md text-white'
                      : 'rounded-bl-md bg-[var(--surface)] text-[color:var(--fg)] ring-1 ring-[var(--border)]'
                  }`}
                  style={mine ? { backgroundColor: primaryColor } : undefined}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-[color:var(--muted)]'}`}>
                    {formatChatTime(m.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        action={sendAction}
        className="sticky bottom-0 flex gap-2 border-t border-[var(--border)] bg-[var(--page-bg)] pt-3"
      >
        <input type="hidden" name="thread_id" value={threadId} />
        {hiddenFields
          ? Object.entries(hiddenFields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))
          : null}
        <input
          name="body"
          required
          autoComplete="off"
          placeholder="Ton message…"
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:ring-2"
          style={{ ['--tw-ring-color' as string]: primaryColor }}
        />
        <button
          type="submit"
          className="rounded-xl px-4 py-2.5 text-sm font-bold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Envoyer
        </button>
      </form>
    </div>
  )
}
