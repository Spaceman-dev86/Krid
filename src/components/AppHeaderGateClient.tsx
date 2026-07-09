'use client'

import { Suspense } from 'react'

import PublicHeaderClient from './PublicHeaderClient'

function HeaderFallback() {
  return (
    <header className="fixed left-0 right-0 top-0 z-[60] h-16 bg-transparent">
      <div className="mx-auto flex h-full w-full max-w-none items-center justify-between gap-3 px-6 py-3 sm:px-8 lg:px-12">
        <span className="text-base font-extrabold tracking-tight text-[#341c44]">Trainly</span>
      </div>
    </header>
  )
}

export default function AppHeaderGateClient() {
  return (
    <Suspense fallback={<HeaderFallback />}>
      <PublicHeaderClient />
    </Suspense>
  )
}
