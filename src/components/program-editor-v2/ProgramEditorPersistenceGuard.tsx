'use client'

import { useEffect } from 'react'

import {
  flushProgramEditorPersistence,
  hasPendingProgramEditorPersistence,
} from '../../persistence/startProgramEditorPersistence'

/** Warns on tab close and flushes on page hide when edits are pending. */
export default function ProgramEditorPersistenceGuard() {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingProgramEditorPersistence()) return
      event.preventDefault()
      event.returnValue = ''
    }

    const onPageHide = () => {
      if (!hasPendingProgramEditorPersistence()) return
      void flushProgramEditorPersistence()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return
      if (!hasPendingProgramEditorPersistence()) return
      void flushProgramEditorPersistence()
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
