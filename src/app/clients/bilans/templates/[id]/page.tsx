import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageTitle } from '@/src/components/ui'
import { BilanTemplateForm } from '../../../../../components/bilans/BilanTemplateForm'
import { ClientsSubnav } from '../../../../../components/coach/ClientsSubnav'
import { CoachAppShell } from '../../../../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../../../../lib/auth/roles'
import { getTemplate } from '../../../../../lib/bilans/bilans'
import { loadCoachShellContext } from '../../../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../../../lib/supabase/server'
import { updateTemplateAction } from '../../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?: Promise<{ error?: string }> | { error?: string }
}

export default async function EditBilanTemplatePage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const template = await getTemplate(supabase, id)
  if (!template || template.coach_id !== user.id) {
    redirect('/clients/bilans?tab=templates&error=' + encodeURIComponent('Template introuvable'))
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Template" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/clients/bilans?tab=templates" className="text-sm font-semibold text-[color:var(--brand)]">
              ← Templates
            </Link>
            <PageTitle className="mt-2 text-2xl">Modifier le template</PageTitle>
            <p className="mt-1 text-sm text-[color:var(--muted)]">N’impacte que les prochains envois.</p>
          </div>
          <ClientsSubnav />
        </div>

        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{q.error}</div>
        ) : null}

        <BilanTemplateForm
          action={updateTemplateAction}
          templateId={template.id}
          initial={{
            title: template.title,
            instructions: template.instructions,
            schema: template.schema,
          }}
          submitLabel="Enregistrer"
        />
      </div>
    </CoachAppShell>
  )
}
