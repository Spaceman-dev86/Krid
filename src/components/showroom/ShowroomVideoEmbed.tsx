import { parseVideoEmbed } from '@/src/lib/prestations/showroomPresentation'

type Props = {
  url: string | null | undefined
  className?: string
  title?: string
}

/** Embed YouTube / Vimeo / MP4 pour showroom coach ou presta. */
export function ShowroomVideoEmbed({ url, className = '', title = 'Vidéo' }: Props) {
  const video = parseVideoEmbed(url)
  if (!video.embedUrl) return null

  if (video.kind === 'youtube' || video.kind === 'vimeo') {
    return (
      <div
        className={`relative aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-[var(--border)] ${className}`}
      >
        <iframe
          src={video.embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    )
  }

  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-[var(--border)] ${className}`}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={video.embedUrl} controls playsInline className="absolute inset-0 h-full w-full object-contain" />
    </div>
  )
}
