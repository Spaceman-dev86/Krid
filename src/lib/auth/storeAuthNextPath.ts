export async function storeAuthNextPath(path: string) {
  await fetch('/auth/set-redirect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
}
