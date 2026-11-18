import { revalidatePath } from 'next/cache'

/**
 * Invalide tout le surface branding d’un coach (portail client + mon-app + rendu).
 * Appeler après chaque écriture sur `coach_branding`.
 */
export function revalidateCoachBranding(slug: string | null | undefined, opts?: { prevSlug?: string | null }) {
  const slugs = new Set<string>()
  const cur = slug?.trim()
  const prev = opts?.prevSlug?.trim()
  if (cur) slugs.add(cur)
  if (prev) slugs.add(prev)

  revalidatePath('/home')
  revalidatePath('/profile')
  revalidatePath('/profile/mon-app')
  revalidatePath('/profile/rendu')

  for (const s of slugs) {
    const base = `/c/${s}`
    revalidatePath(base, 'layout')
    revalidatePath(base, 'page')
    revalidatePath(`${base}/home`)
    revalidatePath(`${base}/showroom`)
    revalidatePath(`${base}/install`)
    revalidatePath(`${base}/coach`)
    revalidatePath(`${base}/messages`)
    revalidatePath(`${base}/profil`)
    revalidatePath(`${base}/manifest`)
    revalidatePath(`${base}/pwa-icon`)
    revalidatePath(`/api/c/${s}/branding`)
  }
}
