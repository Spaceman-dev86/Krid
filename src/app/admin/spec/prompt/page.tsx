import { promises as fs } from 'fs'
import path from 'path'

import { SpecPromptView } from '@/src/components/spec-workspace/SpecPromptView'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PROMPT_REL = path.join('plans', 'qa', 'program-builder-qa-prompt.md')

async function loadPromptMarkdown(): Promise<string | null> {
  const candidates = [
    path.resolve(process.cwd(), PROMPT_REL),
    path.resolve(process.cwd(), '..', PROMPT_REL),
  ]
  for (const filePath of candidates) {
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch {
      /* try next */
    }
  }
  return null
}

async function latestQaReportHref(): Promise<string | null> {
  const dir = path.resolve(process.cwd(), 'public', 'qa')
  try {
    const files = (await fs.readdir(dir))
      .filter((f) => f.startsWith('program-builder-') && f.endsWith('.html'))
      .sort()
      .reverse()
    return files[0] ? `/qa/${files[0]}` : null
  } catch {
    return null
  }
}

export default async function SpecPromptPage() {
  const [markdown, latestReportHref] = await Promise.all([loadPromptMarkdown(), latestQaReportHref()])

  if (!markdown) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="font-extrabold text-[color:var(--fg)]">Prompt introuvable</p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Attendu : <code>{PROMPT_REL}</code>
        </p>
      </div>
    )
  }

  return (
    <SpecPromptView
      markdown={markdown}
      sourcePath={PROMPT_REL.replace(/\\/g, '/')}
      latestReportHref={latestReportHref}
    />
  )
}
