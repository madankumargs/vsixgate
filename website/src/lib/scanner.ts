import JSZip from 'jszip'
import type { Finding, Severity } from '../data/examples'

function sevOrder(s: Severity): number {
  return ['info','low','medium','high','critical'].indexOf(s)
}

export interface ScanResult {
  publisher: string
  name: string
  version: string
  findings: Finding[]
  status: 'BLOCK'|'WARN'|'PASS'
  score: number
  hasLockfile: boolean
  manifest: any
}

function levenshtein(a:string,b:string){
  const m=a.length,n=b.length
  const dp=Array.from({length:m+1},()=>Array(n+1).fill(0))
  for(let i=0;i<=m;i++) dp[i][0]=i
  for(let j=0;j<=n;j++) dp[0][j]=j
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++){
    dp[i][j]= a[i-1]===b[j-1]? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])
  }
  return dp[m][n]
}

const TOP_PACKAGES = ['lodash','axios','express','react','chalk','commander','typescript','eslint','prettier','jest','vitest','webpack','vite','semver','moment','debug','yargs','minimist','qs','uuid']

export async function scanVsixBuffer(buffer: ArrayBuffer): Promise<ScanResult> {
  const zip = await JSZip.loadAsync(buffer)
  const findings: Finding[] = []

  // locate manifest
  let manifestRaw: string | null = null
  let manifestPath = ''
  for (const cand of ['extension/package.json','package.json']) {
    const f = zip.file(cand)
    if (f) { manifestRaw = await f.async('string'); manifestPath = cand; break }
  }
  // also try any package.json
  if (!manifestRaw) {
    for (const [p, entry] of Object.entries(zip.files)) {
      if (p.endsWith('package.json') && !entry.dir) {
        try { manifestRaw = await entry.async('string'); manifestPath = p; break } catch {}
      }
    }
  }
  if (!manifestRaw) throw new Error('No package.json found in .vsix (not a valid extension bundle)')

  let pkg:any = {}
  try { pkg = JSON.parse(manifestRaw) } catch { throw new Error('Invalid package.json in bundle') }

  const publisher = pkg.publisher || pkg.author || 'unknown'
  const name = pkg.name || 'unknown'
  const version = pkg.version || '0.0.0'

  // manifest checks
  const activationEvents: string[] = Array.isArray(pkg.activationEvents) ? pkg.activationEvents : []
  if (activationEvents.includes('*')) {
    findings.push({ rule:'manifest.activation_star', severity:'medium', message:'activationEvents contains "*", activates on startup', legitimateUse:'Common for extensions that need early startup', redFlag:'Broad activation increases attack surface', location:{ file:manifestPath } })
  }
  if (pkg.contributes?.configuration) {
    const conf = pkg.contributes.configuration
    const sections = Array.isArray(conf) ? conf : [conf]
    let count = 0
    for (const s of sections) if (s?.properties) count += Object.keys(s.properties).length
    if (count>0) findings.push({ rule:'manifest.declared_settings', severity:'info', message:`Declared ${count} configuration settings`, location:{ file:manifestPath } })
  }
  if (pkg.capabilities?.untrustedWorkspaces?.supported) {
    findings.push({ rule:'manifest.untrusted_workspaces', severity:'info', message:`Declares capabilities.untrustedWorkspaces = ${String(pkg.capabilities.untrustedWorkspaces.supported)}`, location:{ file:manifestPath } })
  }
  if (Array.isArray(pkg.extensionDependencies) && pkg.extensionDependencies.length>0) {
    findings.push({ rule:'manifest.extension_dependencies', severity:'low', message:`Declares ${pkg.extensionDependencies.length} extensionDependencies`, location:{ file:manifestPath } })
  }
  const hasLockfile = !!zip.file('extension/package-lock.json') || !!zip.file('package-lock.json') || !!zip.file('extension/yarn.lock') || !!zip.file('yarn.lock')
  if (!hasLockfile) findings.push({ rule:'manifest.missing_lockfile', severity:'low', message:'No package-lock.json or yarn.lock included in the bundle', redFlag:'Blocks reliable transitive dependency analysis', location:{ file:manifestPath } })

  // collect js/ts files
  const jsFiles: {path:string, content:string}[] = []
  const allFiles: {path:string, buf: Uint8Array}[] = []
  for (const [p, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    if (p.endsWith('.js') || p.endsWith('.ts')) {
      try { const txt = await entry.async('string'); jsFiles.push({ path:p, content:txt }) } catch {}
    }
    // for signature scan keep buffer for png/jpg
    if (p.endsWith('.png') || p.endsWith('.jpg') || p.endsWith('.jpeg')) {
      try { const b = await entry.async('uint8array'); allFiles.push({ path:p, buf:b }) } catch {}
    }
    if (p.endsWith('.js') || p.endsWith('.ts')) {
      try { const b = await entry.async('uint8array'); allFiles.push({ path:p, buf:b }) } catch {}
    }
  }

  // static heuristics (mirrors src/static/analyze.ts)
  for (const {path: file, content: src} of jsFiles) {
    const hasWorkspace = /workspace\.getConfiguration\(/.test(src)
    const hasFsRead = /fs\.readFileSync\(|fs\.readFile\(|vscode\.workspace\.fs\.readFile\(/.test(src)
    const hasAxios = /axios\.(get|post)\(|http\.get\(/.test(src)
    const hasExec = /child_process\.(exec|spawn)\(|\bexec\(|\bspawn\(/.test(src)
    const hasEval = /\beval\s*\(/.test(src)
    const hasWrite = /fs\.writeFileSync\(|fs\.writeFile\(/.test(src)
    const urlRe = /https?:\/\/[^\s'"`\)\>\]]+/g
    const urls = src.match(urlRe) || []

    if ((hasWorkspace || hasFsRead || hasAxios) && hasExec) {
      const hasAllowlist = /allowlist|whitelist|isValidCommand|validateCommand|sanitizeCmd|escapeShellArg|ALLOWED_COMMANDS/i.test(src)
      findings.push({ rule:'static.source_to_shell', severity: hasAllowlist?'high':'critical', message:`Possible tainted data flowing to shell in ${file}`, legitimateUse:'Extensions sometimes invoke external tools configured by users', redFlag: hasAllowlist? 'Uses untrusted input sources with shell execution in same file' : 'No validation/allowlist detected for shell arguments', location:{ file } })
    }
    if ((hasWorkspace || hasAxios || hasFsRead) && hasEval) {
      const mitigated = /JSON\.parse\s*\(/.test(src)
      findings.push({ rule:'static.source_to_eval', severity: mitigated?'high':'critical', message:`Possible tainted data used in eval() in ${file}`, redFlag: mitigated? 'eval() wraps JSON.parse or bracketed expression' : 'eval() of untrusted data can lead to code injection', location:{ file } })
    }
    if (hasWrite && hasFsRead) {
      const ssrc = src.toLowerCase()
      const sensitive = ['.bashrc','.profile','/etc/','startup','autostart','appdata','.ssh','authorized_keys'].some(p=> ssrc.includes(p))
      findings.push({ rule:'static.read_to_write', severity: sensitive?'critical':'medium', message:`File read data may be written back in ${file}`, redFlag: sensitive? 'Writes to potentially sensitive startup/executable locations detected' : 'Writing paths/content derived from external input increases risk', location:{ file } })
    }
    for (const u of urls) {
      try {
        const parsed = new URL(u)
        const insecure = parsed.protocol === 'http:'
        findings.push({ rule:'network.destination', severity: insecure?'medium':'low', message:`Outbound network destination ${u} referenced in ${file}`, redFlag: insecure? 'Uses unencrypted http' : undefined, location:{ file } })
      } catch {}
    }
    // telemetry
    if (/sendTelemetry|telemetryEvent|telemetry\b/.test(src)) {
      const mitigated = /isTelemetryEnabled|vscode\.env\.isTelemetryEnabled/.test(src)
      findings.push({ rule:'signatures.telemetry_usage', severity: mitigated?'medium':'high', message:`Telemetry-related API usage in ${file}`, legitimateUse:'Extensions often collect telemetry for diagnostics', redFlag: mitigated? 'Has opt-out/mitigation detected' : 'No opt-out/mitigation detected', location:{ file } })
    }
  }

  // signature disguised executable (png/jpg with MZ/ELF)
  for (const {path: file, buf} of allFiles) {
    const ext = file.split('.').pop()?.toLowerCase()
    if (['png','jpg','jpeg'].includes(ext||'')) {
      if (buf.length>=4) {
        const mz = buf[0]===0x4d && buf[1]===0x5a
        const elf = buf[0]===0x7f && buf[1]===0x45 && buf[2]===0x4c && buf[3]===0x46
        if (mz || elf) findings.push({ rule:'signatures.disguised_executable', severity:'high', message:`File ${file} contains executable magic bytes despite image extension`, redFlag:'Possible disguised payload inside archived image file', location:{ file } })
      }
    }
  }

  // dependency typosquat via lockfile
  let lockContent: string | null = null
  for (const p of ['extension/package-lock.json','package-lock.json']) {
    const f = zip.file(p); if (f) { lockContent = await f.async('string'); break }
  }
  if (lockContent) {
    try {
      const lock = JSON.parse(lockContent)
      const deps: {name:string, version:string}[] = []
      if (lock.packages) {
        for (const [k,v] of Object.entries(lock.packages as Record<string,any>)) {
          if (!k || k==='') continue
          const name2 = k.replace(/^node_modules\//,'')
          deps.push({ name:name2, version: v.version })
        }
      } else if (lock.dependencies) {
        for (const k of Object.keys(lock.dependencies)) deps.push({ name:k, version: lock.dependencies[k].version })
      }
      for (const d of deps) {
        for (const pop of TOP_PACKAGES) {
          if (pop===d.name) continue
          const dist = levenshtein(pop,d.name)
          if (dist>=1 && dist<=2) { findings.push({ rule:'dependency.typosquat', severity:'medium', message:`Dependency ${d.name} is within edit distance ${dist} of popular package ${pop}`, redFlag:`Possible typosquat targeting ${pop}`, location:{ file:'package-lock.json' } }); break }
        }
      }
    } catch {}
  }

  // scoring
  const counts = { critical:0, high:0, medium:0, low:0, info:0 } as Record<Severity,number>
  for (const f of findings) counts[f.severity]++
  const weight = counts.critical*40 + counts.high*20 + counts.medium*10 + counts.low*3
  const score = Math.max(0, Math.min(100, 100 - weight))
  let status: 'BLOCK'|'WARN'|'PASS' = 'PASS'
  if (findings.some(f=> f.severity==='critical') || findings.some(f=> f.severity==='high' && f.newInThisVersion)) status='BLOCK'
  else if (findings.some(f=> f.severity==='high' || f.severity==='medium')) status='WARN'
  // refine: if any critical => BLOCK else high/medium => WARN else PASS, but mimic scoring logic

  // adjust with final severity like scoring: but keep simple
  if (findings.some(f=> f.severity==='critical')) status='BLOCK'
  else if (findings.some(f=> f.severity==='high')) status = findings.some(f=> f.severity==='high') ? 'BLOCK' as any : 'WARN' // we want high without new -> WARN per spec; but simplified: high => BLOCK if new else WARN
  // correct per scoring: high + new => BLOCK, high without new => WARN. Our findings have no new flag except simulated; so treat high as WARN
  if (status==='BLOCK' && !findings.some(f=> f.severity==='critical')) {
    // if only high and not new, downgrade to WARN (since no newInThisVersion)
    const hasCritical = findings.some(f=> f.severity==='critical')
    const hasHighNew = findings.some(f=> f.severity==='high' && f.newInThisVersion)
    if (!hasCritical && !hasHighNew && findings.some(f=> f.severity==='high')) status='WARN'
  }

  return { publisher, name, version, findings, status, score, hasLockfile, manifest: pkg }
}
