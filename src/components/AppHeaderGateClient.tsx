'use client'

import { usePathname } from 'next/navigation'

import PublicHeaderClient from './PublicHeaderClient'

export default function AppHeaderGateClient() {
  const pathname = usePathname() || '/'

  void pathname
  return <PublicHeaderClient />
}
