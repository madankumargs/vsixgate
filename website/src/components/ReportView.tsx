import { useState } from 'react'
import ScoreRing from './ScoreRing'
import ReportDashboard from './ReportDashboard'
import type { ScanResult } from '../lib/scanner'
import type { Finding } from '../data/examples'

function sevBadge(s:string){
  if(s==='critical') return 'bg-red-600 text-white'
  if(s==='high') return 'bg-orange-500 text-white'
  if(s==='medium') return 'bg-amber-500 text-white'
  if(s==='low') return 'bg-sky-100 text-sky-800 border'
  return 'bg-slate-100 text-slate-700 border'
}
function plainExplain(f: Finding): string {
  if (f.rule.includes('source_to_shell')) return 'User input could reach a shell command. Add an allowlist before exec/spawn.'
  if (f.rule.includes('source_to_eval')) return 'Untrusted text flows into eval(). Avoid eval or wrap with JSON.parse + validation.'
  if (f.rule.includes('read_to_write')) return 'File read is written back — risky if path/content is attacker-controlled. Restrict paths.'
  if (f.rule.includes('disguised_executable')) return 'Image file actually contains executable code (PE/ELF). Remove or verify source.'
  if (f.rule.includes('telemetry')) return 'Telemetry without opt-out. Add vscode.env.isTelemetryEnabled check.'
  if (f.rule.includes('typosquat')) return 'Dependency looks like a typo of a popular package. Verify spelling.'
  if (f.rule.includes('missing_lockfile')) return 'No lockfile — transitive deps can drift. Commit package-lock.json.'
  if (f.rule.includes('activation_star')) return 'Activates on startup (*) — broad surface. Use specific events if possible.'
  if (f.rule.includes('network')) return f.redFlag?.includes('http') ? 'Uses unencrypted http. Switch to https.' : 'Contacts an external host — verify necessity.'
  return f.redFlag || f.message
}

