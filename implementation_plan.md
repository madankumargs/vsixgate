# VsixGate — Complete Fix & Improvement Plan

## Goal

Fix all identified bugs, integrate orphaned modules, expand test coverage, normalize paths for stable diffing, clean up code, and add missing features — bringing the project from ~60% to ~95% completion against the reference plan.

---

## Phase 1 — Critical Bug Fixes

### 1.1 Scoring Order Bug in `cli.ts`

The `manifest.untrusted_and_sinks` cross-check is added to findings **after** `scoreFindings()` runs, so it's invisible to the scoring engine.

#### [MODIFY] [cli.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/src/cli.ts)

**Fix**: Move the cross-check block (lines 158–171) to **before** the `scoreFindings()` call (line 155). The new order will be:

```
1. Collect allFindings
2. Run diffFindings
3. Detect new network destinations → push to diffed
4. Cross-check untrusted_and_sinks → push to diffed   ← MOVED UP
5. scoreFindings(diffed)                                ← NOW SEES ALL FINDINGS
6. Enrich with explanations
```

---

### 1.2 Diff Key Instability — Temp Path Normalization

`diffFindings()` uses `f.location?.file` which contains absolute temp-directory paths like `/tmp/vsixgate-abc123/extension/index.js`. Every scan gets different temp dirs, so identical findings across versions always appear "new".

#### [MODIFY] [diff/analyze.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/src/diff/analyze.ts)

**Fix**: Change `diffFindings` to strip the bundle root prefix from file paths when computing diff keys:

```typescript
export function diffFindings(previous: Finding[] | undefined, current: Finding[], bundleRoot?: string) {
  const normalize = (f: string | undefined) => {
    if (!f || !bundleRoot) return f || '';
    return f.replace(bundleRoot, '').replace(/^[\\/]+/, '');
  };
  const makeKey = (f: Finding) =>
    `${f.rule}|${normalize(f.location?.file)}|${f.location?.line || ''}|${f.message || ''}`;
  // ... rest unchanged
}
```

> [!IMPORTANT]
> This also requires updating `cli.ts` to pass `res.extractedPath` (the bundle root) to `diffFindings()`.

#### [MODIFY] All analyzer modules

Additionally, **all analyzers** should store `location.file` as relative paths from the bundle root. This affects:

- [static/analyze.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/src/static/analyze.ts) — currently uses `file` (absolute). Change to `path.relative(bundleRoot, file)`.
- [signatures/scan.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/src/signatures/scan.ts) — currently uses `path.relative(process.cwd(), file)`. Change to `path.relative(bundleRoot, file)`.
- [manifest/analyze.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/src/manifest/analyze.ts) — currently uses `manifestPath` (absolute). Change to `path.relative(bundleRoot, manifestPath)`.

---

## Phase 2 — CLI Overhaul & Report Integration

### 2.1 Wire `generateReport` into CLI

The report module exists but is never called. The CLI has duplicate inline output code.

#### [MODIFY] [cli.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/src/cli.ts)

Changes:
1. **Add CLI flags**: Replace `--json` with `--format <text|json|sarif>` (default: `text`) and add `--out <file>`.
2. **Import and call** `generateReport` from `src/report/generate.ts` for `json` and `sarif` formats.
3. **Keep the rich terminal output** (chalk tables, colors, figlet banner, mascot) for `text` format — this is the interactive experience. But delegate the actual data formatting to `generateReport` for consistency.
4. **Write to file** when `--out` is specified; otherwise print to stdout.
5. **Remove** the `--json` flag and the inline `JSON.stringify(report)` block.
6. **Add temp directory cleanup** using `fs.rmSync(res.extractedPath, { recursive: true, force: true })` in a `finally` block.

New CLI signature:
```
vsixgate scan <path>
  --format <text|json|sarif>   Output format (default: text)
  --out <file>                 Write report to file instead of stdout
  --strict                     Treat WARN as BLOCK
  --osv-api <url>              Custom OSV API endpoint
  --mascot-ascii <file>        Path to ASCII art file
```

