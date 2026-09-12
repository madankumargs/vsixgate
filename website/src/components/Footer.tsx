import { Link } from 'react-router-dom'

export default function Footer(){
  return (
    <footer className="border-t border-slate-200 bg-slate-50/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center text-white font-bold">◈</div>
              <div className="font-display font-bold">vsixgate</div>
            </div>
            <p className="mt-3 text-sm text-ink-600 leading-relaxed">Pre-publish scanner for VS Code / Open VSX extensions. Runs in your CI — before <code className="bg-white px-1 py-0.5 rounded border">vsce publish</code>.</p>
            <div className="mt-4 flex gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-white border">MIT</span>
              <span className="px-2 py-1 rounded-full bg-white border">SARIF 2.1.0</span>
              <span className="px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900">Node 20+</span>
            </div>
          </div>
          <div>
            <div className="font-semibold text-sm">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li><Link to="/scan" className="hover:text-ink-900">Live Scanner</Link></li>
              <li><Link to="/examples" className="hover:text-ink-900">10 Examples</Link></li>
              <li><a href="#" className="hover:text-ink-900">Architecture</a></li>
              <li><a href="#" className="hover:text-ink-900">Schema Docs</a></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-sm">Why vsixgate?</div>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li>Version-diff engine</li>
              <li>UntrustIDE taint model</li>
              <li>SARIF for GitHub Actions</li>
              <li>Typosquat + OSV</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-sm">Get started</div>
            <div className="mt-3 rounded-xl bg-slate-900 p-3 font-mono text-xs text-slate-100">
              <div className="opacity-60"># install</div>
              <div>npm i -g ./vsixgate-0.1.0.tgz</div>
              <div className="mt-2 opacity-60"># scan</div>
              <div>vsixgate scan ./ext.vsix --format sarif --out results.sarif</div>
            </div>
            <div className="mt-3 text-xs text-ink-400">Heuristic v0.1 — Semgrep/YARA-X planned for production.</div>
          </div>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-400 border-t pt-6">
          <div className="flex items-center gap-2">
            <span>© 2026 vsixgate. Built for publishers, not dashboards.</span>
            <a href="https://github.com/vsixgate/vsixgate" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white border px-3 py-1 font-semibold text-ink-700 hover:bg-slate-50">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38l-.01-1.34C4.2 14.3 3.66 13 3.66 13c-.36-.91-.88-1.15-.88-1.15-.72-.49.05-.48.05-.48.79.06 1.2.82 1.2.82.71 1.22 1.87.87 2.33.66.08-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.45.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              github.com/vsixgate/vsixgate
            </a>
          </div>
          <div className="flex gap-4">
            <span>Privacy-first: scans run locally / in your browser demo</span>
            <span>•</span>
            <span>Made with ◈</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
