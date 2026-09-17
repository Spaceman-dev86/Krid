import { redirect } from 'next/navigation'

import { siteUrl } from '../../lib/urls'

/** Marketing page moved to apps/site — redirect. */
export default function MarketingRedirectPage() {
  redirect(siteUrl('/accueil'))
}
