import { redirect } from 'next/navigation'

/** Création = popup sur le hub brouillons (plus de formulaire plein écran). */
export default function NewProgramRedirectPage() {
  redirect('/programs/brouillon?create=1')
}
