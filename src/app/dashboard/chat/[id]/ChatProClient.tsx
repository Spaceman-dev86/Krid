'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type MessageRow = {
  id: string
  sender: 'client' | 'coach' | 'system'
  body: string
  created_at: string
  reply_to_id?: string | null
}

type Props = {
  messages: MessageRow[]
  sendMessageAction: (formData: FormData) => void | Promise<void>
}

export default function ChatProClient({ messages, sendMessageAction, fixedComposer = false }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [reactionsById, setReactionsById] = useState<Record<string, string | undefined>>({})
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)

  const [optimisticMessages, setOptimisticMessages] = useState<MessageRow[]>([])

  const displayedMessages = useMemo(() => {
    if (optimisticMessages.length === 0) return messages

    const isConfirmed = (o: MessageRow) =>
      messages.some(
        (m) =>
          m.sender === o.sender &&
          m.body === o.body &&
          (m.reply_to_id ?? null) === (o.reply_to_id ?? null)
      )

    const pending = optimisticMessages.filter((o) => !isConfirmed(o))
    return [...messages, ...pending]
  }, [messages, optimisticMessages])

  const messagesById = useMemo(() => {
    const map = new Map<string, MessageRow>()
    for (const m of messages) map.set(m.id, m)
    return map
  }, [messages])

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const t = e.target as HTMLElement | null
      if (!t) return
      if (t.closest('[data-message-root]')) return
      setActiveMessageId(null)
    }

    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  const replyTo = useMemo(() => {
    if (!replyToId) return null
    return messages.find((m) => m.id === replyToId) ?? null
  }, [messages, replyToId])

  const swipeStateRef = useRef<{
    id: string | null
    startX: number
    startY: number
    active: boolean
    triggered: boolean
  }>({ id: null, startX: 0, startY: 0, active: false, triggered: false })

  return (
    <>
      <div className={fixedComposer ? 'grid gap-3 pb-32' : 'grid gap-3 pb-28'}>
        {displayedMessages.length > 0 ? (
          displayedMessages.map((m) => {
            const isCoach = m.sender === 'coach'
            const isSystem = m.sender === 'system'
            const reaction = reactionsById[m.id]
            const isActionable = !isCoach && !isSystem
            const isActive = isActionable && activeMessageId === m.id

            return (
              <div
                key={m.id}
                className={isSystem ? 'flex justify-center' : isCoach ? 'flex justify-end' : 'flex justify-start'}
              >
                <div className={isSystem ? 'relative w-full max-w-[92%]' : 'relative max-w-[85%]'}>
                  <div className="group relative" data-message-root>
                    <button
                      type="button"
                      className={
                        isSystem
                          ? 'block w-full rounded-2xl bg-black/[0.03] px-4 py-2 text-center text-[11px] font-extrabold text-black/50 ring-1 ring-black/10'
                          : isCoach
                            ? 'block w-full rounded-2xl bg-[#341c44] px-4 py-3 pr-10 text-left text-sm font-semibold text-white'
                            : 'block w-full rounded-2xl bg-black/5 px-4 py-3 pr-10 text-left text-sm font-semibold text-[#341c44] ring-1 ring-black/10'
                      }
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        const t = e.target as HTMLElement | null
                        if (t?.closest('button[data-action="message-action"]')) return
                        if (!isActionable) return
                        setActiveMessageId((prev) => (prev === m.id ? null : m.id))
                        swipeStateRef.current = {
                          id: m.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          active: true,
                          triggered: false,
                        }
                      }}
                      onPointerMove={(e) => {
                        const s = swipeStateRef.current
                        if (!s.active || s.id !== m.id || s.triggered) return
                        const dx = e.clientX - s.startX
                        const dy = Math.abs(e.clientY - s.startY)

                        if (dy > 16) return

                        const threshold = isCoach ? -70 : 70
                        if ((threshold > 0 && dx > threshold) || (threshold < 0 && dx < threshold)) {
                          s.triggered = true
                          setReplyToId(m.id)
                        }
                      }}
                      onPointerUp={() => {
                        swipeStateRef.current.active = false
                      }}
                      onPointerCancel={() => {
                        swipeStateRef.current.active = false
                      }}
                      onDoubleClick={() => {
                        setReactionsById((prev) => {
                          const next = { ...prev }
                          next[m.id] = next[m.id] ? undefined : '👍'
                          return next
                        })
                      }}
                      aria-label={
                        replyToId === m.id ? 'Message sélectionné pour répondre' : 'Message (swipe pour répondre)'
                      }
                    >
                      {m.reply_to_id ? (
                        <span
                          className={
                            'mb-2 block rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 ' +
                            (isCoach ? 'bg-white/10' : 'bg-white ring-1 ring-black/10')
                          }
                        >
                          <span className="flex items-start gap-2">
                            <span
                              className={
                                'mt-0.5 h-4 w-1 shrink-0 rounded-full ' +
                                (isCoach ? 'bg-[#c4b5fd]' : 'bg-[#7c3aed]')
                              }
                            />
                            <span className="min-w-0">
                              <span
                                className={
                                  'block text-[10px] font-extrabold sm:text-[11px] ' +
                                  (isCoach ? 'text-white/95' : 'text-[#7c3aed]')
                                }
                              >
                                Réponse
                              </span>
                              <span
                                className={
                                  'block max-w-[220px] truncate text-[10px] font-semibold sm:max-w-none sm:text-[11px] ' +
                                  (isCoach ? 'text-white/70' : 'text-black/60')
                                }
                              >
                                {messagesById.get(m.reply_to_id)?.body ?? 'Message'}
                              </span>
                            </span>
                          </span>
                        </span>
                      ) : null}

                      <span className="block">{m.body}</span>
                    </button>

                    {isActionable ? (
                      <>
                        <div
                          className={
                            (isActive ? 'flex' : 'hidden') +
                            ' pointer-events-none absolute right-2 top-2 z-10 items-center gap-1 sm:hidden'
                          }
                        >
                          <button
                            type="button"
                            data-action="message-action"
                            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white text-[#7c3aed] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => setReplyToId(m.id)}
                            aria-label="Répondre"
                            title="Répondre"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="16"
                              height="16"
                              aria-hidden
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M9 14L4 9l5-5" />
                              <path d="M4 9h10a6 6 0 1 1 0 12H9" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            data-action="message-action"
                            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() =>
                              setReactionsById((prev) => {
                                const next = { ...prev }
                                next[m.id] = next[m.id] ? undefined : '👍'
                                return next
                              })
                            }
                            aria-label="Réagir"
                            title="Réagir"
                          >
                            👍
                          </button>
                        </div>

                        <div className="pointer-events-none absolute right-2 top-2 z-10 hidden items-center gap-1 sm:group-hover:flex sm:group-focus-within:flex sm:group-active:flex">
                          <button
                            type="button"
                            data-action="message-action"
                            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white text-[#7c3aed] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => setReplyToId(m.id)}
                            aria-label="Répondre"
                            title="Répondre"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="16"
                              height="16"
                              aria-hidden
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M9 14L4 9l5-5" />
                              <path d="M4 9h10a6 6 0 1 1 0 12H9" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            data-action="message-action"
                            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() =>
                              setReactionsById((prev) => {
                                const next = { ...prev }
                                next[m.id] = next[m.id] ? undefined : '👍'
                                return next
                              })
                            }
                            aria-label="Réagir"
                            title="Réagir"
                          >
                            👍
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>

                  {reaction ? (
                    <div
                      className={
                        isCoach
                          ? 'absolute -bottom-3 right-2 inline-flex h-6 items-center justify-center rounded-full bg-white px-2 text-sm ring-1 ring-black/10'
                          : 'absolute -bottom-3 left-2 inline-flex h-6 items-center justify-center rounded-full bg-white px-2 text-sm ring-1 ring-black/10'
                      }
                    >
                      {reaction}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-sm text-black/60">Aucun message.</div>
        )}
      </div>

      <div
        className={
          fixedComposer
            ? 'fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur'
            : 'sticky bottom-0 z-30 -mx-2 mt-5 bg-white/95 px-2 pb-2 pt-2 md:backdrop-blur'
        }
      >
        <form
          className={['relative flex items-center gap-2', fixedComposer ? 'mx-auto w-full max-w-6xl px-5 sm:px-6' : ''].join(' ')}
          onSubmit={(e) => {
            e.preventDefault()
            const form = e.currentTarget
            const formData = new FormData(form)
            const body = String(formData.get('body') ?? '').trim()
            const replyTo = String(formData.get('reply_to_id') ?? '').trim()
            if (!body) return

            const optimistic: MessageRow = {
              id: `optimistic-${Date.now()}`,
              sender: 'coach',
              body,
              created_at: new Date().toISOString(),
              reply_to_id: replyTo.length > 0 ? replyTo : null,
            }

            setOptimisticMessages((prev) => [...prev, optimistic])
            setReplyToId(null)
            form.reset()

            startTransition(async () => {
              await sendMessageAction(formData)
              router.refresh()
            })
          }}
        >
          <input type="hidden" name="reply_to_id" value={replyToId ?? ''} />
          {replyTo ? (
            <div className="pointer-events-none absolute -top-2 left-0 right-0 z-20 -translate-y-full">
              <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl bg-black/5 px-3 py-1.5 sm:py-2 ring-1 ring-black/10">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold text-[#341c44] sm:text-xs">Réponse</div>
                  <div className="max-w-[240px] truncate text-[11px] font-semibold text-black/60 sm:max-w-none sm:text-xs">
                    {replyTo.body}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                  onClick={() => setReplyToId(null)}
                  aria-label="Annuler la réponse"
                  title="Annuler"
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="relative">
              <input
                name="body"
                placeholder="message"
                className="h-11 w-full rounded-2xl bg-white px-4 pr-12 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 outline-none placeholder:text-black/40"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                aria-label="Message vocal"
                title="Message vocal"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z" />
                  <path d="M19 11a7 7 0 0 1-14 0" />
                  <path d="M12 18v3" />
                  <path d="M8 21h8" />
                </svg>
              </button>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
            aria-label="Envoyer une photo"
            title="Envoyer une photo"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
              <path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            </svg>
          </button>

          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl bg-[#341c44] px-5 text-sm font-extrabold text-white shadow-sm hover:opacity-90"
          >
            envoyer
          </button>
        </form>
      </div>
    </>
  )
}
