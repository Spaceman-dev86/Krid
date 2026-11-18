'use client'

/** Barre fine pendant une nav (haut de zone ou bas de top bar). */
export function ShellNavProgress({
  pending,
  edge = 'top',
}: {
  pending: boolean
  edge?: 'top' | 'bottom'
}) {
  if (!pending) return null
  return (
    <div
      className={`shell-nav-progress-track ${
        edge === 'bottom' ? 'shell-nav-progress-track--bottom' : ''
      }`}
      aria-hidden
    >
      <div className="shell-nav-progress-bar" />
    </div>
  )
}