---

### 2.2 Add `vsixgate.config.json` Support

#### [MODIFY] [scoring/score.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/src/scoring/score.ts)

Add config file loading:
```typescript
export interface ScoringConfig {
  strict?: boolean;
  blockOn?: Severity[];      // default: ['critical']
  warnOn?: Severity[];       // default: ['high', 'medium']
  blockOnNewHighSeverity?: boolean;  // default: true
}
```

Look for `vsixgate.config.json` in CWD, parse it, and merge with CLI flags (CLI flags take precedence).

---

## Phase 3 — Code Cleanup & Module Fixes

### 3.1 Remove Debug Log

#### [MODIFY] [dependency/analyze.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/src/dependency/analyze.ts#L31)

Delete line 31: `console.log('DEBUG: dependency analyzer loaded', ...)`

---

### 3.2 Add npm Lockfile v3 Support

#### [MODIFY] [dependency/analyze.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/src/dependency/analyze.ts)

Modern `package-lock.json` (lockfileVersion 3) uses a `packages` field instead of `dependencies`. Add parsing for both:

```typescript
let deps: Array<{name: string; version: string}> = [];
if (lock.packages) {
  // npm lockfile v3
  for (const [key, val] of Object.entries(lock.packages)) {
    if (!key || key === '') continue; // root package
    const name = key.replace(/^node_modules\//, '');
    deps.push({ name, version: (val as any).version });
  }
} else if (lock.dependencies) {
  // npm lockfile v1/v2
  deps = Object.keys(lock.dependencies).map(k => ({
    name: k,
    version: lock.dependencies[k].version
  }));
}
```

---

### 3.3 Fix CONTRIBUTING.md

#### [MODIFY] [CONTRIBUTING.md](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/CONTRIBUTING.md)

Replace lines 6–7 (corrupted PowerShell paste) with:

```markdown
## How to add Semgrep rules
```

---

### 3.4 Add Temp Cleanup to Unpack

#### [MODIFY] [unpack.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/src/unpack.ts)

Add a cleanup export:
```typescript
export function cleanupExtracted(extractedPath: string) {
  fs.rmSync(extractedPath, { recursive: true, force: true });
}
```

---

### 3.5 Delete Duplicate `.test.js` Files

#### [DELETE] test/dependency.test.js
#### [DELETE] test/diff.test.js
#### [DELETE] test/manifest.test.js
#### [DELETE] test/report.test.js
#### [DELETE] test/scoring.test.js
#### [DELETE] test/signatures.test.js
#### [DELETE] test/static.test.js

These compiled JS files alongside the `.ts` sources may cause Vitest to run tests twice.

---

## Phase 4 — Test Coverage Expansion

This is the largest phase. Every test module gets significant additions with new fixtures.

---

### 4.1 Manifest Tests

#### [MODIFY] [manifest.test.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/test/manifest.test.ts)

**New test cases** (6 additions → 10 total):
| # | Test | Fixture |
|---|------|---------|
| 5 | `detects untrustedWorkspaces.supported = true` | `with_untrusted_workspaces/package.json` |
| 6 | `detects untrustedWorkspaces.supported = 'limited'` | `with_untrusted_limited/package.json` |
| 7 | `flags extensionDependencies` | `with_ext_deps/package.json` |
| 8 | `does NOT flag normal activation events` | `with_normal_activation/package.json` |
| 9 | `extracts publisher, extensionName, version` | existing `minimal/package.json` |
| 10 | `handles missing untrustedWorkspaces gracefully` | existing `minimal/package.json` |

#### New fixture files:

**[NEW] `test/fixtures/with_untrusted_workspaces/package.json`**
```json
{
  "name": "untrusted-ext", "version": "1.0.0", "publisher": "test-pub",
  "capabilities": { "untrustedWorkspaces": { "supported": true } }
}
```

**[NEW] `test/fixtures/with_untrusted_limited/package.json`**
```json
{
  "name": "limited-ext", "version": "1.0.0", "publisher": "test-pub",
  "capabilities": { "untrustedWorkspaces": { "supported": "limited" } }
}
```

