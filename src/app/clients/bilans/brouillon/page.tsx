import { redirect } from 'next/navigation'

type Props = {
  searchParams?: Promise<{ id?: string }> | { id?: string }
}

/** Ancienne URL → onglet Brouillons du hub. */
export default async function BilansBrouillonRedirect({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const draft = q.id ? `&draft=${encodeURIComponent(q.id)}` : ''
  redirect(`/clients/bilans?tab=brouillon${draft}`)
}
