import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

/** Notifs groupe hors V1 — redirige vers Infos. */
export default async function GroupNotifRedirect({ params }: Props) {
  const { id } = await Promise.resolve(params)
  redirect(`/clients/groupes/${id}`)
}
