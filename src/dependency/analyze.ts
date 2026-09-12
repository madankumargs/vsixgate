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

export async function analyzeDependencies(lockfilePath: string, opts?: { osvLookup?: OSVLookup; topPackagesPath?: string }): Promise<Finding[]> {
  const findings: Finding[] = [];
  if (!fs.existsSync(lockfilePath)) return findings;
  const raw = fs.readFileSync(lockfilePath, 'utf8');
  let lock: any;
  try { lock = JSON.parse(raw); } catch { return findings; }

  // package-lock v2 uses 'dependencies' map; older versions similar
  const deps = lock.dependencies ? Object.keys(lock.dependencies).map(k => ({ name: k, version: lock.dependencies[k].version })) : [];

  console.log('DEBUG: dependency analyzer loaded', deps.map(d => `${d.name}@${d.version}`));

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
              location: { file: lockfilePath }
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
          location: { file: lockfilePath }
        });
        break;
      }
    }
  }

  return findings;
}
