import { useCallback, useState } from 'react'
import { scanVsixBuffer, type ScanResult } from '../lib/scanner'
import { fetchVsixBufferById, POPULAR_EXTENSIONS, type Registry } from '../lib/marketplace'
import ScoreRing from '../components/ScoreRing'
import { Link } from 'react-router-dom'

function sevBadge(s:string){
  if(s==='critical') return 'bg-red-600 text-white'
  if(s==='high') return 'bg-orange-500 text-white'
  if(s==='medium') return 'bg-amber-400 text-amber-900'
  if(s==='low') return 'bg-sky-100 text-sky-800 border'
  return 'bg-slate-100 text-slate-700 border'
}

export default function Scanner(){
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState<string>('')
  const [extId, setExtId] = useState('')
  const [registry, setRegistry] = useState<Registry>('auto')
  const [urlMode, setUrlMode] = useState(false)

  const handleFile = useCallback(async (file: File)=>{
    setError(null); setResult(null); setLoading(true); setFileName(file.name); setProgress('Unpacking & scanning…')
    try {
      const buf = await file.arrayBuffer()
      const res = await scanVsixBuffer(buf)
      setResult(res)
    } catch(e:any){ setError(e.message || String(e)) }
    finally { setLoading(false); setProgress('') }
  },[])

  const onDrop = useCallback((e: React.DragEvent)=>{
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if(f) handleFile(f)
  },[handleFile])

  const onInput = useCallback((e: React.ChangeEvent<HTMLInputElement>)=>{
    const f = e.target.files?.[0]
    if(f) handleFile(f)
  },[handleFile])

  const scanById = useCallback(async (id?: string)=>{
    const target = (id || extId).trim()
    if(!target) { setError('Enter an extension ID like esbenp.prettier-vscode or a marketplace URL'); return }
    setError(null); setResult(null); setLoading(true); setFileName(target); setProgress('Resolving extension…')
    try{
      const fetched = await fetchVsixBufferById(target, { registry, onProgress: (p)=> setProgress(`${p.stage}…`) })
      setProgress(`Scanning ${fetched.publisher}.${fetched.name}@${fetched.resolvedVersion}…`)
      const scanned = await scanVsixBuffer(fetched.buffer)
      // prefer fetched metadata if manifest missing
      if(scanned.publisher==='unknown' ) (scanned as any).publisher = fetched.publisher
      if(scanned.name==='unknown') (scanned as any).name = fetched.name
      if(scanned.version==='0.0.0') (scanned as any).version = fetched.resolvedVersion
      ;(scanned as any).downloadUrl = fetched.downloadUrl
      ;(scanned as any).registry = fetched.registry
      setResult(scanned)
      setFileName(`${fetched.publisher}.${fetched.name}@${fetched.resolvedVersion} via ${fetched.registry}`)
    }catch(e:any){
      const msg = e.message || String(e)
      // Enhance CORS hint
      if(msg.includes('CORS') || msg.includes('Failed to fetch')){
        setError(msg + ' Tip: try switching registry (Open VSX ↔ Marketplace) or download the .vsix manually and drag-drop it. CLI always works: vsixgate scan ' + target + ' --registry ' + (registry==='openvsx'?'openvsx':'vscode'))
      } else {
        setError(msg)
      }
    } finally { setLoading(false); setProgress('') }
  },[extId, registry])

  const loadDemo = async ()=>{
    try{
      setLoading(true); setError(null); setProgress('Loading demo.vsix…')
      const res = await fetch('/demo.vsix')
      if(!res.ok) throw new Error('Demo vsix not found. Please drop your own .vsix file.')
      const buf = await res.arrayBuffer()
      const r = await scanVsixBuffer(buf)
      setFileName('demo.vsix'); setResult(r)
    } catch(e:any){ setError(e.message)} finally{ setLoading(false); setProgress('')}
  }

  const jsonReport = result ? JSON.stringify({ manifest: result.manifest, findings: result.findings, scoring: { counts: result.findings.reduce((a:any,f)=>{a[f.severity]=(a[f.severity]||0)+1; return a},{critical:0,high:0,medium:0,low:0,info:0}), status: result.status }, score: result.score, source: (result as any).downloadUrl }, null, 2) : ''
  const sarif = result ? JSON.stringify({
    $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json',
    version:'2.1.0',
    runs:[{ tool:{ driver:{ name:'vsixgate', version:'0.1.0' }}, results: result.findings.map(f=>({ ruleId:f.rule, level: f.severity==='critical'||f.severity==='high'?'error': f.severity==='medium'?'warning':'note', message:{ text:f.message }, locations: f.location? [{ physicalLocation:{ artifactLocation:{uri:f.location.file}}}]: undefined })) }]
  }, null, 2) : ''

  const counts = result ? result.findings.reduce((a:any,f)=>{ a[f.severity]++ ; return a},{critical:0,high:0,medium:0,low:0,info:0} as any) : null

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl">Live Scanner</h1>
          <p className="mt-2 text-ink-600 max-w-2xl">Scan by <span className="font-semibold text-ink-900">extension name</span> (no .vsix needed) or drag-drop a file. Runs <span className="font-semibold text-ink-900">entirely in your browser</span> — privacy-first. For full Semgrep/YARA + OSV + SQLite diff, use the CLI.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadDemo} className="rounded-full bg-white border px-4 py-2 text-sm font-semibold">Load demo.vsix</button>
          <Link to="/examples" className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">See 10 examples</Link>
        </div>
      </div>

      {/* SCAN BY NAME */}
      <div className="mt-6 rounded-[24px] bg-slate-900 text-white p-5 sm:p-6 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 to-amber-500/15 pointer-events-none" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white text-slate-900 grid place-items-center font-bold">◈</div>
            <div>
              <div className="font-display font-bold leading-none">Scan by extension name</div>
              <div className="text-xs text-slate-400">No file? Paste any marketplace ID — we fetch the .vsix and scan it here.</div>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs">
              <button onClick={()=>setUrlMode(!urlMode)} className={`px-3 py-1.5 rounded-full border font-semibold ${urlMode?'bg-white text-slate-900':'bg-white/10 text-white border-white/20'}`}>{urlMode? 'ID mode':'URL mode'}</button>
              <span className="hidden sm:inline text-slate-400">Open VSX CORS-friendly • Marketplace may need file fallback</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col lg:flex-row gap-3">
            <div className="flex-1 flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">◈</span>
                <input
                  value={extId}
                  onChange={e=>setExtId(e.target.value)}
                  onKeyDown={e=> e.key==='Enter' && scanById()}
                  placeholder={urlMode ? 'https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode or direct .vsix URL' : 'esbenp.prettier-vscode  •  ms-python.python  •  publisher.extension@1.2.3'}
                  className="w-full pl-9 pr-4 py-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <select value={registry} onChange={e=> setRegistry(e.target.value as Registry)} className="rounded-xl bg-white text-slate-900 px-3 py-3 text-sm font-semibold border-0">
                <option value="auto">Auto</option>
                <option value="openvsx">Open VSX</option>
                <option value="marketplace">Marketplace</option>
              </select>
            </div>
            <button onClick={()=>scanById()} disabled={loading} className="rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-6 py-3 font-bold text-white shadow-glow whitespace-nowrap">
              {loading? 'Scanning…' : 'Scan extension →'}
            </button>
          </div>

          <div className="mt-4">
            <div className="text-xs tracking-widest text-slate-400 font-semibold">TRY ONE CLICK</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {POPULAR_EXTENSIONS.map(p=>(
                <button key={p.id} onClick={()=> { setExtId(p.id); scanById(p.id) }} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white hover:text-slate-900 border border-white/10 px-3 py-1.5 text-xs font-medium transition">
                  <span>{p.icon}</span>{p.label} <span className="opacity-60 font-mono">{p.id}</span>
                </button>
              ))}
            </div>
          </div>

          {(progress || loading) && <div className="mt-4 flex items-center gap-3 text-xs font-mono text-amber-200"><span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"/>{progress || 'Scanning…'}</div>}
          {error && <div className="mt-4 rounded-xl bg-red-500/15 border border-red-500/30 p-3 text-sm text-red-200">{error}</div>}
          {fileName && !error && <div className="mt-3 text-xs font-mono text-slate-400 truncate">{fileName}</div>}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-ink-400">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="px-3 py-1 rounded-full bg-slate-50 border">or drag & drop a .vsix file</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div
        onDragOver={e=>{e.preventDefault(); setDragOver(true)}}
        onDragLeave={()=> setDragOver(false)}
        onDrop={onDrop}
        className={`mt-3 rounded-[24px] border-2 border-dashed p-6 sm:p-8 text-center transition ${dragOver? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}
      >
        <div className="mx-auto max-w-xl">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-gradient-to-br from-brand-400 to-amber-400 grid place-items-center text-white text-xl">⬆</div>
          <div className="mt-3 font-display font-bold text-lg">Drop .vsix here or click to browse</div>
          <div className="text-sm text-ink-600">We unpack client-side with JSZip and run manifest + taint + signatures + typosquat checks. No upload to any server.</div>
          <label className="mt-4 inline-flex cursor-pointer items-center rounded-full bg-slate-900 px-6 py-3 text-white font-semibold hover:bg-black">
            <input type="file" accept=".vsix,.zip" className="hidden" onChange={onInput} />
            Choose .vsix file
          </label>
          {loading && <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full w-1/3 bg-brand-500 animate-pulse" /></div>}
        </div>
      </div>

      {result && (
        <div className="mt-8 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border bg-white p-5 shadow-soft flex gap-4 items-center">
              <ScoreRing score={result.score} size={72} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold truncate">{result.publisher}.{result.name}@{result.version}</div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${result.status==='BLOCK'?'bg-red-600 text-white': result.status==='WARN'?'bg-amber-400 text-amber-900':'bg-emerald-500 text-white'}`}>{result.status}</span>
                  {(result as any).registry && <span className="text-xs px-2 py-1 rounded-full bg-slate-100 border font-mono">{(result as any).registry}</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(counts).map(([k,v])=>(
                    <span key={k} className="text-xs px-2 py-1 rounded-full bg-slate-900 text-white font-mono">{k.toUpperCase()}: {v as number}</span>
                  ))}
                  <span className="text-xs px-2 py-1 rounded-full bg-white border">{result.findings.length} findings</span>
                  <span className={`text-xs px-2 py-1 rounded-full border ${result.hasLockfile?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-amber-50 border-amber-200 text-amber-800'}`}>{result.hasLockfile? 'lockfile present':'no lockfile'}</span>
                </div>
                {(result as any).downloadUrl && <div className="mt-2 text-xs font-mono text-ink-400 truncate">source: {(result as any).downloadUrl}</div>}
              </div>
              <div className="hidden sm:block text-right shrink-0">
                <div className="text-xs tracking-widest text-ink-400 font-semibold">EXIT CODE</div>
                <div className={`text-2xl font-display font-bold ${result.status==='BLOCK'?'text-red-600': result.status==='WARN'?'text-amber-600':'text-emerald-600'}`}>{result.status==='BLOCK'?2: result.status==='WARN'?1:0}</div>
              </div>
            </div>

            <h2 className="font-display font-bold text-lg">Findings — {result.findings.length || 'none 🎉'}</h2>
            {result.findings.length===0 ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
                <div className="text-2xl">✅</div>
                <div className="font-semibold text-emerald-900 mt-2">No findings — clean scan</div>
                <div className="text-sm text-emerald-700">This bundle looks safe under current heuristics. For production, run the CLI with --strict and SARIF upload.</div>
              </div>
            ) : result.findings.map((f,i)=>(
              <div key={i} className="rounded-2xl border bg-white p-4 shadow-soft">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-1 rounded-full font-bold ${sevBadge(f.severity)}`}>{f.severity.toUpperCase()}</span>
                  <span className="font-mono text-sm font-semibold">{f.rule}</span>
                  <span className="ml-auto text-xs text-ink-400 truncate">{f.location?.file}</span>
                </div>
                <div className="mt-2 text-sm">{f.message}</div>
                {(f.legitimateUse || f.redFlag) && (
                  <div className="mt-3 grid sm:grid-cols-2 gap-2 text-xs">
                    {f.legitimateUse && <div className="rounded-xl bg-slate-50 border p-2.5"><b>Legitimate</b>: {f.legitimateUse}</div>}
                    {f.redFlag && <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-red-700"><b>Red flag</b>: {f.redFlag}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-soft">
              <div className="font-semibold">Export</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button onClick={()=> navigator.clipboard.writeText(jsonReport)} className="rounded-xl bg-slate-900 text-white py-2 text-xs font-bold">Copy JSON</button>
                <button onClick={()=> navigator.clipboard.writeText(sarif)} className="rounded-xl bg-white border py-2 text-xs font-bold">Copy SARIF</button>
                <button onClick={()=> {
                  const blob = new Blob([sarif], {type:'application/json'})
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href=url; a.download='results.sarif'; a.click(); URL.revokeObjectURL(url)
                }} className="rounded-xl bg-amber-100 border border-amber-200 py-2 text-xs font-bold text-amber-900">Download SARIF</button>
              </div>
              <div className="mt-3 text-xs text-ink-400">SARIF 2.1.0 — upload via <code className="bg-slate-100 px-1 rounded">github/codeql-action/upload-sarif</code> for PR annotations.</div>
            </div>

            <div className="rounded-2xl bg-slate-900 text-slate-100 p-4">
              <div className="text-xs tracking-widest opacity-60">JSON REPORT</div>
              <pre className="mt-2 max-h-[260px] overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all">{jsonReport.slice(0, 6000)}{jsonReport.length>6000?'…':''}</pre>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
              <div className="font-semibold text-amber-900">Next — gate your CI</div>
              <div className="mt-2 font-mono text-xs bg-white border rounded-xl p-3 leading-relaxed">
                vsixgate scan {(result as any).registry ? `${result.publisher}.${result.name} --registry ${(result as any).registry==='open-vsx'?'openvsx':'vscode'}` : './ext.vsix'} --format sarif --out results.sarif<br/>
                <span className="opacity-60"># exit 0 PASS • 1 WARN • 2 BLOCK</span>
              </div>
              <Link to="/examples/glassworm-update" className="mt-3 inline-flex text-sm font-semibold text-amber-900 hover:underline">See GlassWorm update example →</Link>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 rounded-2xl bg-slate-50 border p-5">
        <div className="font-semibold">What the browser demo covers vs CLI</div>
        <div className="mt-3 grid md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-white border p-4">
            <div className="font-semibold">✅ In-browser (this page)</div>
            <ul className="mt-2 list-disc pl-5 text-ink-600 space-y-1">
              <li>Fetch by name from Open VSX / Marketplace</li>
              <li>Unpack via JSZip, manifest checks</li>
              <li>Taint heuristics (workspace→shell/eval/write)</li>
              <li>Network destinations + insecure http</li>
              <li>Disguised executable (PNG/JPG → MZ/ELF)</li>
              <li>Typosquat (Levenshtein ≤2)</li>
              <li>Score + BLOCK/WARN/PASS + JSON/SARIF export</li>
            </ul>
          </div>
          <div className="rounded-xl bg-white border p-4">
            <div className="font-semibold">🔒 CLI-only (for production gate)</div>
            <ul className="mt-2 list-disc pl-5 text-ink-600 space-y-1">
              <li>OSV API live advisory lookup</li>
              <li>SQLite diff history (newInThisVersion)</li>
              <li>Semgrep/YARA-X rule packs (planned)</li>
              <li>Strict mode, vsixgate.config.json</li>
              <li>Exit codes 0/1/2 for CI gating</li>
              <li>Private registries & marketplace tokens</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 text-xs text-ink-400">CORS note: Open VSX is browser-friendly; Marketplace sometimes blocks direct fetch — if it does, the UI will tell you and you can download the .vsix manually (Extensions → … → Download VSIX) and drag-drop it, or just run the CLI which has no CORS limits.</div>
      </div>
    </div>
  )
}
