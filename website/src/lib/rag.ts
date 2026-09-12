// Simple RAG over web-only context. No external LLM, no network beyond local scan.
// We index a static knowledge base derived from this site + CLI docs, then retrieve by token overlap
// and generate a templated answer constrained to that context.

import { examples } from '../data/examples'

export interface RagChunk {
  id: string
  title: string
  url: string
  content: string
  tags: string[]
}

export const knowledgeBase: RagChunk[] = [
  {
    id: 'what-vsixgate',
    title: 'What is vsixgate',
    url: '/',
    content: `vsixgate is a pre-publish security scanner for VS Code and Open VSX extensions. It runs in the publisher's own CI before vsce publish, not after install. Pipeline: unpack (.vsix zip via AdmZip) → manifest analysis → static taint (UntrustIDE source→sink: workspace.getConfiguration, fs.read, http → exec/spawn, eval, write) → signatures (PNG/JPG with MZ/ELF, telemetry opt-out downgrade) → dependency (lockfile + OSV + Levenshtein typosquat ≤2) → diff engine (SQLite/JSON history, newInThisVersion) → scoring (critical→BLOCK, high+new→BLOCK, high/medium→WARN, strict→BLOCK) → report (text/json/SARIF 2.1.0). Exit codes 0 PASS 1 WARN 2 BLOCK. Install: npm i -g ./vsixgate-0.1.0.tgz ; scan: vsixgate scan ./ext.vsix --format sarif --out results.sarif`,
    tags: ['overview', 'pipeline', 'install', 'cli'],
  },
  {
    id: 'why-unique',
    title: 'Why vsixgate vs others',
    url: '/#why',
    content: `Existing tools scan after publish or install: ExtensionTotal/Koi (market scanner, cloud, dashboard), vsix-audit (report), VSCan (report). vsixgate is the gate before publish. Differentiators: version-diff engine flags only NEW risk between releases (catches AsyncAPI/GlassWorm clean→malicious update), UntrustIDE taint model source→sink, SARIF for GitHub Actions PR annotations, typosquat + OSV, disguised binary PNG→ELF/PE, BLOCK/WARN/PASS exit codes, local/offline. Table shows vsixgate has all; others lack pre-publish, diff, SARIF.`,
    tags: ['comparison', 'unique', 'competitor'],
  },
  {
    id: 'cli-usage',
    title: 'CLI usage and reports',
    url: '/scan',
    content: `CLI: vsixgate scan <path-or-publisher.extension-id> [--registry vscode|openvsx] [--format text|json|sarif --out file] [--strict] [--osv-api url]. Detailed report: --format json gives manifest+findings+scoring+score; --format sarif maps rule→ruleId, severity critical/high→error medium→warning low/info→note, location→physicalLocation. SARIF uploads via github/codeql-action/upload-sarif for inline PR annotations. vsixgate.config.json can tune thresholds. Browser scanner at /scan supports same heuristics minus OSV live and SQLite diff.`,
    tags: ['cli', 'report', 'sarif', 'json', 'enterprise'],
  },
  {
    id: 'enterprise',
    title: 'Enterprise web service',
    url: '/#enterprise',
    content: `For enterprises: host vsixgate as a private web service — POST /scan with .vsix or publisher.name, webhook to block vsce publish, bulk scan, policy as code, SSO, audit log, on-prem runner (no data leaves VPC). Personalized IDE: VS Code extension with command vsixgate: Scan this workspace, Problems panel SARIF diagnostics, pre-publish hook on vsce publish. Contact via agent for early access. Detailed report generation is built-in: choose text for humans, json for tooling, sarif for CI.`,
    tags: ['enterprise', 'web service', 'ide', 'report'],
  },
  {
    id: 'scanner-how',
    title: 'Live scanner how it works',
    url: '/scan',
    content: `Live scanner at /scan runs entirely in browser via JSZip + heuristics mirroring src/static, signatures, dependency. Supports fetch by name from Open VSX (CORS-friendly) and Marketplace (may need file fallback; then drag-drop .vsix or use CLI). Popular quick-scan: ms-python.python, esbenp.prettier-vscode, dbaeumer.vscode-eslint, etc. Shows score 0-100, BLOCK/WARN/PASS, findings with legitimateUse/redFlag, export Copy JSON/SARIF/Download SARIF. CLI-only: OSV live, SQLite diff newInThisVersion, Semgrep/YARA-X planned.`,
    tags: ['scanner', 'browser', 'fetch', 'vsix'],
  },
  {
    id: 'pipeline-stages',
    title: 'Pipeline 8 stages',
    url: '/#pipeline',
    content: `8 stages each emits Finding {rule, severity, message, legitimateUse, redFlag, location, newInThisVersion}. 01 Unpack 02 Manifest (activation *, settings, capabilities, deps, lockfile) 03 Static taint 04 Signatures 05 Dependencies 06 Diff engine 07 Scoring 08 Report. Finding contract is stable per docs/schema.md.`,
    tags: ['pipeline', 'architecture', 'finding'],
  },
  {
    id: 'stats',
    title: 'Stats',
    url: '/',
    content: `Stats: median scan ~2.3s, BLOCK 4 of 10 examples, SARIF 2.1.0, pipeline 8 stages. Security score = 100 - (critical*40 + high*20 + medium*10 + low*3).`,
    tags: ['stats', 'score'],
  },
  ...examples.map(e => ({
    id: `example-${e.id}`,
    title: `${e.displayName} — ${e.publisher}.${e.name}@${e.version} — ${e.status} ${e.score}/100`,
    url: `/examples/${e.id}`,
    content: `${e.displayName} (${e.publisher}.${e.name}@${e.version}) ${e.status} score ${e.score} downloads ${e.downloads} categories ${e.categories.join(', ')} description: ${e.description}. Findings: ${e.findings.map(f => `[${f.severity}] ${f.rule}: ${f.message}${f.redFlag ? ' redFlag: '+f.redFlag : ''}${f.legitimateUse ? ' legitimateUse: '+f.legitimateUse : ''}`).join(' | ')}`,
    tags: ['example', e.status.toLowerCase(), ...e.categories.map(c=>c.toLowerCase())],
  })),
]

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').split(/\s+/).filter(Boolean)
}

