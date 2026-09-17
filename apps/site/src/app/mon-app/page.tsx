import { appUrl } from '@/lib/urls'
import { Container, ImagePlaceholder, SectionHeading } from '../../components/marketing'
import { Button } from '../../components/ui'
import AppProcessSection from '../../components/marketing/AppProcessSection'
import CoachingToolsTimelineSection from '../../components/marketing/CoachingToolsTimelineSection'
import { createClient } from '../../lib/supabase/server'

function readPublicUrl(data: unknown): string | null {
  return (data as { publicUrl?: string } | null)?.publicUrl ?? null
}

export default async function MonAppPage() {
  const supabase = await createClient()
  const appImageUrl = readPublicUrl(
    supabase.storage.from('home_page').getPublicUrl('2-page_app/app.png').data
  )

  return (
    <main className="bg-white">
      <section>
        <Container className="py-10 md:py-14">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div className="grid gap-6">
              <SectionHeading
                eyebrow="Mon app"
                eyebrowClassName="text-[#341c44]"
                title="Deviens propriétaire de ton app personnalisée"
                subtitle="Choisis tes options et lance ton application au plus vite pour booster ton expérience client."
              />
              <Button href={appUrl("/login")} variant="gradient" className="w-fit">
                Teste l&apos;app gratuitement
              </Button>
            </div>
            {appImageUrl ? (
              <div className="overflow-hidden rounded-[2rem] bg-white ring-1 ring-black/10 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={appImageUrl}
                  alt="Aperçu de l’application de coaching personnalisée"
                  className="h-72 w-full rounded-[2rem] object-cover md:h-96"
                  loading="lazy"
                />
              </div>
            ) : (
              <ImagePlaceholder label="Image placeholder · mockup app / dashboard" className="h-72 rounded-[2rem] md:h-96" />
            )}
          </div>
        </Container>
      </section>

      <CoachingToolsTimelineSection />

      <AppProcessSection />
    </main>
  )
}
