import { Link } from 'react-router-dom'
import { examples } from '../data/examples'
import ScoreRing from '../components/ScoreRing'

const stats = [
  { label: 'Pipeline stages', value: '8' },
  { label: 'Example scans', value: '10' },
  { label: 'Signals per scan', value: '~18' },
  { label: 'SARIF ready', value: '2.1.0' },
]

export default function Home(){
  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute inset-0 bg-glow" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-900 shadow-soft">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
            Pre-publish • not post-install • the missing gate before vsce publish
          </div>

          <div className="grid lg:grid-cols-2 gap-10 mt-6">
            <div>
              <h1 className="font-display font-bold tracking-tight text-[40px] sm:text-[52px] leading-[0.95]">
                The only scanner that <span className="bg-gradient-to-r from-brand-500 to-amber-500 bg-clip-text text-transparent">catches</span> the update that burns you.
              </h1>
              <p className="mt-4 text-[18px] leading-relaxed text-ink-600">
                vsixgate runs <span className="font-semibold text-ink-900">in your CI before publish</span> — manifest + UntrustIDE taint + signatures + dependency/typosquat + <span className="underline decoration-amber-300 decoration-4">version-diff</span> → SARIF. BLOCK/WARN/PASS gates your release.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/scan" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-white font-semibold shadow-lg hover:bg-black">
                  Try live scanner <span>↗</span>
                </Link>
                <a href="#pipeline" className="inline-flex items-center gap-2 rounded-full bg-white border px-6 py-3 font-semibold hover:bg-slate-50">
                  See pipeline
                </a>
                <Link to="/examples" className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-6 py-3 font-semibold text-amber-900 hover:bg-amber-200">
                  10 examples →
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-4 gap-3">
                {stats.map(s=>(
                  <div key={s.label} className="rounded-2xl bg-white border p-3 shadow-soft">
                    <div className="font-display font-bold text-xl">{s.value}</div>
                    <div className="text-xs text-ink-400 font-medium leading-tight">{s.label}</div>
                  </div>
                ))}
              </div>

              <div id="install" className="mt-6 rounded-2xl bg-slate-900 text-slate-100 p-4 font-mono text-sm shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="text-xs tracking-widest opacity-60">QUICK START</div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-white/10">copy</span>
                </div>
                <div className="mt-2"><span className="opacity-60">$</span> npm install -g ./vsixgate-0.1.0.tgz</div>
                <div><span className="opacity-60">$</span> vsixgate scan ./ext.vsix --format sarif --out results.sarif</div>
                <div><span className="opacity-60">$</span> echo $?  <span className="opacity-60"># 0 PASS • 1 WARN • 2 BLOCK</span></div>
              </div>
            </div>

            {/* Hero card — live-like terminal */}
            <div className="relative">
              <div className="rounded-[24px] bg-slate-900 p-4 sm:p-5 shadow-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                  <span className="ml-2 text-xs font-mono text-slate-400">vsixgate scan ./glassworm.vsix --strict</span>
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-red-500 text-white font-bold">BLOCK</span>
                </div>
                <div className="mt-4 rounded-xl bg-black/40 border border-white/10 p-4 font-mono text-xs leading-relaxed text-slate-200 overflow-hidden">
                  <div className="text-amber-300"> ▸ vsixgate v0.1.0  — pre-publish extension scanner</div>
                  <div className="mt-2 text-slate-400">Analyzers: manifest ✓  static ✓  signatures ✓  dependency ✓  diff ✓  scoring ✓</div>
                  <div className="mt-3">
                    <div className="text-white font-bold">Scan results:</div>
                    <div className="text-red-300">  Status: BLOCK  <span className="opacity-60">— 1 critical • 2 high (2 new) • 1 medium</span></div>
                    <div>  Security score: <span className="text-red-300 font-bold">9/100</span></div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div><span className="text-red-400">[CRITICAL]</span> static.source_to_shell — extension/out/preview.js:88 <span className="bg-amber-300 text-black px-1 rounded text-[10px]">NEW</span></div>
                    <div><span className="text-red-400">[HIGH]</span> signatures.disguised_executable — extension/assets/icon.png <span className="bg-amber-300 text-black px-1 rounded text-[10px]">NEW</span></div>
                    <div><span className="text-yellow-300">[MEDIUM]</span> dependency.typosquat — axioss → axios</div>
                  </div>
                  <div className="mt-3 text-slate-400">→ SARIF written to results.sarif (upload via github/codeql-action/upload-sarif)</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3"><div className="text-xs text-slate-400">New sinks</div><div className="font-bold text-white">+2</div></div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3"><div className="text-xs text-slate-400">New destinations</div><div className="font-bold text-amber-300">+1</div></div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3"><div className="text-xs text-slate-400">Exit code</div><div className="font-bold text-red-300">2</div></div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white border grid place-items-center">🛡️</div>
                <div className="text-sm">
                  <div className="font-semibold">Core differentiator — version-diff engine</div>
                  <div className="text-ink-600">Clean v0.12.0 → malicious v0.12.1: flags only <em>new</em> risk. That is the AsyncAPI / GlassWorm pattern.</div>
                </div>
                <Link to="/examples" className="ml-auto hidden sm:inline-flex text-sm font-semibold text-amber-900 hover:underline">See example →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY UNIQUE - comparison */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display font-bold text-2xl">Why vsixgate, not the others?</h2>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-900 text-white">Pre-publish vs post-publish</span>
        </div>
        <p className="mt-2 text-ink-600 max-w-3xl">Existing tools scan <em>after</em> an extension is already published or installed. vsixgate is the gate <em>before</em> publish — in the publisher’s own CI, so a compromised update never ships.</p>

        <div className="mt-6 overflow-hidden rounded-2xl border shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs tracking-widest font-semibold text-ink-400">
                <tr>
                  <th className="text-left p-3">Capability</th>
                  <th className="p-3 text-center bg-amber-50/70">vsixgate <span className="text-amber-600">(this)</span></th>
                  <th className="p-3 text-center">ExtensionTotal / Koi</th>
                  <th className="p-3 text-center">vsix-audit</th>
                  <th className="p-3 text-center">VSCan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ['Runs before publish (publisher CI)', '✅', '—', '—', '—'],
                  ['Version-diff: new risk flagged', '✅ core', '—', '—', '—'],
                  ['UntrustIDE taint model (source→sink)', '✅', 'partial', '—', 'partial'],
                  ['SARIF 2.1.0 for PR annotations', '✅', '—', '—', '—'],
                  ['Typosquat + OSV lockfile check', '✅', '✅', '—', '—'],
                  ['Disguised binary (PNG→ELF/PE)', '✅', '✅', '—', '✅'],
                  ['Exit codes BLOCK/WARN/PASS', '✅ 0/1/2', 'dashboard', 'report', 'report'],
                  ['Local / offline friendly', '✅', 'cloud', 'local', 'local'],
                ].map(([cap,a,b,c,d])=>(
                  <tr key={cap} className="hover:bg-amber-50/30">
                    <td className="p-3 font-medium">{cap}</td>
                    <td className="p-3 text-center bg-amber-50/40 font-bold text-amber-900">{a}</td>
                    <td className="p-3 text-center text-ink-600">{b}</td>
                    <td className="p-3 text-center text-ink-600">{c}</td>
                    <td className="p-3 text-center text-ink-600">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gradient-to-r from-amber-50 to-white border-t px-4 py-3 text-xs text-ink-600">
            Bottom line: others are <em>market scanners</em>. vsixgate is a <em>publish gate</em>. You shift left — from “detect after compromise” to “block before publish”.
          </div>
        </div>
      </section>

      {/* PIPELINE */}
      <section id="pipeline" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10">
        <h2 className="font-display font-bold text-2xl">Pipeline — 8 stages, one Finding contract</h2>
        <p className="mt-2 text-ink-600">Every stage emits <code className="px-1.5 py-0.5 bg-slate-100 rounded border text-xs">Finding</code> — rule + severity + location + redFlag/legitimateUse. Scoring + SARIF stay consistent.</p>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { k:'01', title:'Unpack', desc:'AdmZip → temp dir, locate package.json', color:'bg-slate-900' },
            { k:'02', title:'Manifest', desc:'activationEvents *, settings, capabilities, deps, lockfile', color:'bg-brand-500' },
            { k:'03', title:'Static taint', desc:'workspace/fs/http → exec/eval/write (UntrustIDE)', color:'bg-amber-500' },
            { k:'04', title:'Signatures', desc:'PNG/ELF disguise + telemetry opt-out downgrade', color:'bg-red-500' },
            { k:'05', title:'Dependencies', desc:'lockfile parse + OSV + Levenshtein typosquat', color:'bg-violet-600' },
            { k:'06', title:'Diff engine', desc:'SQLite/JSON history → newInThisVersion', color:'bg-emerald-600' },
            { k:'07', title:'Scoring', desc:'critical→BLOCK, high+new→BLOCK, high/medium→WARN', color:'bg-blue-600' },
            { k:'08', title:'Report', desc:'text / json / SARIF 2.1.0 → PR annotations', color:'bg-slate-700' },
          ].map(s=>(
            <div key={s.k} className="rounded-2xl border bg-white p-4 shadow-soft hover:shadow-md transition">
              <div className={`h-8 w-8 rounded-lg ${s.color} text-white grid place-items-center text-xs font-bold`}>{s.k}</div>
              <div className="mt-3 font-semibold">{s.title}</div>
              <div className="mt-1 text-sm text-ink-600 leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 10 EXAMPLES preview */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-2xl">10 example scans — click to inspect</h2>
          <Link to="/examples" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all →</Link>
        </div>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {examples.slice(0,6).map(ex=>(
            <Link key={ex.id} to={`/examples/${ex.id}`} className="rounded-2xl border bg-white p-4 shadow-soft hover:shadow-lg transition group">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-50 border grid place-items-center text-lg">{ex.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-tight truncate">{ex.displayName}</div>
                  <div className="text-xs text-ink-400 font-mono">{ex.publisher}.{ex.name}@{ex.version}</div>
                </div>
                <ScoreRing score={ex.score} size={44} />
              </div>
              <div className="mt-3 text-sm text-ink-600 line-clamp-2">{ex.description}</div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className={`px-2 py-1 rounded-full font-bold ${ex.status==='BLOCK'?'bg-red-100 text-red-700': ex.status==='WARN'?'bg-amber-100 text-amber-800':'bg-emerald-100 text-emerald-700'}`}>{ex.status}</span>
                <span className="text-ink-400">{ex.downloads} installs</span>
                <span className="ml-auto text-ink-400 group-hover:text-ink-900">Findings: {ex.findings.length} →</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ex.categories.map(c=> <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border">{c}</span>)}
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {examples.slice(6).map(ex=>(
            <Link key={ex.id} to={`/examples/${ex.id}`} className="rounded-2xl border bg-white p-3 shadow-soft hover:shadow-lg transition flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-50 border grid place-items-center">{ex.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{ex.displayName}</div>
                <div className="text-xs text-ink-400">{ex.status} • {ex.score}/100</div>
              </div>
              <ScoreRing score={ex.score} size={36} />
            </Link>
          ))}
        </div>
      </section>

      {/* UNIVERSAL SCAN - better reason */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6">
        <div className="rounded-[24px] border bg-gradient-to-br from-amber-50 via-white to-white p-6 sm:p-7">
          <div className="flex flex-wrap items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">∞</div>
            <div className="flex-1 min-w-[280px]">
              <h2 className="font-display font-bold text-xl">Scan <span className="text-brand-600">any</span> of 50k+ released extensions — not just the 10 examples</h2>
              <p className="mt-2 text-sm text-ink-600 leading-relaxed">The 10 examples are curated reconstructions. The scanner itself works on <b>any publisher.extension</b> ever published. It fetches the real .vsix from Open VSX / Marketplace and scans locally in your browser — no backend, no key. <b>Why this matters:</b> teams install ~15–30 extensions; one typosquat or GlassWorm-style malicious update compromises the whole org. vsixgate lets you vet before <code className="bg-white px-1 rounded border">code --install-extension</code>, audit existing installs, and gate your own releases — all with the same 8-stage pipeline. That’s the supply-chain gap the demo proves at scale.</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-white border font-semibold">50k+ searchable via Open VSX</span>
                <span className="px-3 py-1 rounded-full bg-white border font-semibold">Any publisher.extension@version</span>
                <span className="px-3 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-800 font-semibold">No upload • No tracking • 30MB zip-bomb guard</span>
              </div>
            </div>
            <Link to="/scan" className="rounded-full bg-slate-900 text-white px-6 py-3 font-bold hover:bg-black whitespace-nowrap">Search & scan any →</Link>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6">
        <div className="rounded-2xl bg-slate-900 text-slate-200 p-5 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-white">🔒 Hardened by default</span>
          <span className="h-6 w-px bg-white/10" />
          <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10">CSP + HSTS + X-Frame DENY</span>
          <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10">Zip-slip & zip-bomb guard</span>
          <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10">SSRF allowlist + timeout</span>
          <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10">XSS escape + rate limit</span>
          <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10">No cookies</span>
          <a href="https://github.com/vsixgate/vsixgate" target="_blank" className="ml-auto text-amber-300 hover:underline">security.txt →</a>
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-[24px] bg-slate-900 text-white p-6 sm:p-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 to-amber-400/20" />
          <div className="relative grid md:grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-display font-bold">~2.3s</div>
              <div className="text-sm text-slate-400">Median scan (vsix unpack + all analyzers)</div>
            </div>
            <div>
              <div className="text-3xl font-display font-bold">BLOCK 4</div>
              <div className="text-sm text-slate-400">of 10 examples gate the release</div>
            </div>
            <div>
              <div className="text-3xl font-display font-bold">SARIF</div>
              <div className="text-sm text-slate-400">Native GitHub / GitLab annotations</div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/scan" className="rounded-full bg-white text-slate-900 px-5 py-2.5 font-bold hover:bg-amber-100 transition">Open Scanner</Link>
              <div className="text-xs text-slate-400">or drag a .vsix anywhere</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
