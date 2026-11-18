import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>
}

/** Ancienne URL fiche presta (compta) → Profil public. */
export default async function PaymentsPrestationLegacyRedirect({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(q)) {
    if (typeof value === 'string' && value) qs.set(key, value)
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/profile/prestations/${id}${suffix}`)
}
