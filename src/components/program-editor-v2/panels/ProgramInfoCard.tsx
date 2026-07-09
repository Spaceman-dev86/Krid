'use client'

import { memo, useState } from 'react'

import { useApplyCommand, useProgramMeta } from '../../../store/program-editor'
import { EDITOR_SECTION_TITLE_CLASS } from '../ui/editorSectionTitle'
import { EDITOR_FIELD_BORDER_CLASS, EDITOR_PANEL_SHADOW_CLASS, EDITOR_TEXT_INPUT_X } from '../ui/editorInputStyles'
import { EDITOR_ICON_GAP } from '../ui/editorIconLayout'
import InlineCommitField from '../ui/InlineCommitField'
import TitleEditButton from '../ui/TitleEditButton'
import {
  handleMultilineTextKeyDown,
  handleSingleLineTextKeyDown,
} from '../ui/textFieldKeyboard'

const LEVELS = ['Débutant', 'Intermédiaire', 'Confirmé'] as const

const INFO_FIELD_CLASS = `rounded-xl bg-white outline-none transition ${EDITOR_FIELD_BORDER_CLASS}`

const INFO_FIELD_LABELS = 'Description / Objectif / Niveau / Durée'

function ProgramInfoCardInner() {
  const program = useProgramMeta()
  const applyCommand = useApplyCommand()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [mobileFieldsOpen, setMobileFieldsOpen] = useState(false)

  const patchMeta = (patch: {
    title?: string
    description?: string | null
    goal?: string | null
    level?: string | null
    duration?: string | null
  }) => {
    if (!program) return
    const hasChange = (
      Object.entries(patch) as [keyof typeof patch, string | null | undefined][]
    ).some(([key, value]) => {
      const current = program[key as keyof typeof program]
      const next = value ?? null
      const curNorm = current == null ? null : String(current).trim() || null
      const nextNorm = next == null ? null : String(next).trim() || null
      return curNorm !== nextNorm
    })
    if (!hasChange) return
    applyCommand({ type: 'program.update', patch })
  }

  if (!program) return null

  const title = String(program.title ?? '').trim() || 'Programme'

  return (
    <section className={`w-full rounded-2xl bg-white p-4 ${EDITOR_PANEL_SHADOW_CLASS}`}>
      {/* Mobile compact — champs masqués jusqu’au clic sur Éditer */}
      {!mobileFieldsOpen ? (
        <div className="flex items-start gap-3 max-[623px]:flex min-[624px]:hidden">
          <div className="min-w-0 flex-1">
            <div className={`truncate ${EDITOR_SECTION_TITLE_CLASS}`}>{title}</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              Ces infos apparaîtront en haut de la page programme.
            </div>
            <div className="mt-1 text-xs font-semibold text-gray-500">{INFO_FIELD_LABELS}</div>
          </div>
          <TitleEditButton
            label="Éditer les infos générales"
            onClick={() => setMobileFieldsOpen(true)}
          />
        </div>
      ) : null}

      {/* Contenu complet — toujours visible desktop ; mobile après ouverture */}
      <div className={mobileFieldsOpen ? 'block' : 'hidden min-[624px]:block'}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isEditingTitle ? (
              <InlineCommitField
                value={title}
                brandBorder
                inputClassName={`${EDITOR_SECTION_TITLE_CLASS} !text-base !font-extrabold`}
                onCommit={(nextTitle) => {
                  patchMeta({ title: nextTitle })
                }}
                onDismiss={() => setIsEditingTitle(false)}
              />
            ) : (
              <div className={`flex min-w-0 items-center ${EDITOR_ICON_GAP}`}>
                <div className={`min-w-0 truncate ${EDITOR_SECTION_TITLE_CLASS}`}>{title}</div>
                <TitleEditButton
                  label="Éditer le nom du programme"
                  onClick={() => setIsEditingTitle(true)}
                />
              </div>
            )}
          </div>
          {mobileFieldsOpen ? (
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 max-[623px]:inline min-[624px]:hidden"
              onClick={() => setMobileFieldsOpen(false)}
            >
              Réduire
            </button>
          ) : null}
        </div>

        <div className="mt-1 text-sm font-semibold text-gray-900">
          Ces infos apparaîtront en haut de la page programme.
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 min-[624px]:grid-cols-2 min-[868px]:grid-cols-4">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-sm font-semibold text-gray-800">Description</span>
            <textarea
              defaultValue={program.description ?? ''}
              key={`desc-${program.description ?? ''}`}
              rows={2}
              className={`${INFO_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} max-w-full py-2 text-sm`}
              onBlur={(e) => patchMeta({ description: e.target.value.trim() || null })}
              onKeyDown={handleMultilineTextKeyDown}
            />
          </label>

          <label className="grid min-w-0 gap-1.5">
            <span className="text-sm font-semibold text-gray-800">Objectif</span>
            <input
              defaultValue={program.goal ?? ''}
              key={`goal-${program.goal ?? ''}`}
              className={`${INFO_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} h-9 max-w-full text-sm`}
              onBlur={(e) => patchMeta({ goal: e.target.value.trim() || null })}
            />
          </label>

          <label className="grid min-w-0 gap-1.5">
            <span className="text-sm font-semibold text-gray-800">Niveau</span>
            <select
              value={program.level ?? ''}
              onChange={(e) => patchMeta({ level: e.target.value || null })}
              className={`${INFO_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} h-9 max-w-full text-sm`}
            >
              <option value="">Sélectionner…</option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-0 gap-1.5">
            <span className="text-sm font-semibold text-gray-800">Durée</span>
            <input
              defaultValue={program.duration ?? ''}
              key={`duration-${program.duration ?? ''}`}
              placeholder="8 semaines"
              className={`${INFO_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} h-9 max-w-full text-sm`}
              onBlur={(e) => patchMeta({ duration: e.target.value.trim() || null })}
              onKeyDown={handleSingleLineTextKeyDown}
            />
          </label>
        </div>
      </div>
    </section>
  )
}

export default memo(ProgramInfoCardInner)
