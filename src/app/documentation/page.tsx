import { redirect } from 'next/navigation'

import { DocumentationExplorer } from '@/src/components/documentation/DocumentationExplorer'
import { DocQuotaFullBanner } from '@/src/components/documentation/DocQuotaFullBanner'
import { CoachAppShell } from '@/src/components/coach/CoachAppShell'
import { DaBanner, Eyebrow, Muted, PageTitle } from '@/src/components/ui'
import { canAccessCoachApp } from '@/src/lib/auth/roles'
import { loadCoachShellContext } from '@/src/lib/coach/loadCoachShellContext'
import { loadDocumentationCatalog } from '@/src/lib/documentation/loadDocumentation'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; ok?: string; folder?: string; quota?: string; plan?: string }>
    | { error?: string; ok?: string; folder?: string; quota?: string; plan?: string }
}

export default async function DocumentationPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const { folders, itemsByFolderId, error: loadError } = await loadDocumentationCatalog(supabase, {
    publishedOnly: true,
  })

  const quotaFull = q.error === 'quota_full'

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Documentation"
      savUnread={shell.savUnread} chatUnread={shell.chatUnread}
      notifUnread={shell.notifUnread}
      notifHref={shell.notifHref}
    >
      <div className="mx-auto w-full min-w-0 max-w-4xl pb-4 sm:pb-6">
        <Eyebrow>Krid</Eyebrow>
        <PageTitle className="mt-2 text-xl sm:text-2xl md:text-3xl">Documentation</PageTitle>
        <Muted className="mt-2 max-w-2xl text-[12px] leading-relaxed sm:text-[13px] md:text-sm">
          Contenu admin publié · lecture en nouvelle fenêtre · récupération Drive si autorisée · pas de
          téléchargement
        </Muted>

        {quotaFull ? <DocQuotaFullBanner quotaGo={q.quota} plan={q.plan} /> : null}
        {q.error && !quotaFull ? (
          <DaBanner tone="danger" className="mt-4">
            {q.error}
          </DaBanner>
        ) : null}
        {loadError ? (
          <DaBanner tone="warning" className="mt-4">
            Catalogue incomplet — {loadError}
            <span className="mt-1 block text-xs">
              Applique <code>61_documentation_folders.sql</code>.
            </span>
          </DaBanner>
        ) : null}

        <div className="mt-5 sm:mt-6">
          <DocumentationExplorer
            folders={folders}
            itemsByFolderId={itemsByFolderId}
            initialFolderSlug={q.folder ?? null}
          />
        </div>
      </div>
    </CoachAppShell>
  )
}
