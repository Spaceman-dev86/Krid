'use client'

import { useState } from 'react'

import { updateTrackedLinkShareAction } from '../../app/profile/liens/actions'

async function copyLinkWithText(message: string, url: string) {
  const label = message.trim()
  const plain = label ? `${label}\n\n${url}` : url
  const html = label
    ? `<p>${escapeHtml(label)}</p><p><a href="${url.replace(/"/g, '&quot;')}">${escapeHtml(url)}</a></p>`
    : `<a href="${url.replace(/"/g, '&quot;')}">${escapeHtml(url)}</a>`

  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
      return
    }
  } catch {
    /* fallback */
  }
  await navigator.clipboard.writeText(plain)
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function TrackedLinkShareBlock({
  linkId,
  url,
  shareMessage,
}: {
  linkId: string
  url: string
  shareMessage: string | null
}) {
  const [hint, setHint] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const message = (shareMessage ?? '').trim()
  const shortUrl = url.replace(/^https?:\/\//, '')

  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <code className="max-w-[min(100%,18rem)] truncate rounded-md bg-[var(--accent)] px-2 py-1 font-mono text-[11px] text-[color:var(--muted)]">
          {shortUrl}
        </code>
        <button
          type="button"
          onClick={() =>
            void copyLinkWithText(message, url).then(() => {
              setHint('Copié')
              window.setTimeout(() => setHint(null), 1800)
            })
          }
          className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--brand)] hover:bg-[var(--accent)]"
        >
          Copier lien
        </button>
        {hint ? <span className="text-[11px] font-medium text-emerald-700">{hint}</span> : null}
      </div>

      {editing ? (
        <form action={updateTrackedLinkShareAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="link_id" value={linkId} />
          <input
            name="share_message"
            defaultValue={shareMessage ?? ''}
            placeholder="Texte accompagnant le lien"
            className="min-w-[12rem] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm"
            autoFocus
          />
          <button
            type="submit"
            className="rounded-md bg-[color:var(--brand)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--icon-solid-fg)]"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-[color:var(--muted)]"
          >
            Annuler
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="block max-w-full truncate text-left text-sm text-[color:var(--fg)] hover:text-[color:var(--brand)]"
          title="Modifier le texte"
        >
          <span className="text-[color:var(--muted)]">Texte · </span>
          {message || <span className="italic text-[color:var(--muted)]">ajouter un texte</span>}
        </button>
      )}
    </div>
  )
}
