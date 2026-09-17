import Link from 'next/link'

type Props = {
  kind: 'expired' | 'revoked' | 'invalid'
}

const COPY: Record<Props['kind'], { title: string; detail: string }> = {
  expired: {
    title: 'Lien expiré',
    detail: 'Ce lien d’aperçu n’est plus valide. Demande un nouvel envoi au coach.',
  },
  revoked: {
    title: 'Lien révoqué',
    detail: 'Ce lien d’aperçu a été désactivé. Demande un nouvel envoi au coach.',
  },
  invalid: {
    title: 'Lien invalide',
    detail: 'Ce lien d’aperçu est introuvable ou incorrect.',
  },
}

export default function SharePreviewStatus({ kind }: Props) {
  const { title, detail } = COPY[kind]

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rounded-2xl bg-white px-8 py-10 shadow-sm ring-1 ring-black/10">
        <h1 className="text-2xl font-extrabold text-[#341c44]">{title}</h1>
        <p className="mt-3 text-sm text-gray-600">{detail}</p>
        <Link
          href="/programs"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#d6c4e8] via-[#9b6bb8] to-[#341c44] px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(52,28,68,0.2)] transition hover:opacity-95"
        >
          Voir les programmes
        </Link>
      </div>
    </main>
  )
}
