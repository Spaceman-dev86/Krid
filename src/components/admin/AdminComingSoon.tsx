import Link from 'next/link'

import { PageTitle, Body, Muted } from '@/src/components/ui'

type Props = {
  title: string
  route: string
  body: string
}

export function AdminComingSoon({ title, route, body }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <PageTitle>{title}</PageTitle>
      <Body className="mt-2 text-[color:var(--muted)]">{body}</Body>
      <p className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-sm text-[color:var(--muted)]">
        Stub V1 — route <code>{route}</code> selon la spec. Prochain build dédié.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-block text-sm font-semibold text-[color:var(--brand)] underline"
      >
        ← Ops
      </Link>
    </main>
  )
}
