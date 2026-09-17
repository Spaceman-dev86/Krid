/** Absolute URL helpers for site (.com) vs product app (.app). */

export function appUrl(path = '/'): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  if (!path || path === '/') return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function siteUrl(path = '/'): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001').replace(/\/$/, '')
  if (!path || path === '/') return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
