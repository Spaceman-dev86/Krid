import { ChatLastThreadRedirect } from '@/src/components/chat/ChatLastThreadRedirect'
import { CoachChatEmptyPanel } from '@/src/components/chat/CoachChatWorkspace'
import { requireCoachAppUser } from '@/src/lib/auth/requireCoachAppUser'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Promise<{ error?: string }> | { error?: string }
}

export default async function CoachChatInboxPage({ searchParams }: Props) {
  // Auth déjà via layout — rappel léger pour garder la page protégée si layout change
  await requireCoachAppUser()
  const q = await Promise.resolve(searchParams ?? {})

  return (
    <>
      {q.error ? (
        <p className="shrink-0 border-b border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-xs text-[color:var(--danger)]">
          {q.error}
        </p>
      ) : null}
      <ChatLastThreadRedirect knownThreadIds={[]} disabled={Boolean(q.error)} />
      <CoachChatEmptyPanel />
    </>
  )
}
