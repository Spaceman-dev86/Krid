import { redirect } from 'next/navigation'

import { siteUrl } from '../../lib/urls'

export default function MarketingRedirectPage() {
  redirect(siteUrl('/actu'))
}