export default function ReportView({ result, compact=false }: { result: ScanResult; compact?: boolean }){
  const counts = result.findings.reduce((a:any,f)=>{ a[f.severity]++; return a},{critical:0,high:0,medium:0,low:0,info:0} as any)
  const topRisks = [...result.findings].sort((a,b)=> ({critical:4,high:3,medium:2,low:1,info:0}[b.severity] - ({critical:4,high:3,medium:2,low:1,info:0}[a.severity]))).slice(0,3)
  const [showAll, setShowAll] = useState(compact ? false : true)
  const [tab, setTab] = useState<'dashboard'|'findings'|'raw'>('dashboard')

  const statusMeta = result.status==='BLOCK' ? { color:'text-red-600', bg:'bg-red-50 border-red-200', title:'BLOCK — Do not publish', desc:'Critical or new high-risk signals found. Fix before vsce publish or the update could ship an attack.' }
    : result.status==='WARN' ? { color:'text-amber-700', bg:'bg-amber-50 border-amber-200', title:'WARN — Review before publish', desc:'Medium/high findings that are not brand-new. Review, add mitigations, or set strict=false if accepted.' }
    : { color:'text-emerald-700', bg:'bg-emerald-50 border-emerald-200', title:'PASS — Safe to publish', desc:'No blocking signals. Keep the gate in CI for every future release.' }

  const jsonReport = JSON.stringify({ manifest: result.manifest, findings: result.findings, scoring: { counts, status: result.status }, score: result.score, source:(result as any).downloadUrl }, null, 2)
  const sarif = JSON.stringify({ $schema:'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json', version:'2.1.0', runs:[{ tool:{ driver:{ name:'vsixgate', version:'0.1.0'}}, results: result.findings.map(f=>({ ruleId:f.rule, level: f.severity==='critical'||f.severity==='high'?'error': f.severity==='medium'?'warning':'note', message:{ text:f.message }, locations: f.location? [{ physicalLocation:{ artifactLocation:{ uri:f.location.file }}}]: undefined })) }]}, null, 2)

  return (
    <div className="space-y-4">
      {/* Executive summary - readable, valuable */}
      <div className={`rounded-2xl border p-5 ${statusMeta.bg}`}>
        <div className="flex gap-4">
          <ScoreRing score={result.score} size={64} />
          <div className="flex-1 min-w-0">
            <div className={`font-display font-bold text-lg ${statusMeta.color}`}>{statusMeta.title} <span className="font-mono text-sm opacity-70">• exit {result.status==='BLOCK'?2: result.status==='WARN'?1:0}</span></div>
            <div className="text-sm text-ink-700 mt-1">{statusMeta.desc}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(['critical','high','medium','low','info'] as const).map(k=> counts[k]>0 && <span key={k} className="text-xs px-2 py-1 rounded-full bg-slate-900 text-white font-mono">{k.toUpperCase()} {counts[k]}</span>)}
              <span className="text-xs px-2 py-1 rounded-full bg-white border font-mono">{result.publisher}.{result.name}@{result.version}</span>
            </div>
            {/* visual bar */}
            <div className="mt-3 h-2 rounded-full bg-white/70 border flex overflow-hidden">
              {(['critical','high','medium','low'] as const).map(k=> counts[k]>0 && <div key={k} className={`${k==='critical'?'bg-red-600':k==='high'?'bg-orange-500':k==='medium'?'bg-amber-400':'bg-sky-400'}`} style={{ width: `${(counts[k]/Math.max(1,result.findings.length))*100}%` }} />)}
            </div>
          </div>
        </div>
        {/* what to do - valuable */}
        <div className="mt-4 grid sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl bg-white border p-3"><div className="font-bold">What it means</div><div className="text-ink-600 mt-1">{result.status==='BLOCK' ? 'Attacker-controlled input could become code or shell. Diff flags NEW risks — the GlassWorm pattern.' : result.status==='WARN' ? 'Present risk but not new in this version. Mitigate or accept.' : 'No exploitable pattern matched. Still run on every version.'}</div></div>
          <div className="rounded-xl bg-white border p-3"><div className="font-bold">Do now</div><div className="text-ink-600 mt-1">{result.status==='BLOCK' ? '1) Allowlist shell args 2) Remove eval 3) Verify image assets 4) Re-scan' : result.status==='WARN' ? '1) Add opt-out / https 2) Pin deps 3) Narrow activationEvents' : '1) Keep SARIF upload 2) Enable --strict'}</div></div>
          <div className="rounded-xl bg-white border p-3"><div className="font-bold">Time to fix</div><div className="text-ink-600 mt-1">{result.status==='BLOCK' ? '~30–60 min (allowlist + tests)' : result.status==='WARN' ? '~15 min' : '<5 min'}</div></div>
        </div>
        {topRisks.length>0 && (
          <div className="mt-3 rounded-xl bg-slate-900 text-slate-100 p-3">
            <div className="text-xs tracking-widest opacity-60">TOP RISKS (plain English)</div>
            <ul className="mt-1 space-y-1 text-sm">
              {topRisks.map((f,i)=> <li key={i} className="flex gap-2"><span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-bold h-fit mt-0.5 ${sevBadge(f.severity)}`}>{f.severity.toUpperCase()}</span><span>{plainExplain(f)} <span className="opacity-60">— {f.rule}</span></span></li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Tabs - minimal, valuable */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="flex gap-1 p-1.5 bg-slate-50 border-b">
          {(['dashboard','findings','raw'] as const).map(t=>(
            <button key={t} onClick={()=> setTab(t)} className={`flex-1 py-2 rounded-xl text-sm font-semibold ${tab===t?'bg-white border shadow-sm':'text-ink-500 hover:bg-white'}`}>{t==='dashboard'?'Dashboard': t==='findings'?`Findings (${result.findings.length})`:'Raw'}</button>
          ))}
        </div>
        <div className="p-4 max-h-[640px] overflow-auto">
          {tab==='dashboard' && <ReportDashboard result={result} />}
          {tab==='findings' && (
            result.findings.length===0 ? <div className="text-center py-8"><div className="text-2xl">✅</div><div className="font-semibold mt-2">Clean — no findings</div><div className="text-sm text-ink-500">Keep the gate: scan every version, upload SARIF to PRs.</div></div>
            : <>
              <div className="space-y-3">
                {(showAll? result.findings : result.findings.slice(0,3)).map((f,i)=>(
                  <details key={i} open={f.severity==='critical' || f.severity==='high'} className="rounded-xl border bg-white overflow-hidden">
                    <summary className="list-none flex items-center gap-2 p-3 cursor-pointer hover:bg-slate-50">
                      <span className={`text-[11px] px-2 py-1 rounded-full font-bold ${sevBadge(f.severity)}`}>{f.severity.toUpperCase()}</span>
                      <span className="font-mono text-sm font-semibold truncate">{f.rule}</span>
                      <span className="ml-auto text-xs text-ink-400 truncate max-w-[160px]">{f.location?.file}</span>
                    </summary>
                    <div className="px-3 pb-3 space-y-2">
                      <div className="text-sm">{f.message}</div>
                      <div className="text-sm rounded-lg bg-amber-50 border border-amber-200 p-2.5"><b>Fix:</b> {plainExplain(f)}</div>
                      <div className="grid sm:grid-cols-2 gap-2 text-xs">
                        {f.legitimateUse && <div className="rounded-lg bg-slate-50 border p-2"><b>Why it exists:</b> {f.legitimateUse}</div>}
                        {f.redFlag && <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-red-700"><b>Why flagged here:</b> {f.redFlag}</div>}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
              {result.findings.length>3 && <button onClick={()=> setShowAll(v=>!v)} className="mt-3 w-full rounded-xl border bg-slate-50 py-2 text-sm font-semibold">{showAll? 'Show less':'Show all findings'}</button>}
            </>
          )}
          {tab==='raw' && <>
            <div className="flex flex-wrap gap-2 mb-3">
              <button onClick={()=> navigator.clipboard.writeText(jsonReport)} className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-900 text-white">Copy JSON</button>
              <button onClick={()=> navigator.clipboard.writeText(sarif)} className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border">Copy SARIF</button>
              <button onClick={()=>{ const b=new Blob([sarif],{type:'application/json'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download='results.sarif'; a.click(); URL.revokeObjectURL(u)}} className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 border border-amber-200 text-amber-900">Download SARIF</button>
              <button onClick={()=>{ const b=new Blob([jsonReport],{type:'application/json'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download='report.json'; a.click(); URL.revokeObjectURL(u)}} className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border">Download JSON</button>
            </div>
            <details className="mb-2"><summary className="cursor-pointer text-sm font-semibold">JSON — stable schema per docs/schema.md</summary><pre className="mt-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-slate-900 text-slate-100 p-3 rounded-xl max-h-[260px] overflow-auto">{jsonReport.slice(0,8000)}</pre></details>
            <details><summary className="cursor-pointer text-sm font-semibold">SARIF 2.1.0 — upload via github/codeql-action/upload-sarif</summary><pre className="mt-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-slate-900 text-slate-100 p-3 rounded-xl max-h-[260px] overflow-auto">{sarif.slice(0,8000)}</pre></details>
          </>}
        </div>
      </div>
    </div>
  )
}
