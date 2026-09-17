import Link from 'next/link'
import { redirect } from 'next/navigation'

import { resolveClientPortalHome } from '../../../lib/client-portal/context'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function InviteOkPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const portalHome = user ? await resolveClientPortalHome(supabase, user.id) : null

  if (portalHome) {
    redirect(portalHome)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4f8] px-4">
      <div className="max-w-md rounded-2xl border border-black/10 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-extrabold text-[#341c44]">Compte connecté</h1>
        <p className="mt-2 text-sm text-black/55">
          {user?.email
            ? `Connecté avec ${user.email}, mais pas encore lié à un coach.`
            : 'Pas de session active.'}
        </p>
        <p className="mt-2 text-sm text-black/45">
          Rouvre le <strong>lien d’invitation</strong> envoyé par ton coach, crée ton mot de passe, puis
          valide l’invitation — ou rejoins-le via son showroom.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/login/client"
            className="inline-block rounded-lg bg-[#341c44] px-4 py-2 text-sm font-bold text-white"
          >
            Connexion client
          </Link>
        </div>
      </div>
    </main>
  )
}
