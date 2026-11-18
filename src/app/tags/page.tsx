import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Ancienne entrée → hub Exercices · Tags. */
export default function TagsRedirectPage() {
  redirect('/exercises/tags')
}
