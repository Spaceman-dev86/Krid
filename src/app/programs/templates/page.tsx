import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import {
  CoachQueryFlash,
  PROGRAMS_OMIT_SUCCESS_FLASH,
} from '@/src/components/coach/CoachQueryFlash'
import { ProgramsHubHeader } from '@/src/components/programs/ProgramsHubHeader'
import { ProgramsTemplatesList } from '@/src/components/programs/ProgramsTemplatesList'
import { ProgramsZoneBar } from '@/src/components/programs/ProgramsZoneBar'
import {
  loadProgramsSendOptions,
  loadProgramsTemplates,
} from '@/src/lib/programs/loadProgramsHub'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProgramsTemplatesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let rows: Awaited<ReturnType<typeof loadProgramsTemplates>> = []
  let sendClients: Awaited<ReturnType<typeof loadProgramsSendOptions>>['clients'] = []
  let sendGroups: Awaited<ReturnType<typeof loadProgramsSendOptions>>['groups'] = []
  let sendPrestas: Awaited<ReturnType<typeof loadProgramsSendOptions>>['prestas'] = []
  let loadError: string | null = null
  try {
    ;[rows, { clients: sendClients, groups: sendGroups, prestas: sendPrestas }] =
      await Promise.all([
        loadProgramsTemplates(supabase, user.id),
        loadProgramsSendOptions(supabase, user.id),
      ])
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
      <Suspense fallback={null}>
        <CoachQueryFlash omitKeys={PROGRAMS_OMIT_SUCCESS_FLASH} />
      </Suspense>
      <ProgramsHubHeader
        title="Programmes"
        subtitle={`${rows.length} template${rows.length === 1 ? '' : 's'} · duplique pour personnaliser`}
      />
      <ProgramsZoneBar kind="programs" basePath="/programs/templates" />
      {loadError ? (
        <p className="text-sm text-[color:var(--muted)]">{loadError}</p>
      ) : (
        <ProgramsTemplatesList
          rows={rows}
          sendClients={sendClients}
          sendGroups={sendGroups}
          sendPrestas={sendPrestas}
        />
      )}
    </div>
  )
}
