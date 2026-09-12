import fs from 'fs';
import path from 'path';
import { Finding } from '../types.js';

function walkDir(dir: string, files: string[] = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkDir(full, files);
    else files.push(full);
  }
  return files;
}

function readText(file: string) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

export async function analyzeStatic(bundleRoot: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const files = walkDir(bundleRoot).filter(f => f.endsWith('.js') || f.endsWith('.ts'));

  for (const file of files) {
    const src = readText(file);
    const hasWorkspace = /workspace\.getConfiguration\(|workspace\.getConfiguration\s*\(/.test(src) || /vscode\.workspace\.getConfiguration\(/.test(src);
    const hasFsRead = /fs\.readFileSync\(|fs\.readFile\(|vscode\.workspace\.fs\.readFile\(/.test(src);
    const hasAxios = /axios\.(get|post)\(|http\.get\(/.test(src);
    const hasExpress = /express\(|\.get\(|\.post\(|app\.post\(|app\.get\(/.test(src) && /require\(['"]express['"]\)/.test(src);

    const hasExec = /child_process\.(exec|spawn)\(|\bexec\(|\bspawn\(/.test(src);
    const hasEval = /\beval\s*\(/.test(src);
    // heuristic: bracket-wrapped or JSON.parse usage inside eval
    const evalLikelySafe = /\beval\s*\(\s*(?:JSON\.parse\(|['"]\s*[\[\{])/.test(src);
    const hasWrite = /fs\.writeFileSync\(|fs\.writeFile\(/.test(src);

    // extract outbound URLs
    const urlRe = /https?:\/\/[^\s'"\)\>\]]+/g;
    const urlMatches = src.match(urlRe) || [];

    if ((hasWorkspace || hasFsRead || hasAxios || hasExpress) && hasExec) {
      // check for allowlist/validation patterns near exec usage
      const hasAllowlist = /allowlist|whitelist|isValidCommand|validateCommand|sanitizeCmd|escapeShellArg|shellEscape|ALLOWED_COMMANDS|allowedCommands/i.test(src);
      const sev = hasAllowlist ? 'high' : 'critical';
      findings.push({
        rule: 'static.source_to_shell',
        severity: sev,
        message: `Possible tainted data flowing to shell in ${path.relative(process.cwd(), file)}`,
        legitimateUse: 'Extensions sometimes invoke external tools configured by users',
        redFlag: hasAllowlist ? 'Uses untrusted input sources with shell execution in same file' : 'No validation/allowlist detected for shell arguments',
        location: { file }
      });
    }

    if ((hasWorkspace || hasAxios || hasFsRead) && hasEval) {
      // try to detect JSON.parse or bracket-wrapping as mitigation
      let mitigated = false;
      const evalArgs: string[] = [];
      const re = /eval\s*\(\s*([^\)]+)\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        evalArgs.push(m[1]);
      }
      for (const a of evalArgs) {
        if (/JSON\.parse\s*\(|^['"`]\{/.test(a) || /\(.*\)/.test(a)) {
          mitigated = true;
          break;
        }
      }
      const sev = mitigated ? 'high' : 'critical';
      findings.push({
        rule: 'static.source_to_eval',
        severity: sev,
        message: `Possible tainted data used in eval() in ${path.relative(process.cwd(), file)}`,
        legitimateUse: 'Some extensions parse dynamic code or evaluate JSON-like strings',
        redFlag: mitigated ? 'eval() wraps JSON.parse or bracketed expression' : 'eval() of untrusted data can lead to code injection',
        location: { file }
      });
    }

    if (hasWrite && hasFsRead) {
      // detect sensitive write targets in literal paths using simple substring checks
      const ssrc = src.toLowerCase();
      const sensitivePatterns = ['.bashrc', '.profile', '/etc/', 'startup', 'autostart', 'program files', 'appdata', '.ssh', 'authorized_keys', '/rc', '\\rc'];
      const sensitiveTarget = sensitivePatterns.some(p => ssrc.includes(p));
      const sev = sensitiveTarget ? 'critical' : 'medium';
      findings.push({
        rule: 'static.read_to_write',
        severity: sev,
        message: `File read data may be written back in ${path.relative(process.cwd(), file)}`,
        legitimateUse: 'Extensions transform workspace files',
        redFlag: sensitiveTarget ? 'Writes to potentially sensitive startup/executable locations detected' : 'Writing paths/content derived from external input increases risk',
        location: { file }
      });
    }

    // add findings for network destinations
    for (const u of urlMatches) {
      try {
        const parsed = new URL(u);
        const host = parsed.hostname;
        const isInsecure = parsed.protocol === 'http:';
        findings.push({
          rule: 'network.destination',
          severity: isInsecure ? 'medium' : 'low',
          message: `Outbound network destination ${u} referenced in ${path.relative(process.cwd(), file)}`,
          legitimateUse: 'Extensions may contact remote services',
          redFlag: isInsecure ? 'Uses unencrypted http' : undefined,
          location: { file }
        });
      } catch (e) { /* ignore invalid URLs */ }
    }
  }

  return findings;
}
