import type { CSSProperties } from 'react'

type Props = {
  appName: string
  title?: string | null
  pitch?: string | null
  features?: string[]
  logoUrl?: string | null
  brand: string
  brandFg: string
  className?: string
  compact?: boolean
}

const DEFAULT_PITCH =
  'Tes programmes, bilans et échanges avec ton coach vivent dans cette app. Choisis une offre ci-dessous pour y accéder.'

/** Card showroom : logo centré sur toute la card (texte + points forts ✓). */
export function ShowroomAppCard({
  appName,
  title,
  pitch,
  features = [],
  logoUrl,
  brand,
  brandFg,
  className = '',
  compact = false,
}: Props) {
  const heading = title?.trim() || appName
  const body = pitch?.trim() || DEFAULT_PITCH
  const letter = appName.slice(0, 1).toUpperCase()
  const items = features.map((f) => f.trim()).filter(Boolean).slice(0, 8)

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm ${className}`}
      style={{ ['--brand']: brand, ['--brand-fg']: brandFg } as CSSProperties}
    >
      <div className={`flex items-center gap-3 ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
        <div className="flex shrink-0 items-center self-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className={`rounded-xl object-cover ring-1 ring-[var(--border)] ${
                compact ? 'h-11 w-11' : 'h-14 w-14'
              }`}
            />
          ) : (
            <div
              className={`flex items-center justify-center rounded-xl font-bold ${
                compact ? 'h-11 w-11 text-sm' : 'h-14 w-14 text-lg'
              }`}
              style={{ background: brand, color: brandFg }}
            >
              {letter}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {!compact ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
              L’app
            </p>
          ) : null}
          <h2
            className={`font-extrabold tracking-tight text-[color:var(--fg)] ${
              compact ? 'text-sm' : 'text-lg'
            }`}
          >
            {heading}
          </h2>
          <p
            className={`mt-1 whitespace-pre-wrap leading-relaxed text-[color:var(--muted)] ${
              compact ? 'text-[10px]' : 'text-sm'
            }`}
          >
            {body}
          </p>

          {items.length ? (
            <ul className={compact ? 'mt-2' : 'mt-3'}>
              {items.map((item, i) => (
                <li
                  key={`${item}-${i}`}
                  className={`flex items-start gap-2 ${
                    i > 0 ? 'border-t border-[var(--border)]' : ''
                  } ${compact ? 'py-1.5' : 'py-2.5'}`}
                >
                  <span
                    className={`mt-[1px] shrink-0 font-bold leading-none ${
                      compact ? 'text-[11px]' : 'text-sm'
                    }`}
                    style={{ color: brand }}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span
                    className={`min-w-0 leading-snug text-[color:var(--fg)] ${
                      compact ? 'text-[10px]' : 'text-sm'
                    }`}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  )
}
