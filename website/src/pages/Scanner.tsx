import { useCallback, useState } from 'react'
import { scanVsixBuffer, type ScanResult } from '../lib/scanner'
import { fetchVsixBufferById, POPULAR_EXTENSIONS, type Registry } from '../lib/marketplace'
import { Link } from 'react-router-dom'
import ReportView from '../components/ReportView'
import ExtensionSearch from '../components/ExtensionSearch'
import { SCAN_LIMITS, checkRateLimit, timeUntilNextScan, isValidExtensionId } from '../lib/security'

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
    if (file.size > SCAN_LIMITS.maxVsixBytes) { setError(`File too large (${(file.size/1024/1024).toFixed(1)}MB). Max 30MB.`); return }
    if (!checkRateLimit()) { setError(`Rate limited — try again in ${timeUntilNextScan()}s`); return }
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
    const target = (id || extId).trim().slice(0,120)
    if(!target) { setError('Enter an extension ID like esbenp.prettier-vscode or a marketplace URL'); return }
    if (!/^https?:\/\//i.test(target) && !isValidExtensionId(target)) { setError('Invalid ID. Use publisher.extension (e.g. esbenp.prettier-vscode)'); return }
    if (!checkRateLimit()) { setError(`Rate limited — try again in ${timeUntilNextScan()}s`); return }
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

  // report handled by ReportView — keeps UI readable and valuable (summary + top 3 + collapsed details)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl">Live Scanner</h1>
          <p className="mt-2 text-ink-600 max-w-2xl">Scan <span className="font-semibold text-ink-900">any of 50k+ published extensions</span> by name — or drag-drop a .vsix. Runs <span className="font-semibold text-ink-900">entirely in your browser</span> (no upload). <span className="bg-amber-100 px-1 rounded">Why it works for all:</span> we fetch the real .vsix from Open VSX / Marketplace and run the same 8-stage pipeline locally.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadDemo} className="rounded-full bg-white border px-4 py-2 text-sm font-semibold">Load demo.vsix</button>
          <Link to="/examples" className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">See 10 examples</Link>
        </div>
      </div>
      <div className="mt-6 rounded-2xl bg-white border p-4 shadow-soft">
        <div className="text-xs tracking-widest font-bold text-ink-400">SEARCH ALL PUBLISHED EXTENSIONS</div>
        <div className="mt-2"><ExtensionSearch onSelect={(id)=> scanById(id)} /></div>
        <div className="mt-2 text-xs text-ink-500">Type “python”, “docker”, “theme” — searches Open VSX index live (50k+ extensions). Or paste any <code className="bg-slate-100 px-1 rounded">publisher.extension</code> below (even those not in the 12 quick chips).</div>
      </div>

      <div className="mt-4 rounded-2xl bg-gradient-to-br from-amber-50 to-white border border-amber-200 p-4">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-400 text-white grid place-items-center font-bold">∞</div>
          <div>
            <div className="font-bold text-amber-900">Better reason: why scanning <em>any</em> extension matters — not just the 10 examples</div>
            <p className="mt-1 text-sm text-ink-600 leading-relaxed">Every extension is a full Node.js app running in your editor with access to files, terminals, and network. The marketplace hosts <b>~45k VS Code + 5k Open VSX</b> extensions — attackers hide typosquats (<code className="bg-white px-1 rounded border">lodashh</code> vs <code className="bg-white px-1 rounded border">lodash</code>), disguised binaries, and malicious updates among them. Previous tools only checked their own dashboard. <b>vsixgate fetches the real published .vsix by ID and scans it locally</b> (no backend, no key): so you can vet <b>any dependency before you `code --install-extension`</b>, gate your own release, or audit a customer’s stack. That’s the pre-publish shift-left.</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className="px-2 py-1 rounded-full bg-white border">Supply-chain vetting</span>
              <span className="px-2 py-1 rounded-full bg-white border">Pre-install check</span>
              <span className="px-2 py-1 rounded-full bg-white border">Update diff</span>
              <span className="px-2 py-1 rounded-full bg-white border">No upload, no tracking</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-slate-900 text-slate-300 px-4 py-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-white">🔒 Hardened</span>
        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">CSP + X-Frame DENY + HSTS</span>
        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">XSS escape + input validation</span>
        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">Zip-bomb + zip-slip guard</span>
        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">SSRF allowlist + timeout</span>
        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">Rate limit 1/2s + 30MB cap</span>
        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">No cookies • No tracking</span>
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
        <div className="mt-8">
          <ReportView result={result} />
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <div className="font-semibold text-amber-900">Next — gate your CI</div>
            <div className="mt-2 font-mono text-xs bg-white border rounded-xl p-3 leading-relaxed">
              vsixgate scan {(result as any).registry ? `${result.publisher}.${result.name} --registry ${(result as any).registry==='open-vsx'?'openvsx':'vscode'}` : './ext.vsix'} --format sarif --out results.sarif<br/>
              <span className="opacity-60"># exit 0 PASS • 1 WARN • 2 BLOCK — wire to GitHub Actions</span>
            </div>
            <Link to="/examples/glassworm-update" className="mt-3 inline-flex text-sm font-semibold text-amber-900 hover:underline">See GlassWorm update example →</Link>
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
