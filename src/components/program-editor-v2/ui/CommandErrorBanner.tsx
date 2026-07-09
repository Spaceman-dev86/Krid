'use client'

import { memo } from 'react'

import { useClearCommandError, useCommandError } from '../../../store/program-editor'

function CommandErrorBannerInner() {
  const error = useCommandError()
  const clearCommandError = useClearCommandError()

  if (!error) return null

  return (
    <div
      role="alert"
      className="mx-4 mb-2 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 shadow-sm md:mx-6"
    >
      <div className="min-w-0">
        <div className="font-semibold">Modification impossible</div>
        <div className="mt-0.5 text-red-800/90">{error.message}</div>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-900 hover:bg-red-100"
        onClick={clearCommandError}
      >
        Fermer
      </button>
    </div>
  )
}

export default memo(CommandErrorBannerInner)
