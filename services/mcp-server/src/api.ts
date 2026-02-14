const API_BASE = process.env.NEXUS_API_URL || 'http://nexus-api:4000'

export async function nexusApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`)
  return res.json() as Promise<T>
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes}B`
  if (bytes < 1024**2)    return `${(bytes/1024).toFixed(1)}KB`
  if (bytes < 1024**3)    return `${(bytes/1024**2).toFixed(1)}MB`
  return `${(bytes/1024**3).toFixed(2)}GB`
}
