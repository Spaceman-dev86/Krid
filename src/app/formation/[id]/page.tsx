import { redirect } from 'next/navigation'

/** Legacy viewer — lecture via /documentation. */
export default function FormationItemRedirectPage() {
  redirect('/documentation?folder=formation')
}
