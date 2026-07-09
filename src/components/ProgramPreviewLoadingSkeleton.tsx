import type { ReactNode } from 'react'

function PreviewSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10" role="status" aria-live="polite" aria-label="Chargement de l’aperçu">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#341c44]/15 border-t-[#341c44]" />
      <div className="text-sm font-semibold text-[#341c44]/70">Chargement de l’aperçu…</div>
    </div>
  )
}

function MobilePreviewSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-3 w-16 animate-pulse rounded-full bg-black/10" />
          <div className="mt-2 h-7 w-48 animate-pulse rounded-xl bg-black/10" />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-xl bg-black/10" />
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl bg-gray-50/70 shadow-sm ring-1 ring-gray-200">
        <div className="grid gap-3 px-4 py-3">
          <div className="h-4 w-full animate-pulse rounded-lg bg-black/10" />
          <div className="h-4 w-[75%] animate-pulse rounded-lg bg-black/10" />
        </div>
      </section>

      <div className="mt-6 rounded-2xl bg-white ring-1 ring-black/10">
        <PreviewSpinner />
      </div>
    </main>
  )
}

function DesktopPreviewSkeleton() {
  return (
    <main className="fixed inset-0 z-[9999] hidden bg-black/40 backdrop-blur-sm md:grid md:place-items-center">
      <div className="absolute right-4 top-4 h-12 w-12 animate-pulse rounded-2xl bg-white/90" />
      <PreviewSpinner />
    </main>
  )
}

export default function ProgramPreviewLoadingSkeleton() {
  return (
    <>
      <MobilePreviewSkeleton />
      <DesktopPreviewSkeleton />
    </>
  )
}

export function ProgramPreviewStructureFallback(props: { children?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/80 ring-1 ring-black/5">
      {props.children ?? <PreviewSpinner />}
    </div>
  )
}
