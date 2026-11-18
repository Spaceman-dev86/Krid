import { ClientMessagesInbox } from '../../../../components/chat/ClientMessagesInbox'
import { ClientPortalShell } from '../../../../components/client-portal/ClientPortalShell'
import { portalShellProps, requireClientPortal } from '../../../../lib/client-portal/context'
import { listClientInbox, loadCoachDisplayName } from '../../../../lib/chat/chat'
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

  const coachName = await loadCoachDisplayName(supabase, ctx.coachId)

  let inbox: Awaited<ReturnType<typeof listClientInbox>> = []
  let inboxError: string | null = null
  try {
    inbox = await listClientInbox(supabase, ctx.client.id, user!.id, coachName)
  } catch (e) {
    inboxError = e instanceof Error ? e.message : 'Erreur chargement messages'
  }

  return (
    <ClientPortalShell {...portalShellProps(ctx)} chatLayout>
      {inboxError ? (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {inboxError}
        </div>
      ) : null}

      <ClientMessagesInbox
        slug={ctx.slug}
        primaryColor={ctx.primaryColor}
        secondaryColor={ctx.secondaryColor}
        coachName={coachName}
        inbox={inbox}
        startCoachDmAction={startCoachDmAction}
      />
    </ClientPortalShell>
  )
}
