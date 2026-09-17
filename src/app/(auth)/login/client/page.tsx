import { Suspense } from 'react'

import ClientLoginClient from './ClientLoginClient'

export default function ClientLoginPage() {
  return (
    <Suspense>
      <ClientLoginClient />
    </Suspense>
  )
}
