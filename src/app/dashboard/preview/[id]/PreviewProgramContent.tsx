import Link from 'next/link'

import PhoneMockupFrameClient from '../../../../components/PhoneMockupFrameClient'
import PublicProgramStructureReadOnlyClient from '../../../../components/PublicProgramStructureReadOnlyClient'
import { fetchProgramPreviewStructure } from '../../../../lib/fetchProgramPreviewStructure'
import { createClient } from '../../../../lib/supabase/server'

export type PreviewProgramRow = {
  id: string
  title: string | null
  description: string | null
  goal: string | null
  level: string | null
  duration: string | null
}

type Props = {
  program: PreviewProgramRow
  backHref: string
}

export default async function PreviewProgramContent({ program, backHref }: Props) {
  const supabase = await createClient()
  const structure = await fetchProgramPreviewStructure(supabase, program.id)

  const structureProps = {
    programId: program.id,
    weeks: structure.weeks,
    sessions: structure.sessions,
    sessionItems: structure.sessionItems,
    sessionBlocks: structure.sessionBlocks,
    blockExercises: structure.blockExercises,
    programExercises: structure.programExercises,
  }

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[var(--brand)]">Aperçu</div>
            <div className="mt-1 truncate text-xl font-extrabold text-gray-900">{program.title ?? 'Programme'}</div>
          </div>
          <Link
            href={backHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-900 ring-1 ring-black/10"
            aria-label="Retour"
            title="Retour"
          >
            <span className="text-lg font-black" aria-hidden>
              ←
            </span>
          </Link>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl bg-gray-50/70 shadow-sm ring-1 ring-gray-200">
          <div className="grid gap-3 px-4 py-3">
            <div className="grid gap-0.5">
              <div className="text-xs font-extrabold text-[var(--brand)]">Description</div>
              <div className="text-sm leading-snug text-gray-800">{program.description ?? ''}</div>
            </div>
            <div className="grid gap-0.5">
              <div className="text-xs font-extrabold text-[var(--brand)]">Objectif</div>
              <div className="text-sm leading-snug text-gray-800">{program.goal ?? ''}</div>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <PublicProgramStructureReadOnlyClient {...structureProps} />
        </div>
      </main>

      <main className="fixed inset-0 z-[9999] hidden bg-black/40 backdrop-blur-sm md:block">
        <Link href={backHref} className="absolute inset-0" aria-label="Retour" title="Retour">
          <span className="sr-only">Retour</span>
        </Link>

        <div className="relative z-10 mx-auto grid h-full w-full max-w-6xl place-items-center px-4 py-4">
          <Link
            href={backHref}
            className="absolute right-4 top-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#341c44] shadow-sm ring-1 ring-black/10 hover:bg-[#f5f5f5]"
            aria-label="Retour"
            title="Retour"
          >
            <span className="text-xl font-black" aria-hidden>
              ←
            </span>
          </Link>

          <div className="w-full">
            <div
              className="mx-auto w-[min(420px,100%)]"
              style={{ transform: 'translateY(18px) scale(0.92)', transformOrigin: 'top center' }}
            >
              <PhoneMockupFrameClient
                ariaLabel="Aperçu du programme (iPhone)"
                viewportStyle={{ top: '7%', bottom: '6.0%', left: '4.7%', right: '4.7%' }}
              >
                <div className="px-3 py-4">
                  <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                    <div className="text-xs font-extrabold text-[var(--brand)]">Programme</div>
                    <div className="mt-1 text-lg font-extrabold text-gray-900">{program.title ?? 'Programme'}</div>
                    <div className="mt-1 text-sm font-semibold text-black/50">
                      Niveau : {program.level ?? '—'} · Durée : {program.duration ?? '—'}
                    </div>
                    {program.goal ? <div className="mt-3 text-sm text-gray-800">{program.goal}</div> : null}
                  </div>

                  <div className="mt-3">
                    <PublicProgramStructureReadOnlyClient {...structureProps} />
                  </div>
                </div>
              </PhoneMockupFrameClient>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
