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
  }

  return findings;
}
