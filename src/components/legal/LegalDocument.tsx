import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  title: string
  updatedAt: string
  children: ReactNode
}

/** Layout minimal pour pages légales (hors nav produit). */
export default function LegalDocument({ title, updatedAt, children }: Props) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[color:var(--fg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_srgb,var(--brand)_28%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_right,color-mix(in_srgb,var(--brand-mid)_22%,transparent),transparent_50%)]"
      />
      <div className="relative mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/signup?mode=signup&plan=business"
            className="text-sm font-extrabold tracking-tight text-[var(--brand)]"
          >
            Krid
          </Link>
          <Link
            href="/signup?mode=signup&plan=business"
            className="text-sm font-semibold text-[color:var(--muted)] underline-offset-2 hover:text-[var(--brand)] hover:underline"
          >
            Retour à l’inscription
          </Link>
        </div>

        <article className="rounded-[var(--radius-lg)] bg-[var(--surface)] p-6 shadow-da-md ring-1 ring-[var(--border)] sm:p-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand)]">Légal</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[color:var(--fg)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Mis à jour le : {updatedAt}</p>
          <div className="legal-prose mt-8 grid gap-6 text-sm leading-relaxed text-[color:var(--fg)] sm:text-[15px]">
            {children}
          </div>
        </article>

        <p className="mt-8 text-center text-xs text-[color:var(--muted)]">
          © {new Date().getFullYear()} Krid — document accessible sans être mis en avant dans la navigation.
        </p>
      </div>
    </main>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-base font-extrabold tracking-tight text-[var(--brand)] sm:text-lg">{title}</h2>
      <div className="grid gap-3 text-[color:var(--muted)] [&_strong]:font-semibold [&_strong]:text-[color:var(--fg)] [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
