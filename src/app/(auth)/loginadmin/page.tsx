import { Suspense } from 'react'

import LoginClient from '../login/LoginClient'

export default function LoginAdminPage() {
  return (
    <Suspense>
      <LoginClient variant="admin" />
    </Suspense>
  )
}
