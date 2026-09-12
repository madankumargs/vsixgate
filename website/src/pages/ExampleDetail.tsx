import { useParams, Link } from 'react-router-dom'
import { getExample } from '../data/examples'
import ScoreRing from '../components/ScoreRing'

function sevColor(s:string){
  if(s==='critical') return 'bg-red-600 text-white'
  if(s==='high') return 'bg-orange-500 text-white'
  if(s==='medium') return 'bg-amber-400 text-amber-900'
  if(s==='low') return 'bg-sky-100 text-sky-800 border'
  return 'bg-slate-100 text-slate-700 border'
}

export default function ExampleDetail(){
  const { id } = useParams()
  const ex = getExample(id||'')
  if(!ex) return <div className="mx-auto max-w-7xl p-8">Not found. <Link to="/examples" className="text-brand-600 underline">Back to examples</Link></div>

  const counts = { critical:0, high:0, medium:0, low:0, info:0 } as any
  for(const f of ex.findings) counts[f.severity]++

  const sarif = {
    $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{ tool:{ driver:{ name:'vsixgate', version:'0.1.0' } }, results: ex.findings.map(f=>({ ruleId:f.rule, level: f.severity==='critical'||f.severity==='high'?'error': f.severity==='medium'?'warning':'note', message:{ text:f.message }, locations: f.location? [{ physicalLocation:{ artifactLocation:{ uri:f.location.file }, region: f.location.line? { startLine:f.location.line }: undefined }}]: undefined })) }]
  }

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

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-display font-bold text-lg">Findings — {ex.findings.length}</h2>
          {ex.findings.map((f,i)=>(
            <div key={i} className="rounded-2xl border bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2 py-1 rounded-full font-bold ${sevColor(f.severity)}`}>{f.severity.toUpperCase()}</span>
                <span className="font-mono text-sm font-semibold">{f.rule}</span>
                {f.newInThisVersion && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-300 text-amber-900 font-bold">NEW in this version</span>}
                <span className="ml-auto text-xs text-ink-400">{f.location?.file}{f.location?.line? `:${f.location.line}`:''}</span>
              </div>
              <div className="mt-2 text-sm">{f.message}</div>
              {(f.legitimateUse || f.redFlag) && (
                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs leading-relaxed">
                  {f.legitimateUse && <div className="rounded-xl bg-slate-50 border p-3"><div className="font-semibold text-ink-600">Legitimate use</div><div className="text-ink-600">{f.legitimateUse}</div></div>}
                  {f.redFlag && <div className="rounded-xl bg-red-50 border border-red-200 p-3"><div className="font-semibold text-red-700">Red flag</div><div className="text-red-700">{f.redFlag}</div></div>}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-4 shadow-soft">
            <div className="font-semibold">How vsixgate caught this</div>
            <ul className="mt-3 space-y-2 text-sm text-ink-600 list-disc pl-5">
              <li>Diff engine marks <code className="bg-amber-100 px-1 rounded">newInThisVersion</code> — novelty is the strongest signal.</li>
              <li>Scoring: <code className="bg-slate-100 px-1 rounded">critical → BLOCK</code>, <code className="bg-slate-100 px-1 rounded">high+new → BLOCK</code>.</li>
              <li>SARIF maps to <code className="bg-slate-100 px-1 rounded">error/warning/note</code> for PR annotations.</li>
            </ul>
            <Link to="/scan" className="mt-4 inline-flex rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-semibold">Try with your .vsix</Link>
          </div>

          <div className="rounded-2xl bg-slate-900 text-slate-100 p-4">
            <div className="text-xs tracking-widest opacity-60">SARIF 2.1.0 PREVIEW</div>
            <pre className="mt-2 max-h-[320px] overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all">{JSON.stringify(sarif, null, 2)}</pre>
            <button onClick={()=> navigator.clipboard.writeText(JSON.stringify(sarif, null, 2))} className="mt-3 w-full rounded-full bg-white text-slate-900 py-2 text-sm font-bold">Copy SARIF</button>
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
