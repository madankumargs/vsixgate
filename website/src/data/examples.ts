export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Finding {
  rule: string
  severity: Severity
  message: string
  legitimateUse?: string
  redFlag?: string
  location?: { file: string; line?: number }
  newInThisVersion?: boolean
}

export interface ScannedExample {
  id: string
  publisher: string
  name: string
  version: string
  displayName: string
  description: string
  icon: string
  downloads: string
  status: 'BLOCK' | 'WARN' | 'PASS'
  score: number
  findings: Finding[]
  categories: string[]
  vsixSize: string
  lastScanned: string
}

export const examples: ScannedExample[] = [
  {
    id: 'theme-obsidian-pro',
    publisher: 'obsidian-themes',
    name: 'obsidian-pro',
    version: '2.4.1',
    displayName: 'Obsidian Pro Theme',
    description: 'Dark theme + icon pack. Zero code — pure CSS.',
    icon: '🎨',
    downloads: '482k',
    status: 'PASS',
    score: 98,
    findings: [
      { rule: 'manifest.declared_settings', severity: 'info', message: 'Declared 2 configuration settings', location: { file: 'extension/package.json' } }
    ],
    categories: ['Themes', 'Clean'],
    vsixSize: '1.2 MB',
    lastScanned: '2026-09-10'
  },
  {
    id: 'git-graph-plus',
    publisher: 'mhutchie',
    name: 'git-graph',
    version: '1.30.0 → 1.31.0',
    displayName: 'Git Graph Plus',
    description: 'Git history visualisation. Simulates UntrustIDE source→shell pattern (git.path → spawn).',
    icon: '🌳',
    downloads: '2.1M',
    status: 'BLOCK',
    score: 22,
    findings: [
      { rule: 'static.source_to_shell', severity: 'critical', message: 'Possible tainted data flowing to shell in extension/src/git.ts:42', legitimateUse: 'Extensions often let users configure a tool path (e.g. git.path) and pass it to a subprocess', redFlag: 'No validation/allowlist on the configured value before passing to child_process', location: { file: 'extension/src/git.ts', line: 42 }, newInThisVersion: true },
      { rule: 'manifest.activation_star', severity: 'medium', message: 'activationEvents contains "*", activates on startup', location: { file: 'extension/package.json' } },
      { rule: 'network.destination', severity: 'low', message: 'Outbound network destination https://api.github.com/graphql referenced in extension/src/api.ts', location: { file: 'extension/src/api.ts' } },
      { rule: 'network.new_destination', severity: 'high', message: 'New outbound destination introduced: https://telemetry.git-graph.io/collect', location: { file: 'extension/package.json' }, newInThisVersion: true },
    ],
    categories: ['SCM', 'High Risk'],
    vsixSize: '3.8 MB',
    lastScanned: '2026-09-11'
  },
  {
    id: 'scss-lint-eval',
    publisher: 'scss-lint',
    name: 'scss-lint',
    version: '0.9.3',
    displayName: 'SCSS Lint',
    description: 'Lint SCSS from workspace setting → eval() flow (UntrustIDE case study replica).',
    icon: '🧪',
    downloads: '87k',
    status: 'BLOCK',
    score: 18,
    findings: [
      { rule: 'static.source_to_eval', severity: 'critical', message: 'Possible tainted data used in eval() in extension/index.js:18', legitimateUse: 'Some extensions parse dynamic code or evaluate JSON-like strings', redFlag: 'eval() of untrusted data can lead to code injection', location: { file: 'extension/index.js', line: 18 }, newInThisVersion: true },
      { rule: 'manifest.untrusted_and_sinks', severity: 'high', message: 'Declares untrustedWorkspaces while containing shell/file-write/eval sinks', location: { file: 'extension/package.json' }, newInThisVersion: true },
      { rule: 'manifest.declared_settings', severity: 'info', message: 'Declared 5 configuration settings', location: { file: 'extension/package.json' } },
    ],
    categories: ['Linters', 'RCE'],
    vsixSize: '842 KB',
    lastScanned: '2026-09-09'
  },
  {
    id: 'png-disguised-payload',
    publisher: 'wallpaper-pack',
    name: 'wallpapers-hd',
    version: '1.0.4',
    displayName: 'HD Wallpapers Pack',
    description: 'Reconstructs ReversingLabs Dec 2025 campaign: ELF inside .png.',
    icon: '🖼️',
    downloads: '14k',
    status: 'BLOCK',
    score: 12,
    findings: [
      { rule: 'signatures.disguised_executable', severity: 'high', message: 'File extension/media/bg.png contains executable magic bytes despite image extension', redFlag: 'Possible disguised payload inside archived image file', location: { file: 'extension/media/bg.png' }, newInThisVersion: true },
      { rule: 'static.read_to_write', severity: 'critical', message: 'File read data may be written back in extension/activate.js:56 — Writes to potentially sensitive startup locations detected', location: { file: 'extension/activate.js', line: 56 }, newInThisVersion: true },
      { rule: 'manifest.missing_lockfile', severity: 'low', message: 'No package-lock.json or yarn.lock included in the bundle', location: { file: 'extension/package.json' } },
    ],
    categories: ['Malware', 'Disguised Binary'],
    vsixSize: '4.2 MB',
    lastScanned: '2026-09-11'
  },
  {
    id: 'telemetry-no-optout',
    publisher: 'code-metrics',
    name: 'code-health',
    version: '3.2.0',
    displayName: 'Code Health Metrics',
    description: 'Telemetry without opt-out — should stay HIGH, not downgraded.',
    icon: '📊',
    downloads: '210k',
    status: 'WARN',
    score: 64,
    findings: [
      { rule: 'signatures.telemetry_usage', severity: 'high', message: 'Telemetry-related API usage in extension/src/reporter.js:11', legitimateUse: 'Extensions often collect telemetry for diagnostics', redFlag: 'No opt-out/mitigation detected', location: { file: 'extension/src/reporter.js', line: 11 } },
      { rule: 'network.destination', severity: 'low', message: 'Outbound network destination https://metrics.example.com/collect referenced in extension/src/reporter.js', location: { file: 'extension/src/reporter.js', line: 14 } },
    ],
    categories: ['Telemetry', 'Privacy'],
    vsixSize: '1.9 MB',
    lastScanned: '2026-09-08'
  },
  {
    id: 'telemetry-mitigated',
    publisher: 'code-metrics',
    name: 'code-health-pro',
    version: '3.3.0',
    displayName: 'Code Health Pro',
    description: 'Same telemetry but respects isTelemetryEnabled — downgraded to MEDIUM.',
    icon: '📈',
    downloads: '18k',
    status: 'PASS',
    score: 82,
    findings: [
      { rule: 'signatures.telemetry_usage', severity: 'medium', message: 'Telemetry-related API usage in extension/src/reporter.js:11 (mitigated)', legitimateUse: 'Extensions often collect telemetry for diagnostics', redFlag: 'Has opt-out/mitigation detected', location: { file: 'extension/src/reporter.js', line: 11 } },
    ],
    categories: ['Telemetry', 'Mitigated'],
    vsixSize: '2.0 MB',
    lastScanned: '2026-09-10'
  },
  {
    id: 'typosquat-lodashh',
    publisher: 'json-fmt',
    name: 'json-formatter-plus',
    version: '1.1.0',
    displayName: 'JSON Formatter+',
    description: 'Bundles lodashh (typosquat of lodash) @ 0.0.1 + clean deps.',
    icon: '🧩',
    downloads: '33k',
    status: 'WARN',
    score: 58,
    findings: [
      { rule: 'dependency.typosquat', severity: 'medium', message: 'Dependency lodashh is within edit distance 1 of popular package lodash', redFlag: 'Possible typosquat targeting lodash', location: { file: 'extension/package-lock.json' }, newInThisVersion: true },
      { rule: 'dependency.osv_advisory', severity: 'high', message: 'Package minimist@1.2.5 has OSV advisory GHSA-xvch-5x4h-95sz', redFlag: 'Prototype pollution', location: { file: 'extension/package-lock.json' } },
      { rule: 'manifest.missing_lockfile', severity: 'low', message: 'No package-lock.json or yarn.lock included in the bundle — wait, this one DOES have it; flag suppressed', location: { file: 'extension/package.json' } },
    ],
    categories: ['Dependencies', 'Typosquat'],
    vsixSize: '1.1 MB',
    lastScanned: '2026-09-07'
  },
  {
    id: 'clean-prettier-fork',
    publisher: 'esbenp',
    name: 'prettier-vscode-fork',
    version: '9.0.2',
    displayName: 'Prettier Fork (clean)',
    description: 'Well-maintained fork; no sinks, no network, pinned deps.',
    icon: '✨',
    downloads: '890k',
    status: 'PASS',
    score: 96,
    findings: [
      { rule: 'manifest.declared_settings', severity: 'info', message: 'Declared 1 configuration setting', location: { file: 'extension/package.json' } }
    ],
    categories: ['Formatters', 'Clean'],
    vsixSize: '2.4 MB',
    lastScanned: '2026-09-12'
  },
  {
    id: 'insecure-http-extension',
    publisher: 'weather-now',
    name: 'weather-now',
    version: '0.8.0',
    displayName: 'Weather Now',
    description: 'Fetches weather over http (not https) — medium flagged.',
    icon: '⛅',
    downloads: '56k',
    status: 'WARN',
    score: 71,
    findings: [
      { rule: 'network.destination', severity: 'medium', message: 'Outbound network destination http://api.weather.example.com/data referenced in extension/src/fetch.ts:9', redFlag: 'Uses unencrypted http', location: { file: 'extension/src/fetch.ts', line: 9 } },
      { rule: 'static.source_to_shell', severity: 'high', message: 'Possible tainted data flowing to shell in extension/src/open.js:21 — fetch URL → exec curl', location: { file: 'extension/src/open.js', line: 21 } },
    ],
    categories: ['Network', 'Insecure'],
    vsixSize: '980 KB',
    lastScanned: '2026-09-09'
  },
  {
    id: 'glassworm-update',
    publisher: 'asyncapi-sim',
    name: 'asyncapi-preview',
    version: '0.12.0 → 0.12.1',
    displayName: 'AsyncAPI Preview (GlassWorm sim)',
    description: 'Clean v0.12.0 → malicious update v0.12.1: new shell sink + new dependency. The diff engine catches it.',
    icon: '🪱',
    downloads: '120k',
    status: 'BLOCK',
    score: 9,
    findings: [
      { rule: 'static.source_to_shell', severity: 'critical', message: 'Possible tainted data flowing to shell in extension/out/preview.js:88', location: { file: 'extension/out/preview.js', line: 88 }, newInThisVersion: true },
      { rule: 'dependency.typosquat', severity: 'medium', message: 'Dependency axioss is within edit distance 1 of popular package axios', location: { file: 'extension/package-lock.json' }, newInThisVersion: true },
      { rule: 'signatures.disguised_executable', severity: 'high', message: 'File extension/assets/icon.png contains executable magic bytes despite image extension', location: { file: 'extension/assets/icon.png' }, newInThisVersion: true },
      { rule: 'network.new_destination', severity: 'high', message: 'New outbound destination introduced: https://c2.glassworm.example/ping', location: { file: 'extension/out/preview.js' }, newInThisVersion: true },
      { rule: 'manifest.activation_star', severity: 'medium', message: 'New activationEvents entry "*" introduced in update', location: { file: 'extension/package.json' }, newInThisVersion: true },
    ],
    categories: ['Supply Chain', 'Update Attack'],
    vsixSize: '3.1 MB',
    lastScanned: '2026-09-11'
  },
]

export function getExample(id: string) {
  return examples.find(e => e.id === id)
}
