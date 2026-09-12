import { useParams, Link } from 'react-router-dom'
import { getExample } from '../data/examples'
import ScoreRing from '../components/ScoreRing'
import ReportView from '../components/ReportView'
import type { ScanResult } from '../lib/scanner'

export default function ExampleDetail(){
  const { id } = useParams()
  const ex = getExample(id||'')
  if(!ex) return <div className="mx-auto max-w-7xl p-8">Not found. <Link to="/examples" className="text-brand-600 underline">Back to examples</Link></div>

  const counts = { critical:0, high:0, medium:0, low:0, info:0 } as any
  for(const f of ex.findings) counts[f.severity]++

  // Map example to ScanResult for unified readable ReportView (valuable, concise)
  const asResult: ScanResult = {
    publisher: ex.publisher,
    name: ex.name,
    version: ex.version,
    findings: ex.findings,
    status: ex.status,
    score: ex.score,
    hasLockfile: !ex.findings.some(f=> f.rule==='manifest.missing_lockfile'),
    manifest: { publisher: ex.publisher, name: ex.name, version: ex.version },
  } as ScanResult

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/examples" className="text-sm text-ink-600 hover:text-ink-900">← All examples</Link>

      <div className="mt-4 rounded-[24px] border bg-white p-6 shadow-soft">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-50 to-white border grid place-items-center text-2xl">{ex.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display font-bold text-2xl">{ex.displayName}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${ex.status==='BLOCK'?'bg-red-600 text-white': ex.status==='WARN'?'bg-amber-400 text-amber-900':'bg-emerald-500 text-white'}`}>{ex.status} • exit {ex.status==='BLOCK'?2: ex.status==='WARN'?1:0}</span>
              <span className="text-xs font-mono text-ink-400">{ex.publisher}.{ex.name}@{ex.version}</span>
            </div>
            <p className="mt-2 text-ink-600">{ex.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {Object.entries(counts).map(([k,v])=>(
                <span key={k} className="px-2.5 py-1 rounded-full bg-slate-900 text-white font-mono">{k.toUpperCase()}: {v as number}</span>
              ))}
              <span className="px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-900 font-semibold">{ex.vsixSize}</span>
              <span className="px-2.5 py-1 rounded-full bg-white border">{ex.downloads} installs</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ScoreRing score={ex.score} size={84} />
            <div className="text-xs font-semibold tracking-widest text-ink-400">SECURITY SCORE</div>
            <Link to="/scan" className="mt-2 text-xs font-semibold text-brand-600 hover:underline">Scan similar →</Link>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <ReportView result={asResult} />
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-white p-4 shadow-soft">
            <div className="font-semibold">How vsixgate caught this</div>
            <ul className="mt-2 space-y-1 text-sm text-ink-600 list-disc pl-5">
              <li>Diff engine marks <code className="bg-amber-100 px-1 rounded">newInThisVersion</code> — novelty is the strongest signal.</li>
              <li>Scoring: <code className="bg-slate-100 px-1 rounded">critical → BLOCK</code>, <code className="bg-slate-100 px-1 rounded">high+new → BLOCK</code>.</li>
              <li>SARIF maps to <code className="bg-slate-100 px-1 rounded">error/warning/note</code> for PR annotations.</li>
            </ul>
            <Link to="/scan" className="mt-3 inline-flex rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-semibold">Try with your .vsix</Link>
          </div>
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <div className="font-semibold text-amber-900">Reproduce locally</div>
            <div className="mt-2 font-mono text-xs bg-white border rounded-xl p-3">
              vsixgate scan ./fixtures/{ex.id}.vsix --format sarif --out results.sarif
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
