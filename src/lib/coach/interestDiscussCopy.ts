export const DEFAULT_INTEREST_DISCUSS_TITLE = 'On reste en contact ?'

export const DEFAULT_INTEREST_DISCUSS_BODY =
  'Laisse-moi tes coordonnées — je te recontacte perso pour voir si mon accompagnement peut coller à ton objectif. Sans engagement, juste pour échanger.'

export function resolveInterestDiscussTitle(raw: string | null | undefined) {
  const t = raw?.trim()
  return t || DEFAULT_INTEREST_DISCUSS_TITLE
}

export function resolveInterestDiscussBody(raw: string | null | undefined) {
  const t = raw?.trim()
  return t || DEFAULT_INTEREST_DISCUSS_BODY
}
