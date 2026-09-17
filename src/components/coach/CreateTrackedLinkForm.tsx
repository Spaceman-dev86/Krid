'use client'

import { useState } from 'react'

import { Button } from '@/src/components/ui'
import { createTrackedLinkAction } from '../../app/profile/liens/actions'
import { TRACKED_CHANNELS } from '../../lib/tracking/trackedLinks'
import { selectFieldClass, selectFieldStyle } from '../../lib/ui/selectField'

type Presta = { id: string; name: string }

export function CreateTrackedLinkForm({ prestations }: { prestations: Presta[] }) {
  const [targetKind, setTargetKind] = useState<'showroom' | 'prestation'>('showroom')

  return (
    <form action={createTrackedLinkAction} className="mt-4 grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Libellé *</span>
        <input
          name="label"
          required
          placeholder="Ex. Story Instagram mars"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Canal</span>
        <select name="channel" defaultValue="ig" className={selectFieldClass} style={selectFieldStyle}>
          {TRACKED_CHANNELS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Cible</span>
        <select
          name="target_kind"
          value={targetKind}
          onChange={(e) => setTargetKind(e.target.value as 'showroom' | 'prestation')}
          className={selectFieldClass}
          style={selectFieldStyle}
        >
          <option value="showroom">Showroom (liste)</option>
          <option value="prestation">Fiche prestation</option>
        </select>
      </label>

      {targetKind === 'prestation' ? (
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Prestation *</span>
          <select name="prestation_id" required className={selectFieldClass} style={selectFieldStyle}>
            <option value="">Choisir…</option>
            {prestations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Code ?ref= (optionnel)</span>
        <input
          name="code"
          placeholder="Auto si vide · ex. story-mars"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Message d’aperçu (le texte du lien)</span>
        <textarea
          name="share_message"
          rows={3}
          placeholder="Ex. Découvre mon offre coaching 💪"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
        <span className="text-xs text-[color:var(--muted)]">
          URL courte type <code className="font-mono">/c/ton-slug/go/ton-code</code> — WhatsApp
          affiche ce message en aperçu.
        </span>
      </label>

      <label className="inline-flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="capture_leads" className="rounded" />
        Capturer les leads (formulaire volontaire)
      </label>

      <Button type="submit" className="w-fit !rounded-lg !px-4 !py-2 text-sm">
        Créer le lien
      </Button>
    </form>
  )
}
