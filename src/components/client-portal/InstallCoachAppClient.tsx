'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function InstallCoachAppClient({
  slug,
  appName,
  logoUrl,
  primaryColor,
  canEnterPortal,
}: {
  slug: string
  appName: string
  logoUrl: string | null
  primaryColor: string
  canEnterPortal: boolean
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [ios, setIos] = useState(false)
  const brand = primaryColor || '#341c44'

  useEffect(() => {
    setIos(isIos())
    setInstalled(isStandalone())

    // SW requis pour beforeinstallprompt (Chrome/Android)
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/coach-sw.js').catch(() => {})
    }

    function onBeforeInstall(event: Event) {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f6f4f8] px-4 py-10 text-[#1a1220]">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-20 w-20 rounded-[22px] object-cover shadow-md" />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-[22px] text-2xl font-bold text-white shadow-md"
              style={{ background: brand }}
            >
              {appName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">
            Installation
          </p>
          <h1 className="mt-1 text-xl font-extrabold" style={{ color: brand }}>
            {appName}
          </h1>
          <p className="mt-2 text-sm text-black/55">
            {installed
              ? 'L’app est déjà sur ton écran d’accueil.'
              : ios
                ? 'Sur iPhone, l’installation se fait via le menu Partager de Safari (pas de téléchargement App Store).'
                : 'Ajoute l’app à ton écran d’accueil pour un accès rapide (PWA).'}
          </p>
        </div>

        {installed ? (
          <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-900">
            App déjà installée sur cet appareil.
          </p>
        ) : null}

        {!installed && deferred ? (
          <button
            type="button"
            onClick={() => void handleInstall()}
            disabled={installing}
            className="mt-5 w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: brand }}
          >
            {installing ? '…' : 'Ajouter à l’écran d’accueil'}
          </button>
        ) : null}

        {!installed && !deferred && ios ? (
          <div className="mt-5 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-left text-sm text-black/65">
            <p className="font-semibold" style={{ color: brand }}>
              Sur iPhone / iPad (Safari)
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed">
              <li>Appuie sur le bouton Partager (carré avec flèche)</li>
              <li>Choisis « Sur l’écran d’accueil »</li>
              <li>Valide « Ajouter »</li>
            </ol>
            <p className="mt-3 text-xs text-black/45">
              Ensuite ouvre l’icône {appName} depuis l’écran d’accueil — ce n’est pas le bouton
              ci-dessous.
            </p>
          </div>
        ) : null}

        {!installed && !deferred && !ios ? (
          <p className="mt-5 text-center text-xs text-black/45">
            Si le bouton n’apparaît pas, ouvre cette page dans Chrome (Android) ou utilise le menu
            navigateur « Installer l’application ».
          </p>
        ) : null}

        <div className="mt-5 grid gap-2">
          {canEnterPortal ? (
            installed ? (
              <Link
                href={`/c/${slug}/home`}
                className="rounded-xl py-3 text-center text-sm font-bold text-white"
                style={{ background: brand }}
              >
                Ouvrir mon espace
              </Link>
            ) : (
              <Link
                href={`/c/${slug}/home`}
                className="rounded-xl border border-black/15 py-3 text-center text-sm font-semibold text-black/65"
              >
                Continuer dans le navigateur
              </Link>
            )
          ) : (
            <Link
              href={`/c/${slug}/showroom`}
              className="rounded-xl border border-black/15 py-3 text-center text-sm font-semibold text-black/65"
            >
              Voir le showroom
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
