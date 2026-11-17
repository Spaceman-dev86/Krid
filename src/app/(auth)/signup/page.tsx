import { Suspense } from 'react'

import LoginClient from '../login/LoginClient'

/** Page auth coach (style Ekklo) — inscription / connexion depuis le site. */
export default function SignupPage() {
  return (
    <Suspense>
      <LoginClient variant="coach" />
    </Suspense>
  )
}
