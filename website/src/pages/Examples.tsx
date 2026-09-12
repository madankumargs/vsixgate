import { Link } from 'react-router-dom'
import { examples } from '../data/examples'
import ScoreRing from '../components/ScoreRing'

export default function Examples(){
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl">Example gallery — 10 scanned extensions</h1>
          <p className="mt-2 text-ink-600 max-w-2xl">Each card is a realistic reconstruction of a pattern vsixgate is built to catch. Click any to see findings, legitimateUse / redFlag, and SARIF.</p>
        </div>
        <Link to="/scan" className="rounded-full bg-brand-500 text-white px-5 py-2.5 font-bold shadow-glow">Scan your own →</Link>
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        {examples.map(ex=>(
          <Link key={ex.id} to={`/examples/${ex.id}`} className="rounded-2xl border bg-white p-5 shadow-soft hover:shadow-lg transition">
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-50 to-white border grid place-items-center text-xl">{ex.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{ex.displayName}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ex.status==='BLOCK'?'bg-red-100 text-red-700 border border-red-200': ex.status==='WARN'?'bg-amber-100 text-amber-800 border border-amber-200':'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{ex.status}</span>
                </div>
                <div className="text-xs font-mono text-ink-400">{ex.publisher}.{ex.name}@{ex.version} • {ex.vsixSize} • {ex.lastScanned}</div>
                <div className="mt-2 text-sm text-ink-600">{ex.description}</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ex.findings.slice(0,3).map(f=>(
                    <span key={f.rule} className={`text-[11px] px-2 py-1 rounded-full border font-medium ${f.severity==='critical'?'bg-red-50 border-red-200 text-red-700': f.severity==='high'?'bg-orange-50 border-orange-200 text-orange-700': f.severity==='medium'?'bg-amber-50 border-amber-200 text-amber-800':'bg-slate-50 border-slate-200'}`}>{f.rule}</span>
                  ))}
                  {ex.findings.length>3 && <span className="text-xs text-ink-400">+{ex.findings.length-3} more</span>}
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-center gap-2">
                <ScoreRing score={ex.score} />
                <div className="text-xs text-ink-400">{ex.downloads}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
