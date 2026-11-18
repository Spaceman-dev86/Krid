import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Entrée hub blocs → Ma biblio coach. */
export default function BlocksIndexPage() {
  redirect('/exercises/blocks/mine')
}
