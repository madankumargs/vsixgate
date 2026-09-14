import fs from 'fs';
import path from 'path';
import { Finding } from '../types.js';

function walk(dir: string, files: string[] = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

export async function scanSignatures(bundleRoot: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const rel = (f: string) => path.relative(bundleRoot, f).split(path.sep).join('/');
  const files = walk(bundleRoot);
  const pendingNative: Finding[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    // check for PE/ELF magic in non-executable-looking files
    try {
      const buf = fs.readFileSync(file);
      if (buf.length >= 4) {
        const mz = buf[0] === 0x4d && buf[1] === 0x5a; // 'MZ'
        const elf = buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46; // '\x7FELF'
        if ((mz || elf) && ['.png', '.jpg', '.jpeg'].includes(ext)) {
          findings.push({
            rule: 'signatures.disguised_executable',
            severity: 'high',
            message: `File ${rel(file)} contains executable magic bytes despite image extension`,
            redFlag: 'Possible disguised payload inside archived image file',
            location: { file: rel(file) }
          });
        }
      }
    } catch (e) {
      // ignore read errors
    }

    // native addon / build-marker detection: .node binaries and build descriptors
    const base = path.basename(file).toLowerCase();
    if (ext === '.node' || base === 'binding.gyp' || file.split(path.sep).includes('prebuilds')) {
      pendingNative.push({
        rule: 'native.binary_present',
        severity: 'medium',
        message: ext === '.node'
          ? `Prebuilt native addon ${rel(file)} ships opaque binary code`
          : `Native build marker ${rel(file)} suggests compiled code ships with the extension`,
        legitimateUse: 'Native modules accelerate crypto, sqlite, or platform integration',
        redFlag: 'Static analysis cannot inspect compiled code; review the build source and provenance',
        location: { file: rel(file) }
      });
    }

    // JS-level telemetry pattern detection
    if (ext === '.js' || ext === '.ts') {
      try {
        const src = fs.readFileSync(file, 'utf8');
        if (/sendTelemetry|telemetryEvent|telemetry\b/.test(src)) {
          // check for mitigation
          const mitigated = /isTelemetryEnabled|vscode\.env\.isTelemetryEnabled|contributes.*telemetry/.test(src);
          const severity: Finding['severity'] = mitigated ? 'medium' : 'high';
          findings.push({
            rule: 'signatures.telemetry_usage',
            severity,
            message: `Telemetry-related API usage in ${rel(file)}`,
            legitimateUse: 'Extensions often collect telemetry for diagnostics',
            redFlag: mitigated ? 'Has opt-out/mitigation detected' : 'No opt-out/mitigation detected',
            location: { file: rel(file) }
          });
        }
      } catch { }
    }
    // embedded-secrets scan: well-known token shapes + high-entropy strings.
    // Capped at 1MB per text file so minified bundles don't blow up scan time.
    if ((ext === '.js' || ext === '.ts' || ext === '.json') && !file.includes(`${path.sep}node_modules${path.sep}`)) {
      try {
        const stat = fs.statSync(file);
        if (stat.size <= 1024 * 1024) {
          const src = fs.readFileSync(file, 'utf8');
          const secretHit = scanTextForSecrets(src);
          if (secretHit) {
            findings.push({
              rule: 'secret.embedded_key',
              severity: 'high',
              message: `Possible ${secretHit.kind} in ${rel(file)}`,
              legitimateUse: 'Test fixtures and placeholders sometimes look like keys',
              redFlag: 'A shipped secret lets anyone impersonate the publisher or pivot into their infrastructure',
              location: { file: rel(file) }
            });
          }
        }
      } catch { /* ignore unreadable files */ }
    }
  }

  // A lone binding.gyp with no shipped binary is just build tooling — downgrade
  // those markers to low so legit native-module sources don't alarm.
  const hasPrebuiltBinary = pendingNative.some(o => o.message.startsWith('Prebuilt native'));
  for (const f of pendingNative) {
    if (f.message.startsWith('Native build marker') && !hasPrebuiltBinary) {
      findings.push({ ...f, severity: 'low' });
    } else {
      findings.push(f);
    }
  }

  return findings;
}

// --- embedded secret shapes -------------------------------------------------
// Each pattern is deliberately narrow (fixed prefix + length) to avoid flagging
// ordinary identifiers. Entropy fallback catches unlabeled keys.

const SECRET_PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: 'GitHub token', re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/ },
  { kind: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: 'private key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { kind: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: 'npm token', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { kind: 'labeled secret assignment', re: /\b(api[_-]?key|api[_-]?secret|secret[_-]?key|aws[_-]?secret|client[_-]?secret)\b\s*[:=]\s*['"][^'"]{16,}['"]/i }
];

function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  for (const c of freq.values()) {
    const p = c / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function scanTextForSecrets(src: string): { kind: string } | null {
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(src)) return { kind: p.kind };
  }
  // entropy fallback: long quoted strings with high randomness
  const re = /['"]([A-Za-z0-9_+/=-]{32,})['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const s = m[1];
    if (s.length >= 32 && shannonEntropy(s) > 4.5) return { kind: 'high-entropy string (possible key)' };
  }
  return null;
}
