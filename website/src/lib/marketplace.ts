import { fetchWithTimeout, isAllowedUrl, isValidExtensionId, SCAN_LIMITS } from './security'

export type Registry = 'auto' | 'openvsx' | 'marketplace'

export interface FetchProgress {
  stage: string
  registry: string
  url: string
}

export async function searchExtensions(query: string, limit = 8): Promise<Array<{ id: string; displayName: string; publisher: string; name: string; version: string; description: string }>> {
  const q = query.trim().slice(0, 80)
  if (q.length < 2) return []
  // Try Open VSX search — CORS-friendly. Fallback to empty if blocked.
  try {
    const url = `https://open-vsx.org/api/-/search?query=${encodeURIComponent(q)}&category=&size=${limit}&offset=0&includeAllVersions=false`
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' }, timeoutMs: 8000 })
    if (!res.ok) return []
    const data = await res.json()
    const exts = (data.extensions || data.results || []) as any[]
    return exts.slice(0, limit).map((e: any) => ({
      id: `${e.namespace || e.publisher?.name || ''}.${e.name}`,
      displayName: e.displayName || e.name,
      publisher: e.namespace || e.publisher?.name || '',
      name: e.name,
      version: e.version || e.latestVersion || '',
      description: (e.description || '').slice(0, 120),
    })).filter((x: any) => x.publisher && x.name)
  } catch { return [] }
}

