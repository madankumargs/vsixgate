export const FINDING_EXPLANATIONS: Record<string, { explanation: string; recommendation: string }> = {
  'manifest.declared_settings': {
    explanation: 'The extension declares configurable settings which may affect behavior.',
    recommendation: 'Review settings to ensure they cannot be abused for unsafe behaviors; document defaults.'
  },
  'manifest.missing_lockfile': {
    explanation: 'No lockfile included; transitive dependency versions may vary and hide vulnerabilities.',
    recommendation: 'Include a package-lock.json or yarn.lock to allow deterministic dependency analysis.'
  },
  'static.source_to_shell': {
    explanation: 'Data from workspaces or network may flow into shell execution, enabling command injection.',
    recommendation: 'Add strict allowlists, sanitize inputs, and avoid shelling out when possible.'
  },
  'static.source_to_eval': {
    explanation: 'Untrusted data is passed to eval(), which can execute arbitrary code.',
    recommendation: 'Avoid eval(); use safe parsers like JSON.parse and validate inputs.'
  },
  'static.read_to_write': {
    explanation: 'Data read from external sources may be written to filesystem locations.',
    recommendation: 'Ensure writes are scoped to extension data dirs and never overwrite user/system files.'
  },
  'dependency.typosquat': {
    explanation: 'A dependency name is similar to a popular package; this may be a typosquat supply-chain attack.',
    recommendation: 'Confirm the package author and consider pinning to a known-good package or switching to the correct package.'
  },
  'dependency.osv_advisory': {
    explanation: 'Known vulnerability reported for a dependency via OSV.',
    recommendation: 'Upgrade or replace the affected dependency and follow upstream advisories.'
  },
  'network.destination': {
    explanation: 'Source files reference external network destinations that the extension may contact.',
    recommendation: 'Validate remote endpoints, prefer HTTPS, and document network usage.'
  },
  'network.new_destination': {
    explanation: 'A new remote destination was introduced in this version which may exfiltrate data.',
    recommendation: 'Audit the code path, ensure user consent, and restrict sensitive data from being sent.'
  },
  'manifest.untrusted_and_sinks': {
    explanation: 'The manifest advertises compatibility with untrusted workspaces but the extension contains sinks (shell, file-write, eval) that could be misused when running on untrusted content.',
    recommendation: 'Avoid claiming untrusted workspace support unless the extension contains no privileged sinks; document safeguards and add runtime checks.'
  },
  'manifest.extension_dependencies': {
    explanation: 'The extension declares extensionDependencies which may pull in third-party code with different trust characteristics.',
    recommendation: 'Review dependent extensions and their permissions; prefer minimal dependency surface and document why dependencies are required.'
  },
  'manifest.risky_install_script': {
    explanation: 'A preinstall/install/postinstall script runs automatically when the package installs, with the installing user\u2019s privileges.',
    recommendation: 'Remove install hooks where possible; if native builds need them, pin the toolchain, verify checksums, and avoid network fetches.'
  },
  'manifest.suspicious_script': {
    explanation: 'A package script downloads remote content or evaluates code (curl, powershell, node -e, base64 decode).',
    recommendation: 'Vendor the dependency or verify integrity (hash/signature); never pipe remote content straight into a shell.'
  },
  'manifest.missing_engines': {
    explanation: 'No engines.vscode constraint is declared, so the extension may run on untested engine versions.',
    recommendation: 'Declare a minimum engines.vscode of ^1.70.0 or later to guarantee workspace-trust protections.'
  },
  'manifest.unbounded_engine': {
    explanation: 'The engines.vscode range has no meaningful lower bound, so very old VS Code versions are allowed.',
    recommendation: 'Set a concrete lower bound (e.g. ^1.85.0) and test against it.'
  },
  'manifest.outdated_engine': {
    explanation: 'The declared engine range permits VS Code versions before workspace trust (1.70).',
    recommendation: 'Raise the minimum to ^1.70.0 or gate privileged behavior behind a workspace-trust check.'
  },
  'secret.embedded_key': {
    explanation: 'A shipped token, private key, or high-entropy string looks like a live credential baked into the bundle.',
    recommendation: 'Revoke the credential, move it to user settings or a secret store, and scan git history for leaks.'
  },
  'native.binary_present': {
    explanation: 'A prebuilt .node binary or native build marker ships with the extension; compiled code is opaque to static analysis.',
    recommendation: 'Publish build provenance (source, toolchain, reproducible build) and review what the native code can access.'
  },
  'static.outbound_url': {
    explanation: 'The source contains hard-coded or constructed URLs the extension may contact at runtime.',
    recommendation: 'Prefer configuration for endpoints, validate and document any telemetry or network usage, and avoid embedding secret tokens in URLs.'
  },
  'static.suspicious_eval_pattern': {
    explanation: 'Patterns were detected that dynamically construct code strings to be executed (e.g. string concatenation passed to eval).',
    recommendation: 'Refactor to avoid dynamic code construction; use parsers and explicit AST transforms if code generation is required.'
  },
  'static.write_sensitive_paths': {
    explanation: 'The code writes to paths that are commonly user-facing or system-critical (home, /etc, Program Files).',
    recommendation: 'Restrict writes to extension-specific storage folders (for example, context.globalStoragePath) and never overwrite user files.'
  },
  'signatures.telemetry': {
    explanation: 'Binary or telemetry-like signatures were detected that resemble analytics/telemetry payloads.',
    recommendation: 'Surface telemetry behavior to users and provide opt-out; minimize collection and follow privacy best practices.'
  }
};

export function explainFinding(rule: string) {
  return FINDING_EXPLANATIONS[rule] || { explanation: 'No detailed explanation available.', recommendation: 'Investigate the finding manually.' };
}
