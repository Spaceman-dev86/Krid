import SharePreviewStatus from './SharePreviewStatus'

type PageProps = {
  params: Promise<{ token: string }>
}

/** Ancien partage public programme — table retirée ; affiche un état invalide. */
export default async function PublicSharePreviewPage({ params }: PageProps) {
  await params
  return <SharePreviewStatus kind="invalid" />
}
