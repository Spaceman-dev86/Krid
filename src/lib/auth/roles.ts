/** Shared role helpers — DB may still have legacy `admin` alongside `platform_admin`.
 * Un seul compte peut être platform_admin et utiliser l’app coach (canAccessCoachApp).
 * Entrées : /loginadmin → admin · /login → /home.
 */

export type ProfileRole = 'coach' | 'client' | 'platform_admin' | 'admin' | string

export function isPlatformAdmin(role: ProfileRole | null | undefined): boolean {
  return role === 'platform_admin' || role === 'admin'
}

export function isCoach(role: ProfileRole | null | undefined): boolean {
  return role === 'coach'
}

export function canAccessCoachApp(role: ProfileRole | null | undefined): boolean {
  return isCoach(role) || isPlatformAdmin(role)
}
