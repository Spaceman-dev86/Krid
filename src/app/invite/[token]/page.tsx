import { Suspense } from 'react'

import { InviteRedeemClient } from './InviteRedeemClient'
import { createClient } from '../../../lib/supabase/server'
import { createServiceRoleClient } from '../../../lib/supabase/serviceRole'
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ token: string }> | { token: string }
}

type InviteRow = {
  email: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  coach_id: string
  client_id: string
  clients: { user_id?: string | null } | { user_id?: string | null }[] | null
}

function clientUserId(clients: InviteRow['clients']) {
  if (!clients) return null
  return Array.isArray(clients) ? clients[0]?.user_id ?? null : clients.user_id ?? null
}

export default async function InvitePage({ params }: Props) {
  const { token } = await Promise.resolve(params)
  const supabase = await createClient()
  const admin = createServiceRoleClient()

  let invite: InviteRow | null = null

  const { data: asCoach } = await supabase
    .from('client_invites')
    .select('email, expires_at, accepted_at, revoked_at, coach_id, client_id, clients(user_id)')
    .eq('token', token)
    .maybeSingle()

  if (asCoach) {
    invite = asCoach as InviteRow
  } else if (admin) {
    const { data } = await admin
      .from('client_invites')
      .select('email, expires_at, accepted_at, revoked_at, coach_id, client_id, clients(user_id)')
      .eq('token', token)
      .maybeSingle()
    invite = (data as InviteRow | null) ?? null
  }

  let appName: string | null = null
  if (invite) {
    const reader = admin ?? supabase
    const { data: branding } = await reader
      .from('coach_branding')
      .select('app_name')
      .eq('coach_id', invite.coach_id)
      .maybeSingle()
    appName = branding?.app_name ?? null
  }

  const alreadyLinked = Boolean(invite?.accepted_at || clientUserId(invite?.clients ?? null))
  const expired = !invite
    ? true
    : Boolean(
        invite.revoked_at ||
          invite.accepted_at ||
          new Date(invite.expires_at).getTime() < Date.now()
      )

  return (
    <main className="min-h-screen bg-[#f6f4f8] px-4 py-10">
      <div className="mx-auto max-w-md">
        {!invite ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Invitation introuvable.
          </p>
        ) : (
          <Suspense fallback={<p className="text-sm text-black/55">Chargement…</p>}>
            <InviteRedeemClient
              token={token}
              inviteEmail={invite.email}
              appName={appName}
              alreadyLinked={alreadyLinked}
              expired={expired && !alreadyLinked}
            />
          </Suspense>
        )}
      </div>
    </main>
  )
}
