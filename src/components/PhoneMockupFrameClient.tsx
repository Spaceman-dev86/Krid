'use client'

import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  frameSrc?: string
  frameAlt?: string
  frameClassName?: string
  viewportClassName?: string
  viewportStyle?: React.CSSProperties
  ariaLabel?: string
}

export default function PhoneMockupFrameClient({
  children,
  className,
  frameSrc,
  frameAlt,
  frameClassName,
  viewportClassName,
  viewportStyle,
  ariaLabel,
}: Props) {
  const src = frameSrc ?? '/mockups/iphone-frame.png'
  return (
    <div className={`relative mx-auto w-full max-w-[360px] ${className ?? ''}`.trim()}>
      <div className="relative w-full">
        {/** Mockup en arrière-plan (utile si l’image n’a pas de transparence) */}
        <img
          src={src}
          alt={frameAlt ?? ''}
          className={`pointer-events-none block h-auto w-full select-none ${frameClassName ?? ''}`.trim()}
          draggable={false}
        />

        {/**
         * Fenêtre écran (valeurs calibrées pour la mockup blanche).
         * Ajustables via viewportStyle si tu changes de mockup.
         */}
        <div
          className={`absolute z-10 overflow-hidden rounded-[34px] ${viewportClassName ?? ''}`.trim()}
          style={{
            left: '7.2%',
            right: '7.2%',
            top: '4.0%',
            bottom: '6.0%',
            ...viewportStyle,
          }}
          aria-label={ariaLabel ?? 'Aperçu du programme'}
        >
          <div className="no-scrollbar h-full w-full overflow-y-auto bg-[#f5f5f5]">{children}</div>
        </div>
      </div>
    </div>
  )
}

