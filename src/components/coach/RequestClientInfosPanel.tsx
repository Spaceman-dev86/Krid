'use client'

import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { openDmWithClientAction } from '@/src/app/chat/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, daFieldClass } from '@/src/components/ui'

const SUGGESTIONS = [
  { id: 'base', label: 'Info général' },
  { id: 'adresse', label: 'Adresse' },
  { id: 'dispo', label: 'Disponibilité' },
  { id: 'pro', label: 'Profession' },
  { id: 'urgence', label: 'Contact d’urgence' },
] as const

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="secondary"
      className="inline-flex items-center gap-2 !rounded-lg !px-4 !py-2 text-sm font-bold"
      disabled={disabled || pending}
    >
      {pending ? <FluidSpinner size={12} className="text-[color:var(--fg)]" /> : null}
      {pending ? 'Ouverture…' : 'Envoyer la demande (chat)'}
    </Button>
  )
}

type Props = {
  clientId: string
  profilInfosUrl?: string | null
}

/** Coach choisit des infos particulières → brouillon DM. */
export function RequestClientInfosPanel({ clientId, profilInfosUrl }: Props) {
  const [picked, setPicked] = useState<string[]>(['base'])
  const [custom, setCustom] = useState('')

  const draft = useMemo(() => {
    const lines: string[] = ['Salut 👋 Peux-tu me communiquer :']
    for (const s of SUGGESTIONS) {
      if (picked.includes(s.id)) lines.push(`• ${s.label}`)
    }
    const extra = custom
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    for (const line of extra) {
      lines.push(line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`)
    }
    if (profilInfosUrl) {
      lines.push('', `Tu peux aussi mettre à jour ton profil ici :`, profilInfosUrl)
    } else {
      lines.push('', `Tu peux aussi mettre à jour ton profil (onglet Infos).`)
    }
    return lines.join('\n')
  }, [picked, custom, profilInfosUrl])

  const canSend = picked.length > 0 || custom.trim().length > 0

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <form action={openDmWithClientAction} className="grid gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="draft" value={draft} />

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => {
          const on = picked.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={
                on
                  ? 'rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-bold text-[color:var(--brand-fg)]'
                  : 'rounded-full border border-[var(--border)] bg-[var(--page-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]'
              }
            >
              {s.label}
            </button>
          )
        })}
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-[color:var(--fg)]">Autre (une info par ligne)</span>
        <textarea
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          rows={3}
          placeholder={"ex: Numéro WhatsApp\nex: Compte Instagram"}
          className={daFieldClass}
        />
      </label>

      <details className="rounded-xl border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-[color:var(--muted)]">
          Aperçu du message
        </summary>
        <pre className="mt-2 whitespace-pre-wrap text-xs text-[color:var(--fg)]">{draft}</pre>
      </details>

      <Submit disabled={!canSend} />
    </form>
  )
}