**[NEW] `test/fixtures/with_ext_deps/package.json`**
```json
{
  "name": "deps-ext", "version": "1.0.0", "publisher": "test-pub",
  "extensionDependencies": ["ms-python.python", "ms-vscode.cpptools"]
}
```

**[NEW] `test/fixtures/with_normal_activation/package.json`**
```json
{
  "name": "normal-ext", "version": "1.0.0", "publisher": "test-pub",
  "activationEvents": ["onCommand:extension.hello", "onLanguage:python"]
}
```

---

### 4.2 Static Analysis Tests

#### [MODIFY] [static.test.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/test/static.test.ts)

**New test cases** (6 additions → 8 total):
| # | Test | Fixture | Rule |
|---|------|---------|------|
| 3 | `flags eval with tainted source` | `static_eval_vuln/` | `static.source_to_eval` |
| 4 | `does not flag eval with JSON.parse mitigation` | `static_eval_safe/` | no finding |
| 5 | `flags file read flowing to write` | `static_write_vuln/` | `static.read_to_write` |
| 6 | `detects outbound network URLs` | `static_network/` | `network.destination` |
| 7 | `flags insecure http URLs higher than https` | `static_network/` | severity check |
| 8 | `does not flag hardcoded safe exec` | existing `static_safe/` | reconfirm |

#### New fixture files:

**[NEW] `test/fixtures/static_eval_vuln/index.js`**
```javascript
const vscode = require('vscode');
const val = vscode.workspace.getConfiguration('myext').get('cmd');
eval(val);
```

**[NEW] `test/fixtures/static_eval_safe/index.js`**
```javascript
const vscode = require('vscode');
const val = vscode.workspace.getConfiguration('myext').get('data');
const parsed = eval(JSON.parse(val));
```

**[NEW] `test/fixtures/static_write_vuln/index.js`**
```javascript
const fs = require('fs');
const data = fs.readFileSync('/some/external/path', 'utf8');
fs.writeFileSync('/home/user/.bashrc', data);
```

**[NEW] `test/fixtures/static_network/index.js`**
```javascript
const axios = require('axios');
axios.get('http://insecure.example.com/data');
fetch('https://secure.example.com/api');
```

---

### 4.3 Signatures Tests

#### [MODIFY] [signatures.test.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/test/signatures.test.ts)

**New test cases** (2 additions → 5 total):
| # | Test | Fixture |
|---|------|---------|
| 4 | `detects ELF magic in jpg` | `signature_elf_disguised/` |
| 5 | `no false positive on real image extension with safe content` | `signature_safe_image/` |

#### New fixture files:

**[NEW] `test/fixtures/signature_elf_disguised/file.jpg`**
Binary content: `\x7fELF` followed by padding bytes.

**[NEW] `test/fixtures/signature_safe_image/photo.png`**
Binary content: PNG header `\x89PNG\r\n\x1a\n` (valid PNG magic, should NOT trigger).

---

### 4.4 Dependency Tests

#### [MODIFY] [dependency.test.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/test/dependency.test.ts)

**New test cases** (4 additions → 6 total):
| # | Test | Fixture |
|---|------|---------|
| 3 | `produces no findings for clean lockfile` | `lock_clean/package-lock.json` |
| 4 | `parses npm lockfile v3 packages field` | `lock_v3/package-lock.json` |
| 5 | `does not flag exact match as typosquat (distance 0)` | inline |
| 6 | `does not flag distance > 2 as typosquat` | `lock_far_name/package-lock.json` |

#### New fixture files:

**[NEW] `test/fixtures/lock_clean/package-lock.json`**
```json
{
  "name": "clean-lock", "lockfileVersion": 2,
  "dependencies": { "lodash": { "version": "4.17.21" } }
}
```

**[NEW] `test/fixtures/lock_v3/package-lock.json`**
```json
{
  "name": "v3-lock", "lockfileVersion": 3,
  "packages": {
    "": { "name": "v3-lock", "version": "1.0.0" },
    "node_modules/lodashh": { "version": "0.0.1" }
  }
}
```

