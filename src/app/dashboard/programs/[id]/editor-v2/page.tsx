import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

/** Ancienne URL — redirige vers l’éditeur principal. */
export default async function ProgramEditorV2LegacyRouteRedirect({ params }: PageProps) {
  const { id } = await params
  redirect(`/dashboard/programs/${id}`)
}
