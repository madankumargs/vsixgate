import { useCallback, useState, useEffect } from 'react'
import { scanVsixBuffer, type ScanResult } from '../lib/scanner'
import { fetchVsixBufferById, fetchVersions, POPULAR_EXTENSIONS, searchExtensions, type Registry } from '../lib/marketplace'
import { Link } from 'react-router-dom'
import ReportView from '../components/ReportView'
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
  const [suggestions, setSuggestions] = useState<Awaited<ReturnType<typeof searchExtensions>>>([])
  const [showSug, setShowSug] = useState(false)
  const [versions, setVersions] = useState<string[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [versionsLoading, setVersionsLoading] = useState(false)

  // autocomplete for 50k extensions — integrated with single bar
  useEffect(()=>{
    if(extId.trim().length < 2 || extId.includes('.') || /^https?:\/\//.test(extId)){ setSuggestions([]); return }
    const t = setTimeout(async ()=>{
      const r = await searchExtensions(extId, 6)
      setSuggestions(r); setShowSug(r.length>0)
    }, 300)
    return ()=> clearTimeout(t)
  },[extId])

  // version/release discovery — when extId is publisher.name
  const loadVersions = useCallback(async (id: string)=>{
    const clean = id.split('@')[0].split(':')[0]
    if(!clean.includes('.')) return
    const [pub, ...rest] = clean.split('.'); const name = rest.join('.')
    if(!pub || !name) return
    setVersionsLoading(true)
    const vers = await fetchVersions(pub, name, registry)
    setVersions(vers)
    if(vers.length) setSelectedVersion(vers[0])
    setVersionsLoading(false)
  },[registry])

  useEffect(()=>{
    if(extId.includes('.') && !extId.includes(' ') && !/^https?:\/\//.test(extId)){
      const t = setTimeout(()=> loadVersions(extId), 500)
      return ()=> clearTimeout(t)
    } else {
      setVersions([]); setSelectedVersion('')
    }
  },[extId, loadVersions])

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

  const scanById = useCallback(async (id?: string, forcedVersion?: string)=>{
    let target = (id || extId).trim().slice(0,120)
    if(!target) { setError('Enter an extension ID like esbenp.prettier-vscode'); return }
    // if version selected, append @version
    const ver = forcedVersion || selectedVersion
    if(ver && !target.includes('@') && !target.includes(':') && !/^https?:\/\//.test(target)){
      target = `${target}@${ver}`
    }
    if (!/^https?:\/\//i.test(target) && !isValidExtensionId(target)) { setError('Invalid ID. Use publisher.extension'); return }
    if (!checkRateLimit()) { setError(`Rate limited — try again in ${timeUntilNextScan()}s`); return }
    setShowSug(false); setSuggestions([])
    setError(null); setResult(null); setLoading(true); setFileName(target); setProgress('Resolving…')
    try{
      const fetched = await fetchVsixBufferById(target, { registry, onProgress: (p)=> setProgress(`${p.stage}…`) })
      setProgress(`Scanning ${fetched.publisher}.${fetched.name}…`)
      const scanned = await scanVsixBuffer(fetched.buffer)
      if(scanned.publisher==='unknown' ) (scanned as any).publisher = fetched.publisher
      if(scanned.name==='unknown') (scanned as any).name = fetched.name
      if(scanned.version==='0.0.0') (scanned as any).version = fetched.resolvedVersion
      ;(scanned as any).downloadUrl = fetched.downloadUrl
      ;(scanned as any).registry = fetched.registry
      setResult(scanned)
      setFileName(`${fetched.publisher}.${fetched.name}@${fetched.resolvedVersion}`)
    }catch(e:any){
      const msg = e.message || String(e)
      if(msg.includes('CORS') || msg.includes('Failed to fetch')){
        setError(msg + ' Tip: try Open VSX or drag-drop .vsix. CLI: vsixgate scan ' + target)
      } else setError(msg)
    } finally { setLoading(false); setProgress('') }
  },[extId, registry])

  const loadDemo = async ()=>{
    try{
      setLoading(true); setError(null); setProgress('Loading demo…')
      const res = await fetch('/demo.vsix')
      if(!res.ok) throw new Error('Demo not found. Drop your .vsix.')
      const buf = await res.arrayBuffer()
      const r = await scanVsixBuffer(buf)
      setFileName('demo.vsix'); setResult(r)
    } catch(e:any){ setError(e.message)} finally{ setLoading(false); setProgress('')}
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      {/* minimal header */}
      <div className="text-center">
        <h1 className="font-display font-bold text-[28px] tracking-tight">Scanner</h1>
        <p className="mt-1 text-sm text-ink-600">Search any of 50k+ extensions or drop a .vsix. Everything runs in your browser.</p>
      </div>

      {/* single integrated search — fixes two bars */}
      <div className="mt-6 rounded-2xl border bg-white p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">⦿</span>
            <input
              value={extId}
              onChange={e=> setExtId(e.target.value)}
              onFocus={()=> suggestions.length && setShowSug(true)}
              onBlur={()=> setTimeout(()=> setShowSug(false), 180)}
              onKeyDown={e=> e.key==='Enter' && scanById()}
              placeholder="esbenp.prettier-vscode  or  python → search all"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl border bg-slate-50 focus:bg-white placeholder:text-ink-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            {showSug && suggestions.length>0 && (
              <div className="absolute z-20 mt-2 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
                {suggestions.map(s=>(
                  <button key={s.id} onMouseDown={e=> e.preventDefault()} onClick={()=> { setExtId(s.id); setShowSug(false); scanById(s.id) }} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex gap-2 items-center text-sm">
                    <span className="h-6 w-6 rounded bg-slate-100 grid place-items-center text-xs">◈</span>
                    <span className="flex-1 min-w-0"><span className="font-semibold">{s.displayName}</span> <span className="font-mono text-xs text-ink-400">{s.id}</span><div className="text-xs text-ink-500 truncate">{s.description}</div></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select value={registry} onChange={e=> setRegistry(e.target.value as Registry)} className="rounded-xl border bg-white px-2.5 py-2.5 text-xs font-semibold">
            <option value="auto">Auto</option>
            <option value="openvsx">Open VSX</option>
            <option value="marketplace">Marketplace</option>
          </select>
          <button onClick={()=> scanById()} disabled={loading} className="rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50">Scan</button>
        </div>

        {/* version/release picker — scan any published version */}
        {versions.length>0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-ink-600">Version</span>
            <select value={selectedVersion} onChange={e=> setSelectedVersion(e.target.value)} className="rounded-full border bg-white px-3 py-1.5 text-xs font-mono">
              {versions.map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
            <span className="text-ink-400">{versionsLoading? 'loading…': `${versions.length} releases`}</span>
            <span className="text-ink-400">• try <button onClick={()=> scanById(extId.split('@')[0], versions[versions.length-1])} className="underline">oldest</button> vs <button onClick={()=> scanById(extId.split('@')[0], versions[0])} className="underline">latest</button> to see diff</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {POPULAR_EXTENSIONS.slice(0,6).map(p=>(
            <button key={p.id} onClick={()=> scanById(p.id)} className="rounded-full border bg-slate-50 px-2.5 py-1 text-xs hover:bg-white">{p.icon} {p.label}</button>
          ))}
          <button onClick={loadDemo} className="rounded-full border bg-white px-2.5 py-1 text-xs">Demo</button>
          <Link to="/examples" className="rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 text-xs">10 examples</Link>
        </div>

        {(progress || loading) && <div className="mt-3 text-xs font-mono text-ink-500 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"/>{progress}</div>}
        {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-2.5 text-sm text-red-700">{error}</div>}
        {fileName && !error && !loading && <div className="mt-2 text-xs font-mono text-ink-400 truncate">{fileName}</div>}
      </div>

      {/* minimal why - single line */}
      <div className="mt-3 text-center text-xs text-ink-500">Any publisher.extension — 50k+ via Open VSX. Fetches real .vsix and scans locally. <Link to="/examples/glassworm-update" className="underline">Why it matters →</Link></div>

      {/* minimal drop */}
      <div
        onDragOver={e=>{e.preventDefault(); setDragOver(true)}}
        onDragLeave={()=> setDragOver(false)}
        onDrop={onDrop}
        className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center ${dragOver?'bg-amber-50 border-amber-300':'bg-white border-slate-200'}`}
      >
        <div className="text-sm font-semibold">Drop .vsix here</div>
        <div className="text-xs text-ink-500 mt-1">or</div>
        <label className="mt-2 inline-flex rounded-full border bg-white px-4 py-1.5 text-xs font-semibold cursor-pointer hover:bg-slate-50">
          <input type="file" accept=".vsix,.zip" className="hidden" onChange={onInput} />Choose file
        </label>
      </div>

      {result && (
        <div className="mt-6">
          <ReportView result={result} />
          <div className="mt-3 text-xs text-center text-ink-400">View Dashboard tab above for HTML — Open HTML / Download / Print. No data leaves your browser.</div>
          <div className="mt-3 rounded-xl bg-slate-50 border p-3 font-mono text-xs">
            vsixgate scan {(result as any).registry ? `${result.publisher}.${result.name} --registry ${(result as any).registry==='open-vsx'?'openvsx':'vscode'}` : './ext.vsix'} --format sarif --out results.sarif
          </div>
        </div>
      )}

      <details className="mt-6 rounded-xl border bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold">How browser scan differs from CLI</summary>
        <div className="mt-2 grid sm:grid-cols-2 gap-3 text-xs text-ink-600">
          <div><b>In-browser</b>: fetch, unpack, manifest, taint, signatures, typosquat, score, HTML dashboard.</div>
          <div><b>CLI-only</b>: OSV live, SQLite diff (newInThisVersion), Semgrep/YARA, --strict, exit codes.</div>
        </div>
      </details>
    </div>
  )
}
