'use client'

import { useState } from 'react'

import { Button } from '@/src/components/ui'
import { saveCoachPublicProfileAction } from '../../app/profile/actions'
import { CoachPublicIdentityEditor } from './CoachPublicIdentityEditor'

export function CoachPublicProfileForm({
  primaryColor,
  initial,
}: {
  primaryColor: string
  initial: {
    public_name: string
    tagline: string
    bio: string
    share_message: string
    photo_url: string | null
    cover_url: string | null
  }
}) {
  const [publicName, setPublicName] = useState(initial.public_name)
  const [tagline, setTagline] = useState(initial.tagline)
  const [bio, setBio] = useState(initial.bio)

  return (
    <form action={saveCoachPublicProfileAction} className="grid gap-4">
      <input type="hidden" name="return_to" value="/profile" />
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
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Message de partage</span>
        <textarea
          name="share_message"
          rows={2}
          defaultValue={initial.share_message}
          placeholder="Découvre mon coaching en ligne 💪"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
        <span className="text-[11px] text-[color:var(--muted)]">
          Texte collé avec le lien showroom (WhatsApp / IG / mail)
        </span>
      </label>
      <div>
        <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm">
          Enregistrer le profil
        </Button>
      </div>
    </form>
  )
}