import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LegacyDashboardRecipeNewPage() {
  redirect('/nutrition/recipes/new')
}
