import type { ScanResult } from '../lib/scanner'

function bar(count:number, total:number, color:string){
  const w = total? (count/total)*100 : 0
  return (
    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width:`${w}%`, background: color, animation: 'grow 700ms ease-out' }} />
    </div>
  )
}

export default function ReportDashboard({ result }: { result: ScanResult }){
  const counts = result.findings.reduce((a:any,f)=>{ a[f.severity]++; return a },{critical:0,high:0,medium:0,low:0,info:0} as any)
  const total = result.findings.length || 1
  const byRule = Object.entries(result.findings.reduce((a:any,f)=>{ a[f.rule]=(a[f.rule]||0)+1; return a },{} as Record<string,number>)).sort((a:any,b:any)=> b[1]-a[1]).slice(0,6)
  const manifest = result.manifest || {}
  const scoreColor = result.score>=80? '#10B981' : result.score>=60? '#F59E0B' : '#EF4444'
  const statusGradient = result.status==='BLOCK' ? 'from-red-500 to-orange-500' : result.status==='WARN' ? 'from-amber-400 to-yellow-500' : 'from-emerald-500 to-teal-500'

  // Animated colourful HTML for download — with gradients, glow, animations
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>vsixgate — ${result.publisher}.${result.name}@${result.version}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap');
*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui;background:#FFF7ED;background-image:radial-gradient(600px 400px at 80% 0%,rgba(255,107,53,0.12),transparent 60%),radial-gradient(500px 500px at 0% 0%,rgba(251,191,36,0.10),transparent 60%);color:#0F172A}
a{color:#FF6B35}
.header{background:linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#7C2D12 100%);color:white;padding:32px;border-radius:24px;margin:24px;position:relative;overflow:hidden}
.header::after{content:'';position:absolute;inset:0;background:radial-gradient(400px 200px at 70% 0%,rgba(255,107,53,0.25),transparent);animation:glow 4s ease-in-out infinite alternate}
@keyframes glow{0%{opacity:0.6}100%{opacity:1}}
@keyframes grow{from{width:0}to{width:var(--w)}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
@keyframes slide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.badge{animation:slide 600ms ease-out}
.card{background:white;border:1px solid #E2E8F0;border-radius:20px;padding:20px;box-shadow:0 8px 30px rgba(0,0,0,0.06);animation:slide 500ms ease-out}
.score-ring{width:84px;height:84px;border-radius:999px;display:grid;place-items:center;font-weight:800;font-size:22px;color:white;background:conic-gradient(${scoreColor} calc(${result.score}*3.6deg), #E2E8F0 0);animation:pulse 2s ease-in-out infinite}
.bar{height:10px;border-radius:999px;background:#F1F5F9;overflow:hidden}
.bar>div{height:100%;border-radius:999px;animation:grow 900ms ease-out}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #E2E8F0;padding:10px;text-align:left;font-size:13px}
th{background:#F8FAFC;font-size:11px;letter-spacing:0.08em;color:#64748B}
.sev-critical{background:#DC2626;color:white;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.sev-high{background:linear-gradient(135deg,#FF6B35,#F59E0B);color:white;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.sev-medium{background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.sev-low{background:#E0F2FE;color:#0C4A6E;padding:2px 8px;border-radius:999px;font-size:11px}
@media print {.header{break-after:avoid} .card{break-inside:avoid}}
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;gap:16px;align-items:center;position:relative;z-index:1">
    <div style="h:36px;width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#FF8C42,#FF6B35);display:grid;place-items:center;font-weight:800">◈</div>
    <div>
      <div style="font-weight:800;letter-spacing:-0.02em;font-size:18px">vsixgate</div>
      <div style="font-size:11px;letter-spacing:0.16em;opacity:0.7">PRE-PUBLISH SCANNER — DETAILED REPORT</div>
    </div>
    <div style="margin-left:auto;text-align:right">
      <div style="font-size:11px;letter-spacing:0.12em;opacity:0.7">STATUS</div>
      <div style="font-weight:800;font-size:18px;background:linear-gradient(135deg,${result.status==='BLOCK'?'#EF4444, #F97316':result.status==='WARN'?'#F59E0B,#EAB308':'#10B981,#14B8A6'});-webkit-background-clip:text;-webkit-text-fill-color:transparent">${result.status} • exit ${result.status==='BLOCK'?2:result.status==='WARN'?1:0}</div>
    </div>
  </div>
  <h1 style="margin:18px 0 6px;font-size:26px;letter-spacing:-0.02em;position:relative;z-index:1">${result.publisher}.${result.name}@${result.version}</h1>
  <div style="opacity:0.7;font-size:13px;position:relative;z-index:1">Score ${result.score}/100 • ${result.findings.length} findings • Generated ${new Date().toLocaleString()} • <span style="font-family:JetBrains Mono,monospace">${result.status==='BLOCK'?'BLOCK — do not publish':result.status==='WARN'?'WARN — review':'PASS — safe'}</span></div>
</div>

<div style="display:grid;grid-template-columns:1fr 1.8fr;gap:16px;margin:0 24px">
  <div class="card badge">
    <div style="font-size:11px;letter-spacing:0.12em;color:#64748B;font-weight:700">SECURITY SCORE</div>
    <div style="display:flex;gap:16px;align-items:center;margin-top:12px">
      <div class="score-ring">${result.score}</div>
      <div>
        <div style="font-weight:700">${result.status}</div>
        <div style="font-size:12px;color:#64748B">${result.status==='BLOCK'?'Critical/high must fix':result.status==='WARN'?'Mitigate or accept':'Keep the gate'}</div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${['critical','high','medium','low','info'].filter(k=>counts[k]>0).map(k=>`<span style="font-size:11px;padding:4px 8px;border-radius:999px;background:#0F172A;color:white;font-family:JetBrains Mono,monospace">${k.toUpperCase()} ${counts[k]}</span>`).join('')}</div>
      </div>
    </div>
  </div>
  <div class="card badge" style="animation-delay:120ms">
    <div style="font-size:11px;letter-spacing:0.12em;color:#64748B;font-weight:700">SEVERITY DISTRIBUTION</div>
    <div style="margin-top:12px;display:grid;gap:10px">
      ${['critical','high','medium','low'].map(k=>`<div style="display:flex;align-items:center;gap:10px;font-size:12px"><span style="width:64px;text-transform:capitalize">${k}</span><div class="bar" style="flex:1"><div style="width:${(counts[k]/total)*100}%;background:${k==='critical'?'#DC2626':k==='high'?'linear-gradient(90deg,#FF6B35,#F59E0B)':k==='medium'?'#F59E0B':'#38BDF8'}"></div></div><span style="width:28px;text-align:right;font-family:JetBrains Mono,monospace">${counts[k]||0}</span></div>`).join('')}
    </div>
    <div style="margin-top:12px;font-size:12px;color:#64748B">Top rules: ${byRule.map(([r,c])=>`${r} (${c})`).join(' • ') || '—'}</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 24px">
  <div class="card" style="animation-delay:200ms">
    <div style="font-size:11px;letter-spacing:0.12em;color:#64748B;font-weight:700">MANIFEST</div>
    <div style="margin-top:10px;font-size:13px;font-family:JetBrains Mono,monospace;line-height:1.8">
      publisher: <b>${manifest.publisher || result.publisher}</b><br>name: <b>${manifest.name || result.name}</b><br>version: <b>${manifest.version || result.version}</b><br>engines: <b>${manifest.engines?.vscode || '—'}</b><br>activation: <b>${(manifest.activationEvents||[]).join(', ') || '—'}</b>
    </div>
  </div>
  <div class="card" style="animation-delay:260ms;background:linear-gradient(135deg,#FFFBEB,#FFF7ED);border-color:#FDE68A">
    <div style="font-size:11px;letter-spacing:0.12em;color:#92400E;font-weight:700">ACTION PLAN</div>
    <ul style="margin:10px 0 0 18px;font-size:13px;line-height:1.7">
      ${result.status==='BLOCK' ? `<li><b>Block publish</b> — fix critical/high first</li><li>Add allowlist for shell, remove eval</li><li>Verify images are not PE/ELF</li>` : result.status==='WARN' ? `<li>Review medium/high</li><li>http → https, commit lockfile</li><li>Add telemetry opt-out</li>` : `<li>Keep SARIF in CI</li><li>Enable --strict</li>`}
      <li style="color:#64748B">Exit ${result.status==='BLOCK'?2:result.status==='WARN'?1:0} — wire to GitHub Actions</li>
    </ul>
  </div>
</div>

<div class="card" style="margin:0 24px;animation-delay:320ms">
  <div style="font-size:11px;letter-spacing:0.12em;color:#64748B;font-weight:700">FINDINGS — DETAILED</div>
  <table style="margin-top:12px"><tr><th>Severity</th><th>Rule</th><th>Message</th><th>File</th></tr>${result.findings.map(f=>`<tr><td><span class="sev-${f.severity}">${f.severity.toUpperCase()}</span></td><td style="font-family:JetBrains Mono,monospace;font-size:12px">${f.rule}</td><td>${f.message}</td><td style="font-family:JetBrains Mono,monospace;font-size:11px;color:#64748B">${f.location?.file||''}</td></tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:24px">✅ Clean — no findings</td></tr>`}</table>
  <div style="margin-top:12px;font-size:12px;color:#64748B">Generated client-side — no data leaves your browser. Printable, shareable, auditable. • <a href="https://github.com/madankumargs/vsixgate">vsixgate v0.1.0</a></div>
</div>

<div style="text-align:center;padding:24px;font-size:12px;color:#64748B">© vsixgate — pre-publish scanner • <span style="font-family:JetBrains Mono,monospace">vsixgate scan ${result.publisher}.${result.name} --format sarif --out results.sarif</span></div>
</body>
</html>`

  const openHtml = ()=>{
    const w = window.open('','_blank')
    if(!w) return
    w.document.write(html); w.document.close()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="text-sm font-semibold flex items-center gap-2"> <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse"/> HTML dashboard — animated & printable</div>
        <div className="flex gap-2">
          <button onClick={openHtml} className="rounded-full bg-slate-900 text-white px-4 py-1.5 text-xs font-bold hover:bg-black transition">Open HTML</button>
          <button onClick={()=> { const blob=new Blob([html],{type:'text/html'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=`vsixgate-${result.publisher}.${result.name}-${result.version}.html`; a.click(); URL.revokeObjectURL(u)}} className="rounded-full bg-white border px-4 py-1.5 text-xs font-bold hover:bg-slate-50">Download HTML</button>
          <button onClick={()=> window.print()} className="rounded-full bg-amber-500 text-white px-4 py-1.5 text-xs font-bold hover:bg-amber-600">Print</button>
        </div>
      </div>

      <div className={`rounded-[20px] p-[1px] bg-gradient-to-br ${statusGradient} animate-[pulse_3s_ease-in-out_infinite]`}>
        <div className="rounded-[19px] bg-white p-4 flex gap-4 items-center">
          <div className="h-16 w-16 rounded-full grid place-items-center text-white font-black text-xl shadow-lg" style={{ background: `conic-gradient(${scoreColor} ${result.score*3.6}deg, #E2E8F0 0)` }}>
            <span className="h-12 w-12 rounded-full bg-white text-ink-900 grid place-items-center text-sm">{result.score}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className={`inline-flex text-xs px-2 py-1 rounded-full font-bold bg-gradient-to-r ${statusGradient} text-white`}>{result.status} • {result.score}/100</div>
            <div className="mt-1 text-sm font-mono truncate">{result.publisher}.{result.name}@{result.version}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(['critical','high','medium','low','info'] as const).filter(k=> counts[k]>0).map(k=> <span key={k} className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-900 text-white font-mono">{k} {counts[k]}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-2xl border bg-white p-4 hover:shadow-md transition">
          <div className="text-xs tracking-widest text-ink-400 font-bold">SCORE</div>
          <div className="mt-2 text-3xl font-bold transition-all">{result.score}<span className="text-sm font-normal text-ink-400">/100</span></div>
          <div className={`mt-1 inline-flex text-xs px-2 py-1 rounded-full font-bold ${result.status==='BLOCK'?'bg-red-600 text-white':result.status==='WARN'?'bg-amber-500 text-white':'bg-emerald-600 text-white'}`}>{result.status}</div>
          <div className="mt-3 space-y-1.5 text-xs">
            {(['critical','high','medium','low','info'] as const).map(k=> counts[k]>0 && <div key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-mono">{counts[k]}</span></div>)}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 md:col-span-2 hover:shadow-md transition">
          <div className="text-xs tracking-widest text-ink-400 font-bold">SEVERITY DISTRIBUTION</div>
          <div className="mt-3 space-y-2">
            {(['critical','high','medium','low'] as const).map(k=>(
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-16 capitalize">{k}</span>
                {bar(counts[k], total, k==='critical'?'#DC2626':k==='high'?'#FF6B35':k==='medium'?'#F59E0B':'#38BDF8')}
                <span className="w-8 text-right font-mono">{counts[k]||0}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-ink-500">Top rules: {byRule.map(([r,c])=> `${r} (${c})`).join(' • ') || '—'}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-white p-4 hover:shadow-md transition">
          <div className="text-xs tracking-widest text-ink-400 font-bold">MANIFEST</div>
          <div className="mt-2 text-sm space-y-1 font-mono">
            <div>publisher: <b>{manifest.publisher || result.publisher}</b></div>
            <div>name: <b>{manifest.name || result.name}</b></div>
            <div>version: <b>{manifest.version || result.version}</b></div>
            <div>engines: <b>{manifest.engines?.vscode || '—'}</b></div>
            <div>activationEvents: <b>{(manifest.activationEvents||[]).join(', ') || '—'}</b></div>
          </div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-amber-50 to-white p-4 hover:shadow-md transition">
          <div className="text-xs tracking-widest text-amber-700 font-bold">ACTION PLAN</div>
          <ul className="mt-2 text-sm list-disc pl-5 space-y-1 text-ink-700">
            {result.status==='BLOCK' ? <><li>Block publish — fix critical/high first</li><li>Add allowlist for shell args, remove eval</li><li>Verify images are not PE/ELF</li></> : result.status==='WARN' ? <><li>Review medium/high, add mitigations</li><li>Switch http → https</li><li>Commit lockfile</li></> : <><li>Keep SARIF in CI</li><li>Enable --strict</li></>}
            <li className="text-xs text-ink-400">Exit code {result.status==='BLOCK'?2:result.status==='WARN'?1:0} — wire to GitHub Actions</li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden hover:shadow-md transition">
        <div className="px-4 py-3 border-b bg-slate-50 text-sm font-semibold">Findings table</div>
        <div className="overflow-auto max-h-[320px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-ink-400 sticky top-0"><tr><th className="text-left p-2">Severity</th><th className="text-left p-2">Rule</th><th className="text-left p-2">Message</th></tr></thead>
            <tbody className="divide-y">
              {result.findings.map((f,i)=>(
                <tr key={i} className="hover:bg-amber-50/50 transition"><td className="p-2"><span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${f.severity==='critical'?'bg-red-600 text-white':f.severity==='high'?'bg-gradient-to-r from-brand-500 to-amber-500 text-white':f.severity==='medium'?'bg-amber-100 text-amber-800 border':'bg-slate-100 border'}`}>{f.severity}</span></td><td className="p-2 font-mono text-xs">{f.rule}</td><td className="p-2 text-xs">{f.message}</td></tr>
              ))}
              {result.findings.length===0 && <tr><td colSpan={3} className="p-6 text-center text-sm text-ink-500">Clean — no findings</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-xs text-ink-400 text-center">Animated dashboard — colours, gradients & glow in the HTML file. No data leaves your browser.</div>
    </div>
  )
}
