import type { ReactNode } from 'react'

import { CoachAppShell } from '@/src/components/coach/CoachAppShell'
import { DriveShellClient } from '@/src/components/drive/DriveShellClient'
import { requireCoachAppUser } from '@/src/lib/auth/requireCoachAppUser'
import { loadCoachShellContext } from '@/src/lib/coach/loadCoachShellContext'

/**
 * Shell coach monté une fois pour tout /drive/* — ne se recharge pas à chaque hop dossier.
 */
export default async function DriveLayout({ children }: { children: ReactNode }) {
  const { userId } = await requireCoachAppUser()
  const shell = await loadCoachShellContext(userId)

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Drive"
      savUnread={shell.savUnread} chatUnread={shell.chatUnread}
      notifUnread={shell.notifUnread}
      notifHref={shell.notifHref}
    >
      <DriveShellClient>{children}</DriveShellClient>
    </CoachAppShell>
  )
}
