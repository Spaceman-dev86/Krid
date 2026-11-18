import { daSelectClass } from '@/src/components/ui/DaFeedback'

/**
 * Selects coach / hub — tokens DA (dark + light).
 * Alias de `daSelectClass` pour les imports historiques.
 */
export const selectFieldClass = daSelectClass

/** @deprecated chevron inclus dans selectFieldClass — laisser vide. */
export const selectFieldStyle: Record<string, never> = {}
