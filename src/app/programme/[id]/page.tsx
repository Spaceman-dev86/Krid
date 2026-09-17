import { redirect } from 'next/navigation'

import { siteUrl } from '../../../lib/urls'

type Props = { params: Promise<{ id: string }> | { id: string } }

export default async function MarketingRedirectPage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  redirect(siteUrl(`/programme/${id}`))
}
