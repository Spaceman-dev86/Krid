import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> | { id: string } }

export default async function LegacyDashboardRecipePage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  redirect(`/nutrition/recipes/${id}`)
}
