import { notFound } from 'next/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminTemplateDetailPage({ params }: PageProps) {
  void params
  notFound()
}
