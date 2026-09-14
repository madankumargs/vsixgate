import fs from 'fs';
import path from 'path';
import { Finding } from '../types.js';

function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export type OSVLookup = (name: string, version: string) => Promise<{ advisories?: Array<{ id?: string; severity?: string; summary?: string }>}>

export async function analyzeDependencies(lockfilePath: string, opts?: { osvLookup?: OSVLookup; topPackagesPath?: string; bundleRoot?: string }): Promise<Finding[]> {
  const findings: Finding[] = [];
  if (!fs.existsSync(lockfilePath)) return findings;
  const relFile = opts?.bundleRoot
    ? path.relative(opts.bundleRoot, lockfilePath).split(path.sep).join('/')
    : path.basename(lockfilePath);
  const base = path.basename(lockfilePath);

  let deps: Array<{ name: string; version: string }> = [];

  if (base === 'package-lock.json') {
    const raw = fs.readFileSync(lockfilePath, 'utf8');
    let lock: any;
    try { lock = JSON.parse(raw); } catch { return findings; }

    // npm v2/v3: 'dependencies' map (v2) and/or 'packages' map (v3).
    // v3 keys look like 'node_modules/lodash' or 'node_modules/a/node_modules/b'; '' is the root.
    const seen = new Map<string, string>();
    if (lock.dependencies && typeof lock.dependencies === 'object') {
      for (const k of Object.keys(lock.dependencies)) {
        const v = lock.dependencies[k]?.version;
        if (typeof v === 'string' && v && !seen.has(k)) seen.set(k, v);
      }
    }
    if (lock.packages && typeof lock.packages === 'object') {
      for (const k of Object.keys(lock.packages)) {
        if (!k) continue; // root entry
        const entry = lock.packages[k];
        const v = entry?.version;
        if (typeof v !== 'string' || !v) continue;
        // strip leading node_modules/ segments to get the real package name
        // (handles nesting: node_modules/a/node_modules/b -> b)
        const parts = k.split('node_modules/');
        const name = parts[parts.length - 1].replace(/\/$/, '');
        if (name && !seen.has(name)) seen.set(name, v);
      }
    }
    deps = [...seen.entries()].map(([name, version]) => ({ name, version }));
  } else if (base === 'yarn.lock') {
    deps = parseYarnLockV1(fs.readFileSync(lockfilePath, 'utf8'));
  } else if (base === 'pnpm-lock.yaml') {
    deps = parsePnpmLock(fs.readFileSync(lockfilePath, 'utf8'));
  } else {
    return findings;
  }

  // load top packages list
  let topPackages: string[] = [];
  if (opts?.topPackagesPath && fs.existsSync(opts.topPackagesPath)) {
    try { topPackages = JSON.parse(fs.readFileSync(opts.topPackagesPath, 'utf8')); } catch {}
  }

  for (const d of deps) {
    // OSV check
    if (opts?.osvLookup) {
      try {
        const res = await opts.osvLookup(d.name, d.version);
        if (res?.advisories && res.advisories.length > 0) {
          for (const a of res.advisories) {
            const sev = (a.severity || 'info').toLowerCase();
            const severity: Finding['severity'] = (sev === 'critical' || sev === 'high') ? 'high' : (sev === 'medium' ? 'medium' : 'low');
            findings.push({
              rule: 'dependency.osv_advisory',
              severity,
              message: `Package ${d.name}@${d.version} has OSV advisory ${a.id || ''}`,
              redFlag: a.summary,
              location: { file: relFile }
            });
          }
        }
      } catch { }
    }

    // Typosquat check
    for (const popular of topPackages) {
      if (popular === d.name) continue;
      const dist = levenshtein(popular, d.name);
      if (dist <= 2 && dist >= 1) {
        findings.push({
          rule: 'dependency.typosquat',
          severity: 'medium',
          message: `Dependency ${d.name} is within edit distance ${dist} of popular package ${popular}`,
          redFlag: `Possible typosquat targeting ${popular}`,
          location: { file: relFile }
        });
        break;
      }
    }
  }

  return findings;
}

// Minimal yarn.lock v1 parser: entries like `"pkg@^1.0.0":\n  version "1.2.3"`.
// Scoped packages ("@scope/pkg@^x") handled by taking text before last '@'
// as name candidate.
export function parseYarnLockV1(raw: string): Array<{ name: string; version: string }> {
  const out: Array<{ name: string; version: string }> = [];
  const seen = new Map<string, string>();
  const lines = raw.split(/\r?\n/);
  let pendingNames: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line) && line.includes('@') && line.trimEnd().endsWith(':')) {
      // header line: `"a@^1", "a@~1":` or `a@^1:` — split on comma
      const header = line.trim().replace(/:$/, '');
      pendingNames = header.split(/\s*,\s*/).map(h => h.replace(/^"|"$/g, '')).map(spec => {
        const at = spec.lastIndexOf('@');
        // spec is like 'name@range'; scoped '@scope/name@range' -> lastIndexOf works
        if (at <= 0) return spec;
        return spec.slice(0, at);
      }).filter(Boolean);
    } else if (/^\s+version\s+"?[^"\s]+/.test(line) && pendingNames.length) {
      const m = line.match(/version\s+"?([^"\s]+)"?/);
      if (m) {
        for (const n of pendingNames) {
          if (n && !seen.has(n)) seen.set(n, m[1].replace(/"$/, ''));
        }
      }
      pendingNames = [];
    } else if (line.trim() === '') {
      pendingNames = [];
    }
  }
  for (const [name, version] of seen) out.push({ name, version });
  return out;
}

// Minimal pnpm-lock.yaml parser: looks under `packages:` for keys like
// `/lodash@4.17.21:` or `lodash@4.17.21:`. No yaml dep needed.
export function parsePnpmLock(raw: string): Array<{ name: string; version: string }> {
  const out: Array<{ name: string; version: string }> = [];
  const seen = new Map<string, string>();
  const lines = raw.split(/\r?\n/);
  let inPackages = false;
  for (const line of lines) {
    if (/^packages:\s*$/.test(line)) { inPackages = true; continue; }
    if (inPackages && /^[^\s]/.test(line) && !line.startsWith(' ') && !line.startsWith('\t')) {
      // left packages: section (e.g. `snapshots:`) — stop if indented differently
      if (!/^packages:/.test(line)) { /* stay in packages until another top-level key */ }
    }
    if (!inPackages) continue;
    // package entry: two-space indent then key ending with ':'
    const m = line.match(/^\s{2}([^:\s][^:]*):\s*$/);
    if (!m) continue;
    let key = m[1].trim();
    // strip leading '/' pnpm uses, strip peer suffix '(...)' 
    key = key.replace(/^\/+/, '').split('(')[0];
    // key forms: 'name@version' or '@scope/name@version'
    const at = key.lastIndexOf('@');
    if (at <= 0) continue;
    const name = key.slice(0, at);
    const version = key.slice(at + 1);
    if (name && version && !seen.has(name)) seen.set(name, version);
  }
  for (const [name, version] of seen) out.push({ name, version });
  return out;
}