**[NEW] `test/fixtures/lock_far_name/package-lock.json`**
```json
{
  "name": "far-lock", "lockfileVersion": 2,
  "dependencies": { "completely-different-pkg": { "version": "1.0.0" } }
}
```

---

### 4.5 Diff Engine Tests

#### [MODIFY] [diff.test.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/test/diff.test.ts)

**New test cases** (4 additions → 5 total):
| # | Test |
|---|------|
| 2 | `first scan (no baseline) marks nothing as new` |
| 3 | `re-scanning same version does not create duplicate new findings` |
| 4 | `diffFindings uses normalized paths (ignoring bundle root prefix)` |
| 5 | `handles empty previous findings gracefully` |

---

### 4.6 Scoring Tests

#### [MODIFY] [scoring.test.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/test/scoring.test.ts)

**New test cases** (3 additions → 9 total):
| # | Test |
|---|------|
| 7 | `strict mode converts WARN to BLOCK` |
| 8 | `pre-existing high without newInThisVersion produces WARN` |
| 9 | `empty findings array produces PASS` |

---

### 4.7 Report Tests

#### [MODIFY] [report.test.ts](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/test/report.test.ts)

**New test cases** (5 additions → 8 total):
| # | Test |
|---|------|
| 4 | `SARIF maps critical/high to error level` |
| 5 | `SARIF maps medium to warning level` |
| 6 | `SARIF maps low/info to note level` |
| 7 | `SARIF omits location when finding has no location` |
| 8 | `text format includes legitimateUse and redFlag` |

---

## Phase 5 — Documentation & CI Updates

### 5.1 Update CI Workflow

#### [MODIFY] [vsixgate.yml](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/.github/workflows/vsixgate.yml)

Update the scan command to use new `--format` and `--out` flags:
```yaml
run: node dist/src/cli.js scan . --format sarif --out results.sarif || exit $?
```
(This will now work since cli.ts will support these flags.)

---

### 5.2 Update CI Usage Docs

#### [MODIFY] [ci-usage.md](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/docs/ci-usage.md)

Update the documented CLI flags to match the new interface (`--format`, `--out` instead of `--json`).

---

### 5.3 Update Schema Docs

#### [MODIFY] [schema.md](file:///c:/Users/madan/OneDrive/Desktop/vsixgate/docs/schema.md)

Add `securityScore` field and `explanation`/`recommendation` enrichment fields to the documented schema.

---

## Verification Plan

### Automated Tests
```bash
npm test
```
All existing tests must continue to pass. All new tests must pass. Expected: **~40+ test cases** across 7 suites.

### Build Verification
```bash
npm run build
```
TypeScript must compile cleanly with strict mode.

### End-to-End Smoke Test
```bash
node dist/src/cli.js scan ./fixtures/sample.vsix --format sarif --out test-results.sarif
node dist/src/cli.js scan ./fixtures/sample.vsix --format json
node dist/src/cli.js scan ./fixtures/sample.vsix --format text
```
Verify SARIF file is written, JSON outputs valid JSON, and text shows the findings table.

### Manual Verification
- Confirm `.test.js` duplicates are deleted
- Confirm no `DEBUG:` output appears during scans
- Confirm CONTRIBUTING.md reads correctly
- Confirm diff engine correctly marks findings as not-new when rescanning same extension

---

## Summary of Changes

| Category | Files Modified | Files Created | Files Deleted |
|:---|:---:|:---:|:---:|
| **Bug fixes** (Phase 1) | 5 | 0 | 0 |
| **CLI overhaul** (Phase 2) | 2 | 0 | 0 |
| **Code cleanup** (Phase 3) | 3 | 0 | 7 |
| **Test expansion** (Phase 4) | 7 | 14 | 0 |
| **Documentation** (Phase 5) | 3 | 0 | 0 |
| **Totals** | **20** | **14** | **7** |
