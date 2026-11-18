/** Barre d’état iOS (heure · signal · wifi · batterie) pour mockups / previews. */
export function IosStatusBar({
  light = true,
  className = '',
}: {
  /** Texte clair (sur fond sombre) */
  light?: boolean
  className?: string
}) {
  const fg = light ? 'text-white' : 'text-black'
  return (
    <div
      className={`flex shrink-0 items-center justify-between pl-[3.05rem] pr-[1.75rem] pt-0 pb-0 text-[12px] font-semibold tabular-nums leading-none tracking-[-0.02em] ${fg} ${className}`}
      aria-hidden
    >
      <span>9:41</span>
      {/* Icônes droites : un peu rentrées vers le notch */}
      <div className="flex items-center gap-[4px]">
        {/* Cellular — 4 barres, dernière pleine */}
        <svg viewBox="0 0 17 11" className="h-[9px] w-[14px]" fill="currentColor" aria-hidden>
          <rect x="0" y="7.5" width="2.6" height="3.5" rx="0.4" opacity="0.35" />
          <rect x="4.2" y="5.2" width="2.6" height="5.8" rx="0.4" opacity="0.55" />
          <rect x="8.4" y="2.6" width="2.6" height="8.4" rx="0.4" opacity="0.85" />
          <rect x="12.6" y="0.2" width="2.6" height="10.8" rx="0.4" />
        </svg>
        {/* Wifi */}
        <svg viewBox="0 0 15 11" className="h-[9px] w-[13px]" fill="currentColor" aria-hidden>
          <path d="M7.5 8.55a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3Zm0-3.05c1.4 0 2.68.52 3.66 1.38l-1.08 1.08A3.55 3.55 0 0 0 7.5 7.05c-.84 0-1.6.29-2.22.77L4.2 6.74A5.05 5.05 0 0 1 7.5 5.5Zm0-3.05c2.25 0 4.3.86 5.85 2.28L12.2 5.88A6.75 6.75 0 0 0 7.5 4.1c-1.85 0-3.52.69-4.8 1.84L1.55 4.73A8.35 8.35 0 0 1 7.5 2.45Z" />
        </svg>
        {/* Battery — hauteur ≈ texte 9:41 */}
        <svg viewBox="0 0 25 11" className="h-[10px] w-[22px]" fill="currentColor" aria-hidden>
          <rect
            x="0.4"
            y="0.4"
            width="20.5"
            height="10.2"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            opacity="0.4"
          />
          <rect x="1.8" y="1.9" width="17.5" height="7.2" rx="1.1" />
          <path d="M22.2 3.4v4.2c1.1-.35 1.1-3.85 0-4.2Z" opacity="0.4" />
        </svg>
      </div>
    </div>
  )
}
