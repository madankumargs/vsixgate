import { useState, useRef, useEffect } from 'react'
import { retrieve, isOutOfScope, generateAnswer } from '../lib/rag'
import { scanVsixBuffer } from '../lib/scanner'
import { fetchVsixBufferById } from '../lib/marketplace'
import { useNavigate } from 'react-router-dom'

interface Msg { role: 'user' | 'agent'; text: string; sources?: string[]; thinking?: string }

function extractScanTarget(text: string): string | null {
  const t = text.trim()
  // "scan esbenp.prettier-vscode" or "scan https://..." or just "esbenp.prettier-vscode"
  const scanMatch = t.match(/scan\s+([^\s]+)/i)
  if (scanMatch) return scanMatch[1].replace(/^[<"]|[>"]$/g, '')
  if (/^[a-z0-9_.-]+\.[a-z0-9_.-]+(@[\d.]+)?$/i.test(t)) return t
  if (/^https?:\/\/\S+\.vsix/i.test(t)) return t
  if (/itemName=/.test(t)) return t
  return null
}

export default function AgentChat(){
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([
    { role:'agent', text: `Hi — I'm the vsixgate RAG agent. I only know this website (pipeline, 10 examples, CLI, reports, enterprise). Ask me anything about vsixgate, or say "scan esbenp.prettier-vscode" and I'll fetch & scan it right here.`, sources: ['/','/scan','/examples'] }
  ])
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(()=>{
    const h = (e: any) => { setOpen(true); if(e.detail) setInput(String(e.detail)) }
    window.addEventListener('open-agent', h as any); return ()=> window.removeEventListener('open-agent', h as any)
  },[])

  useEffect(()=>{ listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior:'smooth'}) },[msgs, busy])

  const send = async ()=>{
    const q = input.trim()
    if(!q || busy) return
    setMsgs(m=> [...m, { role:'user', text: q }])
    setInput('')
    setBusy(true)

    // scan intent
    const target = extractScanTarget(q)
    if(target){
      const thinking = `Intent: scan → ${target}. Will fetch via marketplace helper (open-vsx preferred), then run scanVsixBuffer (JSZip heuristics) entirely in browser.`
      setMsgs(m=> [...m, { role:'agent', text:`Got it — scanning \`${target}\` for you…`, thinking }])
      try{
        const fetched = await fetchVsixBufferById(target, { registry:'auto' })
        const scanned = await scanVsixBuffer(fetched.buffer)
        const summary = `**${scanned.publisher}.${scanned.name}@${scanned.version} — ${scanned.status} ${scanned.score}/100** (${fetched.registry}, ${scanned.findings.length} findings)\n\n` +
          scanned.findings.slice(0,5).map(f=> `• [${f.severity.toUpperCase()}] ${f.rule}: ${f.message}`).join('\n') +
          (scanned.findings.length>5? `\n• …and ${scanned.findings.length-5} more` : '') +
          `\n\nSource: ${fetched.downloadUrl}\nGo to Scanner for full JSON/SARIF export.`
        setMsgs(m=> [...m, { role:'agent', text: summary, sources:[`/scan`], thinking: `Scan done: score ${scanned.score}, status ${scanned.status}. Findings: ${scanned.findings.map(f=>f.rule).join(', ')}` }])
      }catch(e:any){
        setMsgs(m=> [...m, { role:'agent', text:`Couldn't fetch/scan \`${target}\`: ${e.message}. Tip: try Open VSX ID or drag-drop the .vsix, or run CLI: \`vsixgate scan ${target} --registry openvsx\``, thinking: `Fetch failed: ${e.message}. Likely CORS or not found on Open VSX.` }])
      }
      setBusy(false)
      return
    }

    // navigation intents
    if(/example|gallery/i.test(q)){ navigate('/examples'); setMsgs(m=> [...m, {role:'agent', text:'Opened the examples gallery — 10 scanned extensions with findings & SARIF. Click any card for detail. ', sources:['/examples']}]) ; setBusy(false); return }
    if(/scan.*page|live scanner/i.test(q)){ navigate('/scan'); setMsgs(m=> [...m, {role:'agent', text:'Opened the Live Scanner — paste publisher.extension or drop a .vsix. Try "scan esbenp.prettier-vscode".', sources:['/scan']}]) ; setBusy(false); return }

    // RAG
    if(isOutOfScope(q)){
      setMsgs(m=> [...m, {role:'agent', text:`I can only help with **vsixgate website context** (scanner, pipeline, reports, examples, CLI, enterprise). Your question looks out of scope. Try: "How does the diff engine work?" or "scan ms-python.python" or "What SARIF level does high map to?"`, thinking: `Out-of-scope guard: query lacks vsixgate hints and matches generic pattern. Refusing to answer outside web context.` }])
      setBusy(false); return
    }
    const chunks = retrieve(q, 3)
    const answer = generateAnswer(q, chunks)
    const thinking = `RAG: token-overlap retrieval over ${chunks.length} chunks → [${chunks.map(c=>c.id).join(', ')}]. Answer constrained to those chunks only.`
    setMsgs(m=> [...m, {role:'agent', text: answer, sources: chunks.map(c=> c.url), thinking }])
    setBusy(false)
  }

  return (
    <>
      <button onClick={()=> setOpen(o=>!o)} className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-slate-900 text-white shadow-xl grid place-items-center hover:bg-black border border-white/10">
        <span className="text-xl">◈</span>
        {!open && <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-400 text-[11px] font-bold text-amber-900 grid place-items-center">AI</span>}
      </button>

      {open && (
        <div className="fixed bottom-[76px] right-4 z-50 w-[380px] max-w-[92vw] h-[520px] rounded-[20px] border bg-white shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white text-slate-900 grid place-items-center font-bold">◈</div>
            <div className="leading-tight">
              <div className="font-semibold text-sm">vsixgate agent</div>
              <div className="text-[11px] text-slate-400">RAG • web-context only • can scan</div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <button onClick={()=> setOpen(false)} className="ml-2 h-7 w-7 rounded-full bg-white/10 grid place-items-center">✕</button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-3 bg-slate-50">
            {msgs.map((m,i)=>(
              <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${m.role==='user'?'ml-auto bg-slate-900 text-white':'bg-white border shadow-soft text-ink-800'}`}>
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
                {m.thinking && <details className="mt-2 text-xs"><summary className="cursor-pointer text-ink-400">thinking</summary><div className="mt-1 font-mono bg-slate-50 border rounded-lg p-2 text-[11px] text-ink-600">{m.thinking}</div></details>}
                {m.sources && <div className="mt-2 flex flex-wrap gap-1">{m.sources.map(s=> <span key={s} className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">{s}</span>)}</div>}
              </div>
            ))}
            {busy && <div className="bg-white border rounded-2xl px-3 py-2.5 text-sm text-ink-500 inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"/>Thinking…</div>}
          </div>

          <div className="p-2 border-t bg-white">
            <div className="flex gap-2">
              <input value={input} onChange={e=> setInput(e.target.value)} onKeyDown={e=> e.key==='Enter' && send()} placeholder='Ask about vsixgate or "scan esbenp.prettier-vscode"' className="flex-1 rounded-full border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              <button onClick={send} disabled={busy} className="rounded-full bg-brand-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Send</button>
            </div>
            <div className="mt-1.5 flex gap-1.5 text-[11px]">
              <button onClick={()=> setInput('How does the diff engine catch GlassWorm?')} className="px-2 py-1 rounded-full bg-slate-100 border hover:bg-white">Diff engine?</button>
              <button onClick={()=> setInput('scan esbenp.prettier-vscode')} className="px-2 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-800 hover:bg-amber-200">Scan demo</button>
              <button onClick={()=> setInput('What SARIF level does high map to?')} className="px-2 py-1 rounded-full bg-slate-100 border hover:bg-white">SARIF?</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
