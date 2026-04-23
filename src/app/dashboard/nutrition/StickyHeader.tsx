'use client'

import { type ReactNode, useEffect, useState } from 'react'

type StickyHeaderProps = {
  children: ReactNode
  className?: string
}

export default function StickyHeader(props: StickyHeaderProps) {
  const { children, className } = props
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={'relative ' + (className ?? '')}>
      {children}
      {scrolled ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-black/10 shadow-[0_10px_14px_-10px_rgba(0,0,0,0.35)]" />
      ) : null}
    </div>
  )
}
