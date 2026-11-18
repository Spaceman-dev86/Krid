import { redirect } from 'next/navigation'

/** Legacy route — Formation vit dans /documentation. */
export default function FormationRedirectPage() {
  redirect('/documentation?folder=formation')
}
