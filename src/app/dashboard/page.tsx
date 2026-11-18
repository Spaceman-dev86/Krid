import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Legacy coach UI — redirige vers l’app actuelle. */
export default function LegacyDashboardPage() {
  redirect('/home')
}
