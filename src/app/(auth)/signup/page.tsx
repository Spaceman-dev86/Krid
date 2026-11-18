import { Suspense } from 'react'

import LoginClient from '../login/LoginClient'

/** Page auth coach (depuis le site) — inscription / connexion, pas de collecte sur le site. */
export default function SignupPage() {
  return (
    <Suspense>
      <LoginClient variant="coach" entry="signup" />
    </Suspense>
  )
}
