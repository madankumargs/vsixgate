import { Link, NavLink } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import AuthModal from './AuthModal'

const GITHUB_URL = 'https://github.com/madankumargs/vsixgate'

function MorePopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="absolute right-0 top-[44px] w-[640px] max-w-[92vw] rounded-2xl border bg-white shadow-xl overflow-hidden z-50">
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
        <div className="p-5">
          <div className="text-xs tracking-widest font-bold text-ink-400">DETAILED REPORT</div>
          <h4 className="mt-1 font-display font-bold">Export anywhere your CI lives</h4>
          <p className="mt-1 text-sm text-ink-600">Text for humans, <b>JSON</b> for tooling, <b>SARIF 2.1.0</b> for PR annotations. Same Finding contract — rule, severity, location, redFlag.</p>
          <div className="mt-3 rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-xs">
            vsixgate scan ./ext.vsix --format sarif --out results.sarif<br/>
            vsixgate scan ./ext.vsix --format json | jq .scoring
          </div>
          <Link to="/scan" onClick={onClose} className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:underline">Try in browser →</Link>
        </div>
        <div className="p-5 bg-amber-50/50">
          <div className="text-xs tracking-widest font-bold text-amber-700">CLI TOOL</div>
          <h4 className="mt-1 font-display font-bold">Zero-config gate, exit codes that CI understands</h4>
          <ul className="mt-2 text-sm text-ink-600 list-disc pl-4 space-y-1">
            <li><code className="bg-white px-1 rounded border">0 PASS</code> <code className="bg-white px-1 rounded border">1 WARN</code> <code className="bg-white px-1 rounded border">2 BLOCK</code></li>
            <li><code className="bg-white px-1 rounded border">--strict</code> treats WARN as BLOCK</li>
            <li><code className="bg-white px-1 rounded border">vsixgate.config.json</code> for thresholds</li>
            <li><code className="bg-white px-1 rounded border">--format sarif --out</code> for GitHub Actions</li>
          </ul>
          <a href={GITHUB_URL} target="_blank" onClick={onClose} className="mt-3 inline-flex text-sm font-semibold text-ink-900 hover:underline">Docs on GitHub →</a>
        </div>
      </div>
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-t">
        <div className="p-5">
          <div className="text-xs tracking-widest font-bold text-ink-400">FOR ENTERPRISES</div>
          <h4 className="mt-1 font-display font-bold">Web service & on-prem API</h4>
          <p className="mt-1 text-sm text-ink-600">Host vsixgate as a private scanning service — bulk scan, policy as code, SSO, audit log.</p>
          <ul className="mt-2 text-sm text-ink-600 list-disc pl-4 space-y-1">
            <li>REST: <code className="bg-slate-100 px-1 rounded">POST /scan</code> with .vsix or <code className="bg-slate-100 px-1 rounded">publisher.name</code></li>
            <li>Webhook: block <code className="bg-slate-100 px-1 rounded">vsce publish</code> before it ships</li>
            <li>On-prem runner, no data leaves your VPC</li>
          </ul>
          <button onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('open-agent', { detail: 'Tell me about enterprise web service pricing and deployment' })) }} className="mt-3 inline-flex rounded-full bg-slate-900 text-white px-4 py-1.5 text-sm font-semibold">Talk to agent →</button>
        </div>
        <div className="p-5 bg-white">
          <div className="text-xs tracking-widest font-bold text-brand-600">PERSONALIZED IDE</div>
          <h4 className="mt-1 font-display font-bold">vsixgate inside VS Code</h4>
          <p className="mt-1 text-sm text-ink-600">Scan the extension you’re building — live in the editor, before <code className="bg-slate-100 px-1 rounded">vsce package</code>.</p>
          <ul className="mt-2 text-sm text-ink-600 list-disc pl-4 space-y-1">
            <li>Command: <code className="bg-slate-100 px-1 rounded">vsixgate: Scan this workspace</code></li>
            <li>Problems panel → SARIF diagnostics</li>
            <li>Pre-publish check on <code className="bg-slate-100 px-1 rounded">vsce publish</code> hook</li>
          </ul>
          <span className="mt-3 inline-flex text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-semibold">Coming soon — ask agent for early access</span>
        </div>
      </div>
      <div className="bg-slate-50 border-t px-5 py-3 flex items-center justify-between text-xs">
        <span className="text-ink-500">Need something else? Ask the vsixgate agent — it knows this site inside out.</span>
        <button onClick={onClose} className="font-semibold text-ink-700 hover:text-ink-900">Close ✕</button>
      </div>
    </div>
  )
}

