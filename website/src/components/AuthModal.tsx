import { useState } from 'react'
import { useAuth } from '../lib/auth'

export default function AuthModal({ open, onClose }: { open:boolean; onClose:()=>void }){
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState<string|null>(null)

  const submit = (e: React.FormEvent)=>{
    e.preventDefault()
    const v = email.trim()
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){ setErr('Enter a valid email'); return }
    signIn(v); onClose(); setEmail(''); setErr(null)
  }

  if(!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={e=> e.stopPropagation()} onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="h-10 w-10 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">◈</div>
        <h2 className="mt-3 font-display font-bold text-lg">Sign in to vsixgate</h2>
        <p className="text-sm text-ink-600 mt-1">Save scans, track versions, sync across devices. Demo auth — stored locally, no password.</p>
        <input value={email} onChange={e=> setEmail(e.target.value)} placeholder="you@company.com" className="mt-4 w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" autoFocus />
        {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
        <button type="submit" className="mt-4 w-full rounded-xl bg-slate-900 text-white py-2.5 text-sm font-bold">Continue</button>
        <div className="mt-3 text-xs text-ink-400 text-center">No email sent — demo only. Your scans stay in this browser.</div>
        <button type="button" onClick={onClose} className="mt-2 w-full text-xs text-ink-500 hover:text-ink-700">Cancel</button>
      </form>
    </div>
  )
}
