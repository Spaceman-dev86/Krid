'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Button, daFieldClass } from '@/src/components/ui'
import { saveCoachPublicProfileAction } from '../../app/profile/actions'
import { CoachPublicIdentityEditor } from './CoachPublicIdentityEditor'

export function CoachPublicProfileForm({
  primaryColor,
  appName,
  initial,
}: {
  primaryColor: string
  appName?: string | null
  initial: {
    public_name: string
    tagline: string
    bio: string
    share_message: string
    photo_url: string | null
    cover_url: string | null
    app_showroom_title: string
    app_showroom_pitch: string
  }
}) {
  const [publicName, setPublicName] = useState(initial.public_name)
  const [tagline, setTagline] = useState(initial.tagline)
  const [bio, setBio] = useState(initial.bio)
  const fallbackApp = appName?.trim() || 'Mon app'

  return (
    <form action={saveCoachPublicProfileAction} className="grid gap-6">
      <input type="hidden" name="return_to" value="/profile" />

      <div className="grid gap-3">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--fg)]">
            Haut de showroom
          </h3>
          <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
            Portrait + nom · visible uniquement sur le showroom (pas dans le portail client)
          </p>
        </div>
        <CoachPublicIdentityEditor
          primaryColor={primaryColor}
          publicName={publicName}
          tagline={tagline}
          bio={bio}
          photoUrl={initial.photo_url}
          coverUrl={initial.cover_url}
          onPublicNameChange={setPublicName}
          onTaglineChange={setTagline}
          onBioChange={setBio}
        />
      </div>

      <div className="grid gap-3 border-t border-[var(--border)] pt-5">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--fg)]">
            Présentation de l’app
          </h3>
          <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
            Card sous le header showroom · le logo et les couleurs restent dans{' '}
            <Link href="/profile/mon-app" className="font-semibold text-[color:var(--brand)] hover:underline">
              Mon app
            </Link>
          </p>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Titre de la card</span>
          <input
            name="app_showroom_title"
            defaultValue={initial.app_showroom_title}
            placeholder={fallbackApp}
            maxLength={80}
            className={daFieldClass}
          />
          <span className="text-[11px] text-[color:var(--muted)]">
            Vide = nom de l’app ({fallbackApp})
          </span>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Texte</span>
          <textarea
            name="app_showroom_pitch"
            rows={3}
            defaultValue={initial.app_showroom_pitch}
            placeholder="Explique que les programmes, bilans et échanges vivent dans ton app…"
            maxLength={600}
            className={daFieldClass}
          />
          <span className="text-[11px] text-[color:var(--muted)]">Max 600 car. · showroom uniquement</span>
        </label>
      </div>

      <label className="grid gap-1 border-t border-[var(--border)] pt-5 text-sm">
        <span className="font-semibold">Message de partage</span>
        <textarea
          name="share_message"
          rows={2}
          defaultValue={initial.share_message}
          placeholder="Découvre mon coaching en ligne 💪"
          className={daFieldClass}
        />
        <span className="text-[11px] text-[color:var(--muted)]">
          Texte collé avec le lien showroom (WhatsApp / IG / mail)
        </span>
      </label>

      <div>
        <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm">
          Enregistrer la présentation
        </Button>
      </div>
    </form>
  )
}
