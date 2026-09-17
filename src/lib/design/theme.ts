export type AppTheme = 'dark' | 'light'

/** Last / guest theme (kept after logout). */
export const THEME_STORAGE_KEY = 'trainly-theme'
/** Active account id — used by boot script + per-user keys. */
export const THEME_USER_KEY = 'trainly-theme-user'
export const THEME_EVENT = 'trainly-theme-change'

export function userThemeKey(userId: string) {
  return `${THEME_STORAGE_KEY}:${userId}`
}

function normalizeTheme(raw: string | null): AppTheme {
  return raw === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

function emitTheme(theme: AppTheme) {
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
}

/** Effective theme: per-account if bound, else guest. */
export function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'dark'
  const uid = window.localStorage.getItem(THEME_USER_KEY)
  if (uid) {
    const perUser = window.localStorage.getItem(userThemeKey(uid))
    if (perUser === 'light' || perUser === 'dark') return perUser
  }
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
}

export function readGuestTheme(): AppTheme {
  if (typeof window === 'undefined') return 'dark'
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
}

/** Persist theme for guest + active account (if any). */
export function setStoredTheme(theme: AppTheme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  const uid = window.localStorage.getItem(THEME_USER_KEY)
  if (uid) {
    window.localStorage.setItem(userThemeKey(uid), theme)
  }
  applyTheme(theme)
  emitTheme(theme)
}

/**
 * Bind theme to the signed-in account and apply it.
 * First time for a user → product default (dark), not the guest/previous account theme.
 */
export function bindThemeUser(userId: string) {
  window.localStorage.setItem(THEME_USER_KEY, userId)
  const key = userThemeKey(userId)
  let raw = window.localStorage.getItem(key)
  if (raw !== 'light' && raw !== 'dark') {
    raw = 'dark'
    window.localStorage.setItem(key, raw)
  }
  window.localStorage.setItem(THEME_STORAGE_KEY, raw)
  applyTheme(raw)
  emitTheme(raw)
}

/** Unbind account on logout — guest theme (last applied) stays. */
export function clearThemeUser() {
  window.localStorage.removeItem(THEME_USER_KEY)
}
