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

  // check for lockfile presence in bundle root (if provided)
  let hasLockfile = false;
  if (bundleRoot) {
    const lock1 = path.join(bundleRoot, 'package-lock.json');
    const lock2 = path.join(bundleRoot, 'yarn.lock');
    hasLockfile = fs.existsSync(lock1) || fs.existsSync(lock2);
    if (!hasLockfile) {
      findings.push({
        rule: 'manifest.missing_lockfile',
        severity: 'low',
        message: 'No package-lock.json or yarn.lock included in the bundle',
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
