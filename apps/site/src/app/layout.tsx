import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'

import SiteHeader from '../components/SiteHeader'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Trainly',
    template: '%s · Trainly',
  },
  description: 'L’app de coaching pour coachs sportifs indépendants.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <Suspense fallback={<div className="h-16" />}>
          <SiteHeader />
        </Suspense>
        <div className="pt-16">{children}</div>
      </body>
    </html>
  )
}
