import { redirect } from 'next/navigation'

/** Catalogue canonique = Profil public → Prestations. */
export default function PaymentsPrestationsRedirect() {
  redirect('/profile/prestations')
}
