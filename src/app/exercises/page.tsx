import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Entrée hub exercices → Ma biblio coach. */
export default function ExercisesIndexPage() {
  redirect('/exercises/mine')
}
