import fs from 'fs';
import path from 'path';
import { Finding, ManifestAnalysisResult } from '../types.js';

export async function analyzeManifest(manifestPath: string, bundleRoot?: string): Promise<ManifestAnalysisResult> {
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const pkg = JSON.parse(raw);

  const findings: Finding[] = [];
  // Store portable relative paths so diff keys are stable across tmp-dir scans.
  const relManifest = bundleRoot ? path.relative(bundleRoot, manifestPath).split(path.sep).join('/') : manifestPath;

  const activationEvents: string[] = Array.isArray(pkg.activationEvents) ? pkg.activationEvents : [];
  if (activationEvents.includes('*')) {
    findings.push({
      rule: 'manifest.activation_star',
      severity: 'medium',
      message: 'activationEvents contains "*", activates on startup',
      legitimateUse: 'Common for extensions that need early startup',
      redFlag: 'Broad activation increases attack surface',
      location: { file: relManifest }
    });
  }

  const declaredSettings: string[] = [];
  if (pkg.contributes && pkg.contributes.configuration) {
    const conf = pkg.contributes.configuration;
    // configuration can be an object or array of objects
    const sections = Array.isArray(conf) ? conf : [conf];
    for (const s of sections) {
      if (s && s.properties) {
        for (const key of Object.keys(s.properties)) declaredSettings.push(key);
      }
    }
    if (declaredSettings.length > 0) {
      findings.push({
        rule: 'manifest.declared_settings',
        severity: 'info',
        message: `Declared ${declaredSettings.length} configuration settings`,
        legitimateUse: 'Extensions expose settings to configure behavior',
        location: { file: relManifest }
      });
    }
  }

  let untrustedWorkspacesClaim: boolean | 'limited' | undefined = undefined;
  if (pkg.capabilities && pkg.capabilities.untrustedWorkspaces) {
    const v = pkg.capabilities.untrustedWorkspaces.supported;
    if (v === true) untrustedWorkspacesClaim = true;
    else if (v === 'limited') untrustedWorkspacesClaim = 'limited';
    if (untrustedWorkspacesClaim) {
      findings.push({
        rule: 'manifest.untrusted_workspaces',
        severity: 'info',
        message: `Declares capabilities.untrustedWorkspaces = ${String(v)}`,
        legitimateUse: 'Some extensions need limited workspace access',
        redFlag: 'Claim should be verified against runtime sinks',
        location: { file: relManifest }
      });
    }
  }

  const extensionDependencies: string[] = Array.isArray(pkg.extensionDependencies) ? pkg.extensionDependencies : [];
  if (extensionDependencies.length > 0) {
    findings.push({
      rule: 'manifest.extension_dependencies',
      severity: 'low',
      message: `Declares ${extensionDependencies.length} extensionDependencies`,
      legitimateUse: 'Extensions can depend on other extensions for shared functionality',
      redFlag: 'Dependency may share execution context',
      location: { file: relManifest }
    });
  }

  // lifecycle + script audit: install hooks run automatically with full privileges
  const scripts: Record<string, unknown> =
    pkg.scripts && typeof pkg.scripts === 'object' ? (pkg.scripts as Record<string, unknown>) : {};
  const RISKY_HOOKS = ['preinstall', 'install', 'postinstall'];
  for (const hook of RISKY_HOOKS) {
    const cmd = scripts[hook];
    if (typeof cmd === 'string' && cmd.trim()) {
      findings.push({
        rule: 'manifest.risky_install_script',
        severity: 'high',
        message: `Lifecycle script "${hook}" runs automatically on install: ${cmd.slice(0, 120)}`,
        legitimateUse: 'Install scripts compile native dependencies or fetch platform binaries',
        redFlag: 'Runs automatically with user privileges; a compromised update turns this into code execution',
        location: { file: relManifest }
      });
    }
  }
  const SUSPICIOUS_SCRIPT_RE = /curl\b|wget\b|powershell|invoke-webrequest|certutil|bitsadmin|node\s+-e|\bsh\b\s+-c|base64\s+(--decode|-d)/i;
  for (const [name, cmd] of Object.entries(scripts)) {
    if (RISKY_HOOKS.includes(name)) continue; // already flagged above
    if (typeof cmd === 'string' && SUSPICIOUS_SCRIPT_RE.test(cmd)) {
      findings.push({
        rule: 'manifest.suspicious_script',
        severity: 'medium',
        message: `Script "${name}" downloads or executes remote content: ${cmd.slice(0, 120)}`,
        legitimateUse: 'Build scripts fetch toolchains or run codegen',
        redFlag: 'Pipes remote content into a shell without integrity verification',
        location: { file: relManifest }
      });
    }
  }

  // engines.vscode audit: unbounded or pre-workspace-trust ranges widen the blast radius
  const engineRange = pkg.engines && typeof pkg.engines === 'object'
    ? String((pkg.engines as Record<string, unknown>).vscode || '').trim()
    : '';
  if (!engineRange) {
    findings.push({
      rule: 'manifest.missing_engines',
      severity: 'low',
      message: 'No engines.vscode constraint declared',
      legitimateUse: 'Small extensions omit engine pins',
      redFlag: 'Runs on untested engine versions, including ones without workspace trust',
      location: { file: relManifest }
    });
  } else if (engineRange === '*' || /^[xX]$/.test(engineRange) || /^>=?\s*0(\.0)?(\.0)?$/.test(engineRange)) {
    findings.push({
      rule: 'manifest.unbounded_engine',
      severity: 'medium',
      message: `engines.vscode "${engineRange}" allows any VS Code version`,
      legitimateUse: 'Maximises install reach',
      redFlag: 'No lower bound means no workspace-trust or API guarantees',
      location: { file: relManifest }
    });
  } else {
    const m = engineRange.match(/(\d+)\s*\.\s*(\d+)(?:\s*\.\s*(\d+))?/);
    if (!m) {
      findings.push({
        rule: 'manifest.unbounded_engine',
        severity: 'medium',
        message: `engines.vscode "${engineRange}" has no parseable lower bound`,
        legitimateUse: 'Complex ranges are hard to evaluate',
        redFlag: 'Cannot confirm a minimum engine with workspace-trust support',
        location: { file: relManifest }
      });
    } else {
      const major = parseInt(m[1], 10);
      const minor = parseInt(m[2], 10);
      if (major < 1 || (major === 1 && minor < 70)) {
        findings.push({
          rule: 'manifest.outdated_engine',
          severity: 'medium',
          message: `engines.vscode "${engineRange}" permits engines before workspace trust (1.70)`,
          legitimateUse: 'Supporting older VS Code installs',
          redFlag: 'Pre-1.70 engines lack workspace-trust protections the extension may assume',
          location: { file: relManifest }
        });
      }
    }
  }

  // check for lockfile presence (bundle root and extension/ subdir; npm, yarn, pnpm)
  let hasLockfile = false;
  if (bundleRoot) {
    const manifestDir = path.dirname(manifestPath);
    const lockCandidates = [
      path.join(bundleRoot, 'package-lock.json'),
      path.join(bundleRoot, 'yarn.lock'),
      path.join(bundleRoot, 'pnpm-lock.yaml'),
      path.join(manifestDir, 'package-lock.json'),
      path.join(manifestDir, 'yarn.lock'),
      path.join(manifestDir, 'pnpm-lock.yaml')
    ];
    hasLockfile = lockCandidates.some(p => fs.existsSync(p));
    if (!hasLockfile) {
      findings.push({
        rule: 'manifest.missing_lockfile',
        severity: 'low',
        message: 'No package-lock.json, yarn.lock, or pnpm-lock.yaml included in the bundle',
        legitimateUse: 'Some authors omit lockfiles intentionally',
        redFlag: 'Blocks reliable transitive dependency analysis',
        location: { file: relManifest }
      });
    }
  }

  // publisher, name, version
  const publisher = pkg.publisher || pkg.author || undefined;
  const extensionName = pkg.name;
  const version = pkg.version;

  return {
    activationEvents: { value: activationEvents, flags: findings.filter(f => f.rule === 'manifest.activation_star') },
    declaredSettings,
    untrustedWorkspacesClaim,
    extensionDependencies,
    hasLockfile,
    publisher,
    extensionName,
    version,
    findings
  } as ManifestAnalysisResult;
}
