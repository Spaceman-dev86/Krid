import { NextResponse } from 'next/server'

/** Proxy image distante → blob local (recadrage sans CORS). */
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url')
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'url invalide' }, { status: 400 })
  }

  try {
    const upstream = await fetch(url, { cache: 'no-store' })
    if (!upstream.ok) {
      return NextResponse.json({ error: 'fetch failed' }, { status: 502 })
    }
    const buf = await upstream.arrayBuffer()
    const type = upstream.headers.get('content-type') || 'image/jpeg'
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 502 })
  }
}
