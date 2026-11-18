import type { ReactNode } from 'react'

import { CoachChatWorkspace } from '@/src/components/chat/CoachChatWorkspace'
import { CoachAppShell } from '@/src/components/coach/CoachAppShell'
import { requireCoachAppUser } from '@/src/lib/auth/requireCoachAppUser'
import { countCoachChatUnread } from '@/src/lib/chat/chat'
import { loadCoachShellContext } from '@/src/lib/coach/loadCoachShellContext'

export const dynamic = 'force-dynamic'

/**
 * Layout chat volontairement léger : pas d’inbox / clients / groupes ici.
 * Ces données bootent une fois côté client et survivent aux switches de fil —
 * sinon chaque Link /chat/[id] re-bloquait 1–3s sur le SSR layout.
 */
export default async function CoachChatLayout({ children }: { children: ReactNode }) {
  const { supabase, userId } = await requireCoachAppUser()
  const [shell, chatUnread] = await Promise.all([
    loadCoachShellContext(userId, { light: true }),
    countCoachChatUnread(supabase, userId, userId).catch(() => 0),
  ])

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Chat"
      savUnread={shell.savUnread}
      chatUnread={chatUnread}
      notifUnread={shell.notifUnread}
      notifHref={shell.notifHref}
    >
      <CoachChatWorkspace>{children}</CoachChatWorkspace>
    </CoachAppShell>
  )
}
