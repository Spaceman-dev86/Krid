import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminProgramEditorV2LegacyRouteRedirect({ params }: PageProps) {
  const { id } = await params
  redirect(`/admin/programs/${id}`)
}