export function retrieve(query: string, k = 4): RagChunk[] {
  const qTokens = new Set(tokenize(query))
  if (qTokens.size === 0) return knowledgeBase.slice(0, k)
  const scored = knowledgeBase.map(chunk => {
    const cTokens = tokenize(chunk.title + ' ' + chunk.content + ' ' + chunk.tags.join(' '))
    const cSet = new Set(cTokens)
    let overlap = 0
    for (const t of qTokens) if (cSet.has(t) || [...cSet].some(c => c.includes(t) || t.includes(c))) overlap++
    // bonus for exact id/tag match
    const tagBonus = chunk.tags.some(t => qTokens.has(t)) ? 2 : 0
    const scanBonus = /scan/.test(query.toLowerCase()) && chunk.tags.includes('scanner') ? 1 : 0
    return { chunk, score: overlap + tagBonus + scanBonus }
  }).filter(s => s.score > 0).sort((a,b)=> b.score - a.score).slice(0,k)
  return scored.length? scored.map(s=> s.chunk) : knowledgeBase.slice(0,2)
}

export function isOutOfScope(query: string): boolean {
  const q = query.toLowerCase()
  // if query is purely about generic topics not in vsixgate, flag
  const inScopeHints = ['vsix','extension','scan','report','sarif','vsixgate','open vsx','marketplace','typosquat','telemetry','pipeline','finding','score','block','warn','pass','manifest','taint','signature','diff','enterprise','ide','cli','prettier','python','eslint','github','vsce']
  const hasHint = inScopeHints.some(h => q.includes(h))
  // Very short greetings are in-scope
  if (q.trim().length < 20 && (q.includes('hi')||q.includes('hello')||q.includes('help'))) return false
  // If no hint and query looks like general knowledge (e.g., weather, math unrelated), mark out of scope
  if (!hasHint && q.length > 12 && !q.includes('scan')) {
    // but if they ask to scan, that's in scope even without hint
    if (/^[a-z0-9_.-]+\.[a-z0-9_.-]+/.test(q.trim())) return false
    return /(weather|news|joke|story|poem|recipe|code|python.*script|capital|history|math)/.test(q)
  }
  return false
}

export function generateAnswer(query: string, chunks: RagChunk[]): string {
  const q = query.toLowerCase()
  if (q.includes('scan ') || /^[a-z0-9_.-]+\.[a-z0-9_.-]+/.test(q.trim()) || q.includes('.vsix') || q.includes('prettier') || q.includes('python')) {
    // handled as scan intent separately by caller; here give context
  }
  const cite = chunks.map(c=> `• ${c.title} (${c.url})`).join('\n')
  const excerpt = chunks.map(c=> c.content.slice(0, 380)).join('\n\n---\n\n')
  return `${excerpt}\n\nSources:\n${cite}`
}
