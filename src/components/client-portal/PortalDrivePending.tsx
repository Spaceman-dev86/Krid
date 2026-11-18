'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

const Ctx = createContext<{ setPending: (v: boolean) => void } | null>(null)

/** Mini pending sur hops ?folder= du Drive portail. */
export function PortalDrivePending({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const search = useSearchParams()
  const [pending, setPending] = useState(false)
  const key = `${pathname}?${search?.toString() ?? ''}`

  useEffect(() => {
    setPending(false)
  }, [key])

  return (
    <Ctx.Provider value={{ setPending }}>
      <div className="relative" aria-busy={pending || undefined}>
        {pending ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded bg-black/10">
            <div className="h-full w-1/3 animate-pulse bg-black/35" />
          </div>
        ) : null}
        {children}
      </div>
    </Ctx.Provider>
  )
}

export function PortalDriveLink({
  href,
  className,
  style,
  children,
}: {
  href: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const ctx = useContext(Ctx)
  return (
    <Link href={href} className={className} style={style} onClick={() => ctx?.setPending(true)}>
      {children}
    </Link>
  )
}