export default function Header() {
  const [moreOpen, setMoreOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const { user, signOut } = useAuth()
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 glass">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-[56px] items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-display font-bold text-[15px]">◈</div>
            <div className="leading-none hidden sm:block">
              <div className="font-display font-bold tracking-tight text-[17px]">vsixgate</div>
              <div className="text-[10px] tracking-widest font-medium text-ink-400 -mt-0.5">PRE-PUBLISH SCANNER</div>
            </div>
            <span className="hidden lg:inline-flex items-center rounded-full bg-slate-900 text-white px-2.5 py-0.5 text-[11px] font-semibold">v0.1.0</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 text-[13px] font-medium">
            <NavLink to="/" className={({ isActive }) => `px-2.5 py-1.5 rounded-full ${isActive ? 'bg-slate-900 text-white' : 'text-ink-600 hover:bg-slate-100'}`}>Overview</NavLink>
            <NavLink to="/scan" className={({ isActive }) => `px-2.5 py-1.5 rounded-full ${isActive ? 'bg-slate-900 text-white' : 'text-ink-600 hover:bg-slate-100'}`}>Scanner</NavLink>
            <NavLink to="/examples" className={({ isActive }) => `px-2.5 py-1.5 rounded-full ${isActive ? 'bg-slate-900 text-white' : 'text-ink-600 hover:bg-slate-100'}`}>Examples</NavLink>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-full text-ink-600 hover:bg-slate-100 inline-flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38l-.01-1.34C4.2 14.3 3.66 13 3.66 13c-.36-.91-.88-1.15-.88-1.15-.72-.49.05-.48.05-.48.79.06 1.2.82 1.2.82.71 1.22 1.87.87 2.33.66.08-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.45.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
              GitHub
            </a>
            <div className="relative" ref={moreRef}>
              <button onClick={() => setMoreOpen(v => !v)} className={`px-2.5 py-1.5 rounded-full inline-flex items-center gap-1 ${moreOpen ? 'bg-slate-900 text-white' : 'text-ink-600 hover:bg-slate-100'}`}>
                More <span className={`text-xs transition ${moreOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              <MorePopup open={moreOpen} onClose={() => setMoreOpen(false)} />
            </div>
          </nav>

          <div className="flex items-center gap-1.5 shrink-0">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-full border bg-white hover:bg-slate-50" aria-label="GitHub">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38l-.01-1.34C4.2 14.3 3.66 13 3.66 13c-.36-.91-.88-1.15-.88-1.15-.72-.49.05-.48.05-.48.79.06 1.2.82 1.2.82.71 1.22 1.87.87 2.33.66.08-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.45.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
            </a>
            {user ? (
              <div className="flex items-center gap-1.5">
                <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full border bg-white" />
                <span className="hidden sm:inline text-xs font-semibold max-w-[100px] truncate">{user.name}</span>
                <button onClick={signOut} className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Sign out</button>
              </div>
            ) : (
              <button onClick={()=> setAuthOpen(true)} className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Sign in</button>
            )}
            <Link to="/scan" className="inline-flex items-center rounded-full bg-brand-500 px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-brand-600">Scan now</Link>
          </div>
        </div>
      </div>
      <AuthModal open={authOpen} onClose={()=> setAuthOpen(false)} />
    </header>
  )
}
