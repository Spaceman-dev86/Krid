'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

import { useProgramDocumentStore } from '../../store/program-editor/documentStore'
import { useProgramEditorUiStore } from '../../store/program-editor/uiStore'
import { stopProgramEditorPersistence } from '../../persistence/startProgramEditorPersistence'

type Props = {
  children: ReactNode
  legacyEditorHref: string
  programLabel?: string
}

type State = {
  error: Error | null
}

export default class ProgramEditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ProgramEditorV2] render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm font-semibold text-black/75">
            L&apos;éditeur V2 a rencontré une erreur
            {this.props.programLabel ? ` (${this.props.programLabel})` : ''}.
          </p>
          <p className="max-w-md text-xs text-black/50">{this.state.error.message}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                stopProgramEditorPersistence()
                useProgramEditorUiStore.getState().resetProgramEditorUi()
                useProgramDocumentStore.getState().resetEditor()
                this.setState({ error: null })
                window.location.reload()
              }}
            >
              Recharger
            </button>
            <a
              href={this.props.legacyEditorHref}
              className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold text-black/70 hover:bg-black/5"
            >
              Éditeur legacy
            </a>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
