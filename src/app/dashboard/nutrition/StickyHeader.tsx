'use client'

import { type ReactNode, useEffect, useState } from 'react'

type StickyHeaderProps = {
  children: ReactNode
  className?: string
  /** Fond gris opaque pleine largeur — pages nutrition (suivi + recettes). */
  opaquePageBackdrop?: boolean
}

/** Fond pleine largeur via pseudo-élément (n'élargit pas le flux du layout). */
const opaqueBackdropBefore =
  "before:pointer-events-none before:absolute before:left-[calc(50%-50dvw)] before:top-0 before:-z-10 before:w-[100dvw] before:max-w-[100dvw] before:bg-[#E8E8E8] before:content-['']"

export default function StickyHeader(props: StickyHeaderProps) {
  const { children, className, opaquePageBackdrop = false } = props
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const bleedBottom = scrolled ? 'before:-bottom-5' : 'before:bottom-0'

  const opaqueBackdrop = opaquePageBackdrop
    ? [
        'isolate z-50 min-w-0',
        opaqueBackdropBefore,
        bleedBottom,
        scrolled
          ? "after:pointer-events-none after:absolute after:left-[calc(50%-50dvw)] after:top-full after:h-5 after:w-[100dvw] after:max-w-[100dvw] after:bg-[#E8E8E8] after:content-['']"
          : '',
        scrolled ? 'border-b border-black/10 shadow-[0_10px_16px_-8px_#E8E8E8]' : '',
      ]
    : []

  const simpleScrollLine =
    !opaquePageBackdrop && scrolled
      ? 'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-black/10 after:shadow-[0_10px_14px_-10px_rgba(0,0,0,0.35)]'
      : ''

  return (
    <div
      className={[
        'relative sticky top-16 min-w-0 py-4',
        opaquePageBackdrop ? '' : 'z-40',
        ...opaqueBackdrop,
        simpleScrollLine,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
