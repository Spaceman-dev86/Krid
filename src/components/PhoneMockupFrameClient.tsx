'use client'

import type { CSSProperties, ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  frameSrc?: string
  frameAlt?: string
  frameClassName?: string
  viewportClassName?: string
  viewportStyle?: CSSProperties
  ariaLabel?: string
  /**
   * true = contenu derrière le cadre (cadre au-dessus, écran transparent du PNG/SVG).
   * false = cadre en fond (comportement historique).
   */
  frameOnTop?: boolean
  /** false = le parent ne scroll pas (le child gère sticky / scroll interne). */
  scrollable?: boolean
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
  frameOnTop = false,
  scrollable = true,
}: Props) {
  const src = frameSrc ?? '/mockups/iphone-frame.png'
  const transparentBg = Boolean(viewportClassName?.includes('bg-transparent') || frameOnTop)

  const viewport = (
    <div
      className={`absolute overflow-hidden rounded-[34px] ${frameOnTop ? 'z-0' : 'z-0'} ${viewportClassName ?? ''}`.trim()}
      style={{
        left: '7.2%',
        right: '7.2%',
        top: '4.0%',
        bottom: '6.0%',
        ...viewportStyle,
      }}
      aria-label={ariaLabel ?? 'Aperçu du programme'}
    >
      <div
        className={`no-scrollbar h-full w-full ${
          scrollable ? 'overflow-y-auto' : 'overflow-hidden'
        } ${transparentBg ? 'bg-transparent' : 'bg-[#f5f5f5]'}`}
      >
        {children}
      </div>
    </div>
  )

  const frame = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={frameAlt ?? ''}
      className={`pointer-events-none block h-auto w-full select-none ${
        frameOnTop ? 'relative z-10' : ''
      } ${frameClassName ?? ''}`.trim()}
      draggable={false}
    />
  )

  return (
    <div className={`relative mx-auto w-full max-w-[360px] ${className ?? ''}`.trim()}>
      <div className="relative w-full">
        {frameOnTop ? (
          <>
            {viewport}
            {frame}
          </>
        ) : (
          <>
            {frame}
            {viewport}
          </>
        )}
      </div>
    </div>
  )
}
