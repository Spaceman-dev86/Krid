import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'
import PublicProgramStructureReadOnlyClient from '../../../components/PublicProgramStructureReadOnlyClient'
import { IconBack } from '../../../components/ui/icons'
import PhoneMockupFrameClient from '../../../components/PhoneMockupFrameClient'
import { fetchProgramPreviewStructure } from '../../../lib/fetchProgramPreviewStructure'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function PublicProgramDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()

  const { data: program } = await supabase
    .from('programs')
    .select('id,coach_id,title,description,goal,level,duration,image_url,is_published,created_at')
    .eq('id', id)
    .maybeSingle()

  const typedProgram = program as unknown as {
    id: string
    coach_id: string
    title: string | null
    description: string | null
    goal: string | null
    level: string | null
    duration: string | null
    image_url: string | null
    is_published: boolean | null
    created_at: string | null
  } | null

  if (!typedProgram || !typedProgram.is_published) {
    redirect('/programme')
  }

  const structure = await fetchProgramPreviewStructure(supabase, id)

  const structureProps = {
    programId: typedProgram.id,
    weeks: structure.weeks,
    sessions: structure.sessions,
    sessionItems: structure.sessionItems,
    sessionBlocks: structure.sessionBlocks,
    blockExercises: structure.blockExercises,
    programExercises: structure.programExercises,
  }

  const mobileContent = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 900,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={typedProgram.title ?? ''}
          >
            {typedProgram.title}
          </h1>
          <div style={{ color: '#6b7280', marginTop: 6 }}>
            Niveau : {typedProgram.level ?? '—'} · Durée : {typedProgram.duration ?? '—'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link
            href="/programme"
            style={{ textDecoration: 'none', color: 'var(--brand)', fontWeight: 700 }}
            aria-label="Retour"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white">
              <IconBack className="text-white" />
            </span>
          </Link>
        </div>
      </div>

      <section style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        {typedProgram.description ? (
          <div>
            <strong>Description</strong>
            <div>{typedProgram.description}</div>
          </div>
        ) : null}

        {typedProgram.goal ? (
          <div>
            <strong>Objectif</strong>
            <div>{typedProgram.goal}</div>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 18 }}>
        <PublicProgramStructureReadOnlyClient {...structureProps} />
      </section>

      <Link
        href="/login"
        style={{
          position: 'fixed',
          left: 16,
          right: 16,
          bottom: 16,
          zIndex: 50,
          display: 'block',
          textAlign: 'center',
          padding: '14px 16px',
          borderRadius: 14,
          border: '1px solid #341c44',
          background: 'linear-gradient(90deg, #d6c4e8, #9b6bb8, #341c44)',
          color: '#ffffff',
          fontWeight: 900,
          textDecoration: 'none',
          maxWidth: 520,
          margin: '0 auto',
          boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        }}
      >
        Accéder à l’app
      </Link>
    </>
  )

  const desktopPhoneContent = (
    <div className="px-3 py-4">
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
        <div className="text-xs font-extrabold text-[var(--brand)]">Programme</div>
        <div className="mt-1 text-lg font-extrabold text-gray-900">{typedProgram.title ?? 'Programme'}</div>
        <div className="mt-1 text-sm font-semibold text-black/50">
          Niveau : {typedProgram.level ?? '—'} · Durée : {typedProgram.duration ?? '—'}
        </div>
        {typedProgram.goal ? <div className="mt-3 text-sm text-gray-800">{typedProgram.goal}</div> : null}
      </div>

      <div className="mt-4">
        <PublicProgramStructureReadOnlyClient {...structureProps} />
      </div>

      <div className="mt-5 flex justify-center">
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#d6c4e8] via-[#9b6bb8] to-[#341c44] px-6 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(52,28,68,0.28)] hover:opacity-95"
        >
          Accéder à l’app
        </Link>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#f5f5f5]">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6">
        <div className="md:hidden" style={{ maxWidth: 900, margin: '0 auto', padding: 0, paddingBottom: 96 }}>
          {mobileContent}
        </div>

        <div className="hidden md:block">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link
              href="/programme"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
            >
              ← Retour
            </Link>
          </div>

          <PhoneMockupFrameClient
            ariaLabel="Programme (aperçu iPhone)"
            viewportStyle={{ top: '7%', bottom: '6.0%', left: '4.7%', right: '4.7%' }}
          >
            {desktopPhoneContent}
          </PhoneMockupFrameClient>
        </div>
      </div>
    </main>
  )
}