export async function fetchVsixBufferById(
  rawId: string,
  opts?: { registry?: Registry; version?: string; onProgress?: (p: FetchProgress) => void }
): Promise<{ buffer: ArrayBuffer; resolvedVersion: string; publisher: string; name: string; downloadUrl: string; registry: string }> {
  const id = rawId.trim().slice(0, 200)
  // Direct URL — validate allowlist + size + timeout
  if (/^https?:\/\//i.test(id)) {
    if (!isAllowedUrl(id) && !id.endsWith('.vsix')) throw new Error('URL not allowed. Only https .vsix URLs or Open VSX/Marketplace are allowed.')
    opts?.onProgress?.({ stage: 'Fetching direct URL', registry: 'direct', url: id })
    const res = await fetchWithTimeout(id)
    if (!res.ok) throw new Error(`Failed to fetch VSIX URL (${res.status} ${res.statusText}) — may be CORS blocked. Try downloading the .vsix manually and drag-drop it.`)
    const len = res.headers.get('content-length')
    if (len && parseInt(len) > SCAN_LIMITS.fetchMaxBytes) throw new Error('Remote file too large')
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 1000) throw new Error('Downloaded file too small — not a valid .vsix')
    if (buf.byteLength > SCAN_LIMITS.fetchMaxBytes) throw new Error('Downloaded file too large')
    return { buffer: buf, resolvedVersion: opts?.version || 'unknown', publisher: 'unknown', name: 'unknown', downloadUrl: id, registry: 'direct' }
  }

  // Marketplace itemName format ?itemName=publisher.name
  let publisher = ''
  let name = ''
  let version = opts?.version

  if (id.includes('itemName=')) {
    const m = id.match(/itemName=([^&]+)/)
    if (m) {
      const decoded = decodeURIComponent(m[1])
      ;[publisher, name] = decoded.split('.')
    }
  } else if (id.includes('.')) {
    const clean = id.split('?')[0].split('/').pop() || id
    const parts = clean.split('.')
    if (parts.length >= 2) {
      publisher = parts[0]
      name = parts.slice(1).join('.')
      // handle version suffix publisher.name@1.2.3 or publisher.name:1.2.3
      if (name.includes('@')) {
        const [n, v] = name.split('@')
        name = n
        version = v
      }
      if (name.includes(':')) {
        const [n, v] = name.split(':')
        name = n
        version = v
      }
    }
  }

  if (!publisher || !name || !isValidExtensionId(`${publisher}.${name}`)) {
    throw new Error(`Invalid extension ID "${id}". Use format publisher.extension (e.g. esbenp.prettier-vscode) or paste a direct .vsix URL.`)
  }
  // sanitize publisher/name: only allow alphanum _ . -
  if (!/^[a-z0-9_.-]+$/i.test(publisher) || !/^[a-z0-9_.-]+$/i.test(name)) {
    throw new Error('Invalid characters in extension ID')
  }

  const registries: Registry[] = opts?.registry && opts.registry !== 'auto' ? [opts.registry] : ['openvsx', 'marketplace']
  let lastError: any = null

  for (const reg of registries) {
    try {
      if (reg === 'openvsx') {
        let resolved = version
        if (!resolved) {
          const metaUrl = `https://open-vsx.org/api/${publisher}/${name}`
          opts?.onProgress?.({ stage: 'Resolving latest version (Open VSX)', registry: 'open-vsx', url: metaUrl })
          const metaRes = await fetchWithTimeout(metaUrl, { headers: { Accept: 'application/json' } })
          if (!metaRes.ok) throw new Error(`Open VSX: extension not found (${metaRes.status})`)
          const meta = await metaRes.json()
          resolved = meta.version || meta.latestVersion || version
          if (!resolved) throw new Error('Open VSX: could not resolve version')
        }
        if (!/^[a-z0-9_.-]+$/i.test(resolved)) throw new Error('Invalid version')
        const dlUrl = `https://open-vsx.org/api/${publisher}/${name}/${resolved}/file/${publisher}.${name}-${resolved}.vsix`
        opts?.onProgress?.({ stage: `Downloading ${resolved} from Open VSX`, registry: 'open-vsx', url: dlUrl })
        const res = await fetchWithTimeout(dlUrl)
        if (!res.ok) throw new Error(`Open VSX download failed (${res.status})`)
        const len = res.headers.get('content-length')
        if (len && parseInt(len) > SCAN_LIMITS.fetchMaxBytes) throw new Error('Remote file too large')
        const buf = await res.arrayBuffer()
        if (buf.byteLength < 1000) throw new Error('Open VSX: downloaded file too small')
        if (buf.byteLength > SCAN_LIMITS.fetchMaxBytes) throw new Error('File too large')
        return { buffer: buf, resolvedVersion: resolved!, publisher, name, downloadUrl: dlUrl, registry: 'open-vsx' }
      }
      if (reg === 'marketplace') {
        let resolved = version
        // try to resolve latest via extensionquery if no version
        if (!resolved) {
          const qUrl = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery'
          opts?.onProgress?.({ stage: 'Resolving latest version (Marketplace)', registry: 'marketplace', url: qUrl })
          try {
            const qRes = await fetchWithTimeout(qUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json;api-version=3.0-preview.1' },
              body: JSON.stringify({
                filters: [{ criteria: [{ filterType: 7, value: `${publisher}.${name}` }], pageNumber: 1, pageSize: 1 }],
                flags: 914,
              }),
            })
            if (qRes.ok) {
              const qData = await qRes.json()
              const ext = qData?.results?.[0]?.extensions?.[0]
              resolved = ext?.versions?.[0]?.version
            }
          } catch {}
          // fallback: if we still don't have version, try latest asset URL without version
          if (!resolved) {
            const latestUrl = `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${name}/latest/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`
            if (!isAllowedUrl(latestUrl)) throw new Error('Marketplace URL not allowed')
            opts?.onProgress?.({ stage: 'Downloading latest from Marketplace (asset URL)', registry: 'marketplace', url: latestUrl })
            const res = await fetchWithTimeout(latestUrl)
            if (res.ok) {
              const buf = await res.arrayBuffer()
              if (buf.byteLength > 1000) return { buffer: buf, resolvedVersion: 'latest', publisher, name, downloadUrl: latestUrl, registry: 'marketplace' }
            }
            throw new Error('Marketplace: could not resolve latest version')
          }
        }
        if (!/^[a-z0-9_.-]+$/i.test(resolved!)) throw new Error('Invalid version')
        const dlUrl = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${publisher}/vsextensions/${name}/${resolved}/vspackage`
        opts?.onProgress?.({ stage: `Downloading ${resolved} from Marketplace`, registry: 'marketplace', url: dlUrl })
        const res = await fetchWithTimeout(dlUrl)
        if (!res.ok) throw new Error(`Marketplace download failed (${res.status}) — may be CORS blocked. Try Open VSX or upload .vsix.`)
        const len = res.headers.get('content-length')
        if (len && parseInt(len) > SCAN_LIMITS.fetchMaxBytes) throw new Error('Remote file too large')
        const buf = await res.arrayBuffer()
        if (buf.byteLength < 1000) throw new Error('Marketplace: downloaded file too small')
        if (buf.byteLength > SCAN_LIMITS.fetchMaxBytes) throw new Error('File too large')
        return { buffer: buf, resolvedVersion: resolved!, publisher, name, downloadUrl: dlUrl, registry: 'marketplace' }
      }
    } catch (e: any) {
      lastError = e
      // continue to next registry if auto
      if (registries.length === 1) throw e
    }
  }
  throw lastError || new Error('Failed to fetch extension from all registries. If CORS blocked, download the .vsix manually and drag-drop it, or use the CLI: vsixgate scan <publisher.extension> --registry vscode')
}

export const POPULAR_EXTENSIONS = [
  { id: 'ms-python.python', label: 'Python', publisher: 'ms-python', icon: '🐍' },
  { id: 'esbenp.prettier-vscode', label: 'Prettier', publisher: 'esbenp', icon: '✨' },
  { id: 'dbaeumer.vscode-eslint', label: 'ESLint', publisher: 'dbaeumer', icon: '🔍' },
  { id: 'ms-vscode.cpptools', label: 'C/C++', publisher: 'ms-vscode', icon: '⚙️' },
  { id: 'bradlc.vscode-tailwindcss', label: 'Tailwind', publisher: 'bradlc', icon: '🎨' },
  { id: 'ritwickdey.LiveServer', label: 'Live Server', publisher: 'ritwickdey', icon: '🌐' },
  { id: 'ms-azuretools.vscode-docker', label: 'Docker', publisher: 'ms-azuretools', icon: '🐳' },
  { id: 'GitHub.copilot', label: 'Copilot', publisher: 'GitHub', icon: '🤖' },
  { id: 'golang.go', label: 'Go', publisher: 'golang', icon: '🐹' },
  { id: 'redhat.java', label: 'Java', publisher: 'redhat', icon: '☕' },
  { id: 'ms-vscode.vscode-typescript-next', label: 'TS Next', publisher: 'ms-vscode', icon: '📘' },
  { id: 'eamodio.gitlens', label: 'GitLens', publisher: 'eamodio', icon: '🔭' },
]
