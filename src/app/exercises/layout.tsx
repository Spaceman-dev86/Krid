import { redirect } from 'next/navigation'

import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { createClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Layout partagé /exercises/* — sidebar stable. */
export default async function ExercisesSectionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Exercices"
      savUnread={shell.savUnread}
      chatUnread={shell.chatUnread}
      notifUnread={shell.notifUnread}
      notifHref={shell.notifHref}
    >
      {children}
    </CoachAppShell>
  )
}
