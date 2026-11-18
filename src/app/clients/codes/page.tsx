import { redirect } from 'next/navigation'

/** Ancien chemin — Codes vit sous /profile/codes. */
export default async function ClientsCodesRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) qs.set(key, value)
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0])
  }
  const q = qs.toString()
  redirect(q ? `/profile/codes?${q}` : '/profile/codes')
}
