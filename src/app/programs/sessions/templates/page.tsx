import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Ancien libellé Templates → Ma biblio. */
export default function SessionTemplatesRedirectPage() {
  redirect('/programs/sessions/mine')
}
