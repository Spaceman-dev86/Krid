import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Hub programmes → En cours. */
export default function ProgramsIndexPage() {
  redirect('/programs/encours')
}
