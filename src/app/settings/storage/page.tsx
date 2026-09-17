import { redirect } from 'next/navigation'

import {
  PageTitle,
  Muted,
  Eyebrow,
  Button,
  DaBanner,
} from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { SettingsSubnav } from '../../../components/coach/SettingsSubnav'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { chatDb } from '../../../lib/chat/chat'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { formatBytes } from '../../../lib/drive/drive'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

const QUOTA_BY_PLAN: Record<string, number> = {
  starter: 5,
  business: 25,
  scale: 100,
  studio: 500,
}

type BucketKey = 'docs' | 'images' | 'video' | 'other'

function bucketForMime(mime: string | null | undefined): BucketKey {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return 'images'
  if (m.startsWith('video/')) return 'video'
  if (
    m.includes('pdf') ||
    m.includes('word') ||
    m.includes('sheet') ||
    m.includes('text') ||
    m.includes('document')
  ) {
    return 'docs'
  }
  return 'other'
}

const BUCKET_LABEL: Record<BucketKey, string> = {
  docs: 'Documents',
  images: 'Images',
  video: 'Vidéos',
  other: 'Autres',
}

export default async function SettingsStoragePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const tier = (shell.subscription?.plan_tier || 'business').toLowerCase()
  const quotaGo = QUOTA_BY_PLAN[tier] ?? 25
  const quotaBytes = quotaGo * 1024 * 1024 * 1024

  let usedBytes = 0
  let fileCount = 0
  const byBucket: Record<BucketKey, number> = { docs: 0, images: 0, video: 0, other: 0 }

  const db = chatDb(supabase)
  const { data: files } = await db
    .from('drive_files')
    .select('size_bytes, mime_type')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .limit(5000)

  for (const f of files ?? []) {
    const size = Number(f.size_bytes ?? 0)
    usedBytes += size
    fileCount += 1
    byBucket[bucketForMime(f.mime_type)] += size
  }

  const pct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 1000) / 10) : 0
  const warn = pct >= 80
  const full = pct >= 100

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Stockage"
      savUnread={shell.savUnread}
    >
      <div className="mx-auto grid max-w-xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Plateforme</Eyebrow>
            <PageTitle className="mt-2 text-2xl">Stockage</PageTitle>
            <Muted className="mt-1">
              Quota global coach · plan <span className="capitalize">{tier}</span>
            </Muted>
          </div>
          <SettingsSubnav savUnread={shell.savUnread} />
        </div>

        {full ? (
          <DaBanner tone="danger">Quota atteint — les nouveaux uploads Drive seront bloqués une fois le garde-fou branché.</DaBanner>
        ) : warn ? (
          <DaBanner tone="warning">Tu approches de la limite ({pct} %). Archive ou passe sur un plan supérieur.</DaBanner>
        ) : null}

        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <Eyebrow>Usage</Eyebrow>
          <p className="mt-3 text-2xl font-extrabold text-[var(--brand)]">
            {formatBytes(usedBytes)}
            <span className="text-base font-semibold text-[color:var(--muted)]"> / {quotaGo} Go</span>
          </p>
          <Muted className="mt-1 text-xs">
            {fileCount} fichier{fileCount === 1 ? '' : 's'} Drive · {pct} %
          </Muted>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--accent)] ring-1 ring-[var(--border)]">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all"
              style={{ width: `${Math.max(pct, usedBytes > 0 ? 2 : 0)}%` }}
            />
          </div>
          <Muted className="mt-3 text-xs">
            V1 : mesure Drive perso. Chat / médias exos / covers s’ajouteront au même compteur.
          </Muted>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <Eyebrow>Par catégorie (Drive)</Eyebrow>
          <ul className="mt-3 grid gap-2">
            {(Object.keys(BUCKET_LABEL) as BucketKey[]).map((key) => {
              const bytes = byBucket[key]
              const share = usedBytes > 0 ? Math.round((bytes / usedBytes) * 100) : 0
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-[color:var(--fg)]">{BUCKET_LABEL[key]}</span>
                  <span className="text-[color:var(--muted)]">
                    {formatBytes(bytes)}
                    {usedBytes > 0 ? ` · ${share} %` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <Eyebrow>Corbeille</Eyebrow>
          <Muted className="mt-2">
            Restauration J30 (plateforme) — hub corbeille global à brancher. En attendant : soft-delete Drive.
          </Muted>
          <Button href="/drive" variant="secondary" size="sm" className="mt-4">
            Ouvrir le Drive
          </Button>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <Eyebrow>Plafonds par plan</Eyebrow>
          <ul className="mt-3 grid gap-1 text-sm text-[color:var(--fg)]">
            <li>Starter · 5 Go</li>
            <li>Business · 25 Go</li>
            <li>Scale · 100 Go</li>
            <li>Studio · sur devis / 500 Go+</li>
          </ul>
          <Button href="/settings/billing" size="sm" className="mt-4">
            Voir l’abonnement
          </Button>
        </section>
      </div>
    </CoachAppShell>
  )
}
