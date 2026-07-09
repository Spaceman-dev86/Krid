'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import AppHeaderGateClient from './AppHeaderGateClient'

function isProgramEditorPath(pathname: string) {
  const p = pathname.split('?')[0] ?? ''
  return /^\/(dashboard|admin)\/programs\/[^/]+$/.test(p)
}

function isPreviewPath(pathname: string) {
  const p = pathname.split('?')[0] ?? ''
  return (
    /^\/(dashboard|admin)\/preview\/[^/]+$/.test(p) ||
    /^\/(dashboard|admin)\/programs\/[^/]+\/preview$/.test(p)
  )
}

function isAdminPath(pathname: string) {
  const p = pathname.split('?')[0] ?? ''
  return p === '/admin' || p.startsWith('/admin/')
}

function isCoachDashboardPath(pathname: string) {
  const p = pathname.split('?')[0] ?? ''
  return p === '/dashboard' || p.startsWith('/dashboard/')
}

export default function AppShellClient({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/'
  const inProgramEditor = isProgramEditorPath(pathname)
  const inAdmin = isAdminPath(pathname)
  const inPreview = isPreviewPath(pathname)
  const inCoachDashboard = isCoachDashboardPath(pathname)

  if (inProgramEditor) {
    return <>{children}</>
  }

  if (inPreview) {
    return (
      <>
        <div className="hidden md:block">
          <AppHeaderGateClient />
        </div>
        <div className="md:pt-16">{children}</div>
      </>
    )
  }

  const shell = (
    <>
      <AppHeaderGateClient />
      <div className="pt-16">{children}</div>
    </>
  )

  if (inAdmin || inCoachDashboard) {
    return <div className="min-h-screen overflow-x-clip bg-[#E8E8E8]">{shell}</div>
  }

  return shell
}

