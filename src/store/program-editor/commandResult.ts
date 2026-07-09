import { DomainError } from '../../domain/program-editor'

export type CommandError = {
  code: string
  message: string
  at: number
}

export type CommandResult =
  | { ok: true }
  | { ok: false; error: CommandError }

export function normalizeCommandError(err: unknown): CommandError {
  if (err instanceof DomainError) {
    return { code: err.code, message: err.message, at: Date.now() }
  }
  if (err instanceof Error) {
    return { code: 'command.unknown', message: err.message, at: Date.now() }
  }
  return { code: 'command.unknown', message: 'Une erreur est survenue.', at: Date.now() }
}
