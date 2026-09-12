import { createContext, useContext, useEffect, useState } from 'react'

export interface User { email: string; name: string; avatar: string }

const KEY = 'vsixgate_user'

function load(): User | null {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}

const AuthCtx = createContext<{ user: User | null; signIn: (email:string)=>void; signOut: ()=>void; loading:boolean }>(null as any)

export function AuthProvider({ children }: { children: React.ReactNode }){
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(()=>{ setUser(load()); setLoading(false)},[])
  const signIn = (email: string)=>{
    const name = email.split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
    const u: User = { email: email.trim().toLowerCase(), name, avatar }
    localStorage.setItem(KEY, JSON.stringify(u))
    setUser(u)
  }
  const signOut = ()=>{ localStorage.removeItem(KEY); setUser(null) }
  return <AuthCtx.Provider value={{ user, signIn, signOut, loading }}>{children}</AuthCtx.Provider>
}

export function useAuth(){ return useContext(AuthCtx) }
