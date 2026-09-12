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
          <div>© 2026 vsixgate. Built for publishers, not dashboards.</div>
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
