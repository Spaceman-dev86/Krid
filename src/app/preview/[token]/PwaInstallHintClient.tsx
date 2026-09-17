'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstallHintClient() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  if (!deferred || dismissed) return null

  async function handleInstall() {
    if (!deferred || installing) return
    setInstalling(true)
    try {
      await deferred.prompt()
      await deferred.userChoice
    } finally {
      setDeferred(null)
      setInstalling(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[70] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-black/10">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#341c44]">Installer l’app</p>
          <p className="text-xs text-gray-600">Accède plus vite à tes programmes depuis l’écran d’accueil.</p>
        </div>
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installing}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#d6c4e8] via-[#9b6bb8] to-[#341c44] px-3 text-xs font-extrabold text-white transition hover:opacity-95 disabled:opacity-60"
        >
          {installing ? '…' : 'Installer'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 ring-1 ring-black/10 hover:bg-gray-50"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
