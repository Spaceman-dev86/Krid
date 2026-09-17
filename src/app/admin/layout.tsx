import { AdminAppShell } from '../../components/admin/AdminAppShell'
import { countAdminUnreadSav } from '../../lib/admin/savUnread'
import { requirePlatformAdmin } from '../../lib/auth/requirePlatformAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, supabase } = await requirePlatformAdmin()
  const savBadge = await countAdminUnreadSav(supabase)

  return (
    <AdminAppShell email={profile.email} savBadge={savBadge}>
      {children}
    </AdminAppShell>
  )
}
