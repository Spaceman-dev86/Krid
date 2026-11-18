'use client'

/** QR léger (API publique) pour tester l’install PWA sur téléphone. */
export function InstallQrCard({ installUrl }: { installUrl: string }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(installUrl)}`

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--accent)]/30 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrSrc}
        alt="QR lien d’installation"
        width={112}
        height={112}
        className="rounded-lg bg-white p-1 shadow-da-sm"
      />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-[color:var(--fg)]">Scanner pour installer</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--muted)]">
          Ouvre le lien d’install sur ton iPhone / Android pour tester « Ajouter à l’écran
          d’accueil ».
        </p>
      </div>
    </div>
  )
}
