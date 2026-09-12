import { useEffect, useState } from 'react'
import { searchExtensions } from '../lib/marketplace'

export default function ExtensionSearch({ onSelect }: { onSelect: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchExtensions>>>([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    if(q.trim().length < 2){ setResults([]); return }
    const t = setTimeout(async ()=>{
      setLoading(true)
      const r = await searchExtensions(q, 8)
      setResults(r)
      setLoading(false)
    }, 320)
    return ()=> clearTimeout(t)
  },[q])

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            value={q}
            onChange={e=> setQ(e.target.value)}
            placeholder="Search any published extension — e.g. python, docker, theme…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">searching…</span>}
        </div>
        <span className="hidden sm:inline text-xs text-ink-400">~50k+ extensions via Open VSX & Marketplace</span>
      </div>
      {results.length>0 && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border bg-white shadow-xl overflow-hidden max-h-[320px] overflow-auto">
          {results.map(r=>(
            <button key={r.id} onClick={()=> { onSelect(r.id); setQ(''); setResults([]) }} className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b last:border-0 flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 border grid place-items-center text-sm">◈</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{r.displayName} <span className="font-mono text-xs text-ink-400">{r.id}</span></div>
                <div className="text-xs text-ink-500 truncate">{r.description || 'No description'}</div>
              </div>
              <span className="text-xs font-mono text-ink-400 shrink-0">{r.version}</span>
            </button>
          ))}
          <div className="px-4 py-2 text-[11px] text-ink-400 bg-slate-50">Results from Open VSX search — click to scan. Any publisher.extension also works via direct ID above.</div>
        </div>
      )}
      {q && !loading && results.length===0 && q.length>=2 && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border bg-white p-3 text-sm text-ink-500">No results for “{q}” — try full ID like esbenp.prettier-vscode</div>
      )}
    </div>
  )
}
