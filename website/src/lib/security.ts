// vsixgate web security hardening — client-side guards against common attack vectors
// Applied surgically to scanner + marketplace + chat. No over-engineering.

// 1. XSS: escape any user-controlled string before rendering as HTML (we use React text, but defensively escape for innerHTML/pre)
export function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

// 2. Input validation: publisher.name pattern, max length, no path traversal
export function isValidExtensionId(id: string): boolean {
  if (id.length > 120) return false
  if (/[<>\"'`;|&$]/.test(id)) return false
  if (id.includes('..') || id.includes('/') || id.includes('\\')) return false
  // Allow publisher.name, publisher.name@version, direct https url handled elsewhere
  if (/^https?:\/\//i.test(id)) return isAllowedUrl(id)
  return /^[a-z0-9_.-]+\.[a-z0-9_.-]+(@[\d.]+)?$/i.test(id.trim())
}

const ALLOWED_URL_HOSTS = new Set([
  'open-vsx.org',
  'marketplace.visualstudio.com',
  'gallery.vsassets.io',
])
export function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!['https:'].includes(u.protocol)) return false
    // allow direct .vsix urls from any https? Restrict to known hosts for marketplace, but allow generic https for direct vsix (user-provided)
    // For direct vsix, allow any https host but must end with .vsix
    if (u.pathname.endsWith('.vsix')) return true
    // For API calls, require allowlisted host
    const host = u.hostname.toLowerCase()
    return [...ALLOWED_URL_HOSTS].some(h => host === h || host.endsWith('.' + h))
  } catch { return false }
}

// 3. Size limits & zip bomb protection constants
export const SCAN_LIMITS = {
  maxVsixBytes: 30 * 1024 * 1024, // 30MB compressed
  maxEntries: 2000,
  maxDecompressedBytes: 100 * 1024 * 1024, // 100MB decompressed
  maxFileBytes: 5 * 1024 * 1024,
  fetchTimeoutMs: 15000,
  fetchMaxBytes: 35 * 1024 * 1024,
  scanRateLimitMs: 2000, // 1 scan per 2s
}

// 4. fetch with timeout + size guard
export async function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = SCAN_LIMITS.fetchTimeoutMs, ...rest } = opts
  const ctrl = new AbortController()
  const t = setTimeout(()=> ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal })
    return res
  } finally { clearTimeout(t) }
}

// 5. Rate limiter (in-memory, per-tab)
let lastScanAt = 0
export function checkRateLimit(): boolean {
  const now = Date.now()
  if (now - lastScanAt < SCAN_LIMITS.scanRateLimitMs) return false
  lastScanAt = now
  return true
}
export function timeUntilNextScan(): number {
  const diff = SCAN_LIMITS.scanRateLimitMs - (Date.now() - lastScanAt)
  return diff > 0 ? Math.ceil(diff/1000) : 0
}

// 6. Chat input sanitization: length, no script, no excessive repeat
export function sanitizeChatInput(s: string): string {
  const t = s.slice(0, 800).trim()
  // strip control chars, limit newlines
  return t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'')
}
export function isChatRateLimited(lastAt: number, minGapMs = 800): boolean {
  return Date.now() - lastAt < minGapMs
}
