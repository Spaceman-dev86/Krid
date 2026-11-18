import type { ReactNode } from 'react'

import { PageTitle, Muted } from '@/src/components/ui'
import { ProfileChromeActions } from './ProfileChromeActions'
import { ProfileSubnav } from './ProfileSubnav'

/**
 * Chrome hub Profil — même cluster que Clients :
 *   [ titre… ] ………… [ + / actions ] [ Showroom · Prestations · … ]
 */
export function ProfileHubHeader({
  title,
  subtitle,
  actions,
  showChromeActions = true,
  showSubnav = true,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  /** Actions chrome optionnelles — masquable (ex. liste prestations / codes). */
  showChromeActions?: boolean
  /** Masquer la subnav (ex. page Rendu hors onglets). */
  showSubnav?: boolean
}) {
  const hasRightCluster = showChromeActions || showSubnav || Boolean(actions)

  return (
    <header
      className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
      data-builder-chrome
    >
      <div className="min-w-0 sm:flex-1">
        <PageTitle className="text-2xl">{title}</PageTitle>
        {subtitle ? <Muted className="mt-1">{subtitle}</Muted> : null}
      </div>

      {hasRightCluster ? (
        <div className="flex w-full shrink-0 flex-nowrap items-center justify-end gap-2 sm:w-auto">
          {actions ? (
            <div className="flex shrink-0 flex-nowrap items-center gap-2">{actions}</div>
          ) : null}
          {showChromeActions ? <ProfileChromeActions /> : null}
          {showSubnav ? (
            <div className="min-w-0 max-w-[min(100%,28rem)] overflow-x-auto">
              <ProfileSubnav />
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}
