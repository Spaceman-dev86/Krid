'use client'

import { useState } from 'react'

import { Button, Eyebrow, Muted, PageTitle } from '@/src/components/ui'

type Props = {
  markdown: string
  sourcePath: string
  latestReportHref: string | null
}

export function SpecPromptView({ markdown, sourcePath, latestReportHref }: Props) {
  const [copied, setCopied] = useState(false)

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <Eyebrow>Spec · QA</Eyebrow>
      <PageTitle className="mt-2 text-2xl md:text-3xl">Prompt Program Builder</PageTitle>
      <Muted className="mt-2 text-sm">
        Source : <code className="text-[12px]">{sourcePath}</code> · à coller dans Cursor (skill playwright-cli)
      </Muted>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void copyPrompt()}>
          {copied ? 'Copié' : 'Copier le prompt'}
        </Button>
        {latestReportHref ? (
          <Button href={latestReportHref} variant="secondary" size="sm">
            Dernier rapport HTML
          </Button>
        ) : null}
        <Button href="/admin/spec/admin" variant="secondary" size="sm">
          Spec Admin
        </Button>
      </div>

      <pre className="da-scrollbar mt-6 max-h-[min(70vh,900px)] overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-[12px] leading-relaxed text-[color:var(--fg)] shadow-da-sm md:text-[13px]">
        {markdown}
      </pre>
    </div>
  )
}
