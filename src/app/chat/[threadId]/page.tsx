import { CoachThreadPanel } from '@/src/components/chat/CoachThreadPanel'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ threadId: string }> | { threadId: string }
  searchParams?:
    | Promise<{ error?: string; draft?: string; ok?: string }>
    | { error?: string; draft?: string; ok?: string }
}

/**
 * Page fil volontairement sans DB : le layout auth + shell suffit.
 * Le contenu charge côté client (cache mémoire + prefetch hover) → switch quasi immédiat.
 */
export default async function CoachChatThreadPage({ params, searchParams }: Props) {
  const { threadId } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})

  return (
    <CoachThreadPanel
      key={threadId}
      threadId={threadId}
      flash={{
        error: q.error,
        draft: q.draft,
        ok: q.ok,
      }}
    />
  )
}
