import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ProgramEditorLegacyUrlRedirect({ params }: PageProps) {
  const { id } = await params
  redirect(`/dashboard/programs/${id}`)
}
