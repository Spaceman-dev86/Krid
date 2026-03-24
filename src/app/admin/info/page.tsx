import Link from 'next/link'

export default function AdminInfoPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Info</h1>
        <Link href="/admin" aria-label="Retour admin" title="Retour admin" style={{ textDecoration: 'none', color: '#111827', fontSize: 20 }}>
          ←
        </Link>
      </div>
      <p style={{ color: '#6b7280', marginTop: 8 }}>Page en construction.</p>
    </main>
  )
}
