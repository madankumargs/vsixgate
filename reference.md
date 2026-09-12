Step 0 — Project Scaffold & Architecture Decisions

AGENT PROMPT:

Set up a new TypeScript CLI project called "vsixgate".

Requirements:
- Node.js 20+, TypeScript, npm package (installable globally as `vsixgate`)
- Use `commander` or `yargs` for CLI argument parsing
- Project structure:
  /src
    /manifest    -> manifest parsing module (Step 1)
    /static      -> taint/pattern analysis module (Step 2)
    /signatures  -> YARA-X integration module (Step 3)
    /dependency  -> dependency graph analysis module (Step 4)
    /diff        -> version diff engine module (Step 5)
    /scoring     -> severity scoring module (Step 6)
    /report      -> output generation module (Step 7)
    /cli.ts      -> CLI entrypoint wiring the above
  /test
  /fixtures      -> sample .vsix files and extracted manifests for testing
  /docs
- Set up: ESLint, Prettier, Vitest (or Jest) for testing, tsconfig with strict mode.
- Add a `.vsix` unpacking utility in /src/unpack.ts using a zip library (e.g. `yauzl` or
  `adm-zip`) since .vsix files are just zip archives — extract to a temp directory and
  return the path + parsed package.json location.
- Create a placeholder `vsixgate scan <path-or-marketplace-id>` command that just unpacks
  and prints the manifest for now — later steps will fill in each analysis module.
- Write a README stub explaining the project's purpose and architecture (one paragraph),
  to be expanded in Step 10.

Acceptance criteria: `vsixgate scan ./fixtures/sample.vsix` unpacks the file, locates and
pretty-prints its package.json, and exits 0. Add one fixture: a minimal valid VS Code
extension .vsix (you can construct one with a trivial package.json and a small JS file
zipped up, no need for a real marketplace download yet).
Step 1 — Manifest Analysis Module

AGENT PROMPT:

Implement /src/manifest/analyze.ts for the vsixgate project (scaffolded in Step 0).

Context: VS Code extension manifests (package.json) declare activationEvents,
contributes, capabilities, and extensionDependencies. Risk signals to detect:

1. activationEvents containing "*" (activates on VS Code startup, broadest possible
   trigger) — flag as MEDIUM, note it's broad but common for legitimate extensions too.
2. contributes.configuration fields — enumerate every user-settable setting; each one is
   a potential taint source per the UntrustIDE academic threat model (workspace settings
   flowing into shell commands or eval() are the highest-risk pattern found in real
   extensions). Just enumerate them here; Step 2 will check if they flow to a sink.
3. capabilities.untrustedWorkspaces.supported === true — flag as a claim to verify later
   against Step 2's findings (if the code has shell/file-write sinks, this claim is
   suspicious and should be escalated).
4. extensionDependencies — flag any declared dependency on another extension (execution
   context sharing risk).
5. Missing/absent lockfile (package-lock.json or yarn.lock) in the unpacked bundle — flag
   as LOW, note it blocks reliable transitive dependency analysis in Step 4.
6. Publisher field vs. known-verified-publisher heuristics — for v1, just extract and
   surface the publisher ID and extension version so Step 5 (diffing) can key off it
   later; don't build reputation scoring yet.

Output: a structured object:
{
  activationEvents: { value: string[], flags: Finding[] },
  declaredSettings: string[],
  untrustedWorkspacesClaim: boolean | 'limited' | undefined,
  extensionDependencies: string[],
  hasLockfile: boolean,
  publisher: string,
  extensionName: string,
  version: string,
  findings: Finding[]  // shared Finding type: { rule, severity, message, location? }
}

Define the shared `Finding` type in /src/types.ts since every module (static, signatures,
dependency, diff) will emit findings in this same shape — this is the contract that Step 6
(scoring) and Step 7 (reporting) depend on. Use:

interface Finding {
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  legitimateUse?: string;   // why this pattern exists in benign extensions
  redFlag?: string;         // what makes it suspicious here specifically
  location?: { file: string; line?: number };
  newInThisVersion?: boolean; // filled in later by the diff engine, default undefined
}

Write unit tests covering each of the 6 signals above using constructed fixture manifests
(valid cases and flagged cases for each rule).

Acceptance criteria: `vsixgate scan` now prints manifest findings in addition to the raw
manifest. All 6 rules have passing tests with both a triggering and non-triggering fixture.
Step 2 — Static Taint Analysis (Semgrep-based)

AGENT PROMPT:

Implement /src/static/analyze.ts using Semgrep as the pattern-matching engine, encoding
the UntrustIDE taint source→sink model (NDSS 2024 paper on VS Code extension security).

Sources (4): workspace settings (vscode.workspace.getConfiguration), file reads
(fs.readFile/readFileSync, vscode.workspace.fs.readFile), network responses (http.get,
http.request, axios.get, insecure http:// URLs), local web server input (express route
handlers, server.listen()).

Sinks (3): shell command execution (child_process.exec/spawn, shelljs.exec), eval() of
unbracketed strings (bracketed strings are usually JSON parsing, not code injection —
exclude those per the paper's own filtering method), file writes where BOTH the path and
content arguments trace to a source (this dual-taint requirement matters — file writes
with a hardcoded path are much lower risk).

Steps:
1. Add Semgrep as a subprocess dependency (shell out to a locally-installed `semgrep`
   binary, or use the `@semgrep/semgrep` npm wrapper if available — check what's current).
2. Write Semgrep rules (YAML) for each of the 4 sources × 3 sinks = up to 12 source-sink
   pairs, stored in /src/static/rules/*.yml. Since Semgrep is pattern-based rather than
   full dataflow like CodeQL, encode each rule as: "flag when a variable assigned from a
   source pattern is later passed into a sink pattern within the same function or file" —
   use Semgrep's taint mode (`mode: taint`, with `pattern-sources` and `pattern-sinks`)
   which supports exactly this source→sink modeling natively.
3. Apply the filtering heuristics from the paper to reduce false positives:
   - File reads from paths inside the extension's own bundled directory = trusted, exclude.
   - eval() calls with `(...)`-wrapped string arguments = likely JSON, downgrade severity
     rather than treating as full code injection.
4. Parse Semgrep's JSON output into the shared `Finding[]` format from Step 1, populating
   `legitimateUse` and `redFlag` fields with the context UntrustIDE's own case studies
   describe (e.g. for workspace-setting→shell: legitimateUse = "extensions often let users
   configure a tool path (e.g. git.path) and pass it to a subprocess", redFlag = "no
   validation/allowlist on the configured value before passing to child_process").

Test fixtures: recreate simplified versions of the actual vulnerable code patterns from
the paper (git-graph's git.path → cp.spawn flow; scss-lint's eval(workspace setting)
flow) as test cases, and confirm they're correctly flagged. Also include a "safe" fixture
per pattern (e.g. a hardcoded shell command with no tainted input) confirmed NOT flagged.

Acceptance criteria: running against the two reconstructed vulnerable fixtures produces a
HIGH/CRITICAL finding citing the correct source→sink pair; running against the safe
fixtures produces no finding for that rule.
Step 3 — Signature / IOC Matching Layer

AGENT PROMPT:

Implement /src/signatures/scan.ts using YARA-X to match known malware campaign signatures.

1. Add yara-x as a dependency (Node bindings — check current package name/API, likely
   `yara-x` on npm or a WASM build; confirm before implementing).
2. Build or vendor a starter rule set in /src/signatures/rules/*.yar covering patterns
   documented in public research: obfuscated payloads disguised as image files (the
   "malicious PNG containing a binary" pattern from the December 2025 ReversingLabs
   campaign), typosquat package names bundled in node_modules, known C2 patterns from
   OctoRAT-style loaders. Do not reproduce exact IOCs from any single vendor's private
   threat feed without permission — write original detection rules based on publicly
   documented *behavioral* patterns (e.g. "archive file with .png extension containing
   PE/ELF magic bytes" is a generic, reusable rule, not a copied signature).
3. Implement the "opt-out mitigation" severity model: for any rule tagged as
   `mitigatable: true` (e.g. a telemetry/tracking pattern), check for a paired mitigation
   pattern nearby (e.g. a reference to `vscode.env.isTelemetryEnabled` or a
   `contributes.configuration` entry with "telemetry" in its key) in the same file. If
   found, downgrade the finding's severity by one level rather than suppressing it.
4. Structure the ruleset so new rules can be added without code changes — rules directory
   is scanned at runtime.

Test fixtures: a fixture with a PNG-disguised archive (construct a minimal file with PE
magic bytes renamed to .png inside a zip, don't use a real malware sample), a fixture with
a telemetry-sending pattern with no opt-out (should stay high severity), and one with the
same pattern plus an opt-out check (should downgrade).

Acceptance criteria: all three fixtures produce the expected severity level; adding a new
.yar file to the rules directory is picked up without any code change.
Step 4 — Dependency Graph & Typosquat Analysis

AGENT PROMPT:

Implement /src/dependency/analyze.ts.

1. Parse package-lock.json or yarn.lock if present (flag absence per Step 1's finding —
   this module can't do transitive analysis without one).
2. Build the full dependency tree from the lockfile.
3. Cross-reference every package@version against the OSV API (https://osv.dev API, free,
   no key required) for known advisories. Flag any dependency with a critical or high
   severity advisory.
4. Typosquat check: maintain a static list of the top ~2,000 npm packages by weekly
   downloads (fetch once, cache locally, refresh on a schedule — don't hit the npm API on
   every scan). For every dependency name, compute Levenshtein distance against this list;
   flag any dependency within edit-distance 1-2 of a popular package it is NOT (i.e.
   excludes exact matches) as a possible typosquat, with the suspected target package
   named in the finding.
5. Emit findings in the shared Finding[] format, with severity scaled by advisory severity
   and by how many install-weighted downstream packages depend on the flagged package if
   that data is available from OSV.

Test fixtures: a lockfile with a package matching a known OSV advisory (use a real
low-risk/informational advisory for testing, not a critical one, to avoid embedding
exploit-relevant data in the test suite), and a lockfile with a deliberately misspelled
popular package name (e.g. "lodashh") to test the typosquat detector.

Acceptance criteria: both fixtures produce correctly labeled findings; a lockfile with only
well-known, unflagged packages produces no findings.
Step 5 — Version Diff Engine

AGENT PROMPT:

Implement /src/diff/analyze.ts — this is the project's core differentiator, so give it
extra care.

Purpose: when a publisher runs vsixgate on a new version of an extension they've
previously published, compare against the last scanned version and flag NEW risk that
wasn't present before — this is the layer that would catch an AsyncAPI/GlassWorm-style
"clean extension, malicious update" pattern.

1. Storage: use SQLite (via `better-sqlite3`) to persist, per publisher.extension-id: the
   manifest, dependency tree, and the list of Finding[] from every previous scan, keyed by
   version. Schema:
   scans(id, publisher, extension_name, version, scanned_at, manifest_json, findings_json)
2. On each scan, after running Steps 1-4, look up the most recent prior scan for the same
   publisher.extension-id (if any).
3. Diff logic:
   - Manifest diff: new entries in activationEvents, contributes.configuration,
     extensionDependencies, or a capabilities.untrustedWorkspaces claim that changed.
   - Dependency diff: newly added packages, and version bumps where the new version has a
     different OSV advisory status than the old one.
   - Findings diff: any Finding from Steps 2-4 whose rule+location combination did NOT
     appear in the prior scan gets `newInThisVersion: true` set.
4. In the report (Step 7), anything with `newInThisVersion: true` should be surfaced most
   prominently — a CI gate should be configured to treat NEW findings as blocking even at
   lower severity than pre-existing ones, since novelty in an update is the strongest
   signal from real-world incidents.
5. Handle the first-ever scan of an extension gracefully (no prior version = no diff
   findings, just note "no baseline, all findings are first-seen" in the report).

Test fixtures: simulate two versions of the same fixture extension — v1 clean, v2 with an
added child_process.exec call — and confirm the diff engine flags exactly that addition as
`newInThisVersion: true`, and that re-scanning v1 again afterward doesn't create duplicate
"new" findings.

Acceptance criteria: the two-version simulation passes; running the same version twice
produces stable, non-duplicated findings.
Step 6 — Severity Scoring Engine

AGENT PROMPT:

Implement /src/scoring/score.ts.

Combine findings from all prior modules (manifest, static, signatures, dependency, diff)
into a final composite report-level score, without collapsing individual findings — the
report should show both the aggregate and the itemized list.

Scoring model per finding:
final_severity = base_severity (from the rule itself)
                adjusted by: context_modifier (mitigation present → downgrade one level,
                  as implemented in Step 3)
                adjusted by: novelty_modifier (newInThisVersion === true → do NOT
                  downgrade even if it would otherwise be borderline; novel findings on an
                  update should never be silently softened)

Aggregate extension-level score: report the count of findings at each final severity level
(critical/high/medium/low/info), plus a single top-line status:
- BLOCK if any critical, or any high-severity finding with newInThisVersion === true
- WARN if any high/medium finding without newInThisVersion, or any unscored/uncertain
  finding (e.g. from obfuscated code the static analyzer couldn't fully parse — Step 2/3
  should propagate an "uncertain" flag for this case, distinct from "clean")
- PASS otherwise

This BLOCK/WARN/PASS status is what maps directly to the CI exit code in Step 8 — make the
thresholds configurable via a config file (vsixgate.config.json) so teams can tune
strictness without code changes.

Test fixtures: construct finding sets that should produce each of BLOCK/WARN/PASS and
confirm correct classification, including the "uncertain from obfuscation" case
specifically resulting in WARN, not silently passing.

Acceptance criteria: all three status paths have passing tests; the never-downgrade-novel
rule is explicitly tested (a novel finding that would score MEDIUM after mitigation
adjustment must still trigger WARN status, not be silently absorbed).
Step 7 — Report Generation (Text / JSON / SARIF)

AGENT PROMPT:

Implement /src/report/generate.ts with three output formats selectable via CLI flag
(--format text|json|sarif, default text).

Text: human-readable, grouped by severity, each finding shown with rule name, message,
legitimateUse/redFlag context (from the Finding type), and location if available. Show the
aggregate BLOCK/WARN/PASS status prominently at the top.

JSON: full structured dump of all findings plus the aggregate scoring result — this is for
downstream tooling to consume, so keep the schema stable and documented in /docs/schema.md.

SARIF: implement to the SARIF 2.1.0 spec (https://docs.oasis-open.org/sarif/sarif/v2.1.0/) —
this is what makes vsixgate usable as a GitHub Actions / GitLab CI annotation source. Map:
- Finding.rule → SARIF rule id
- Finding.severity → SARIF level (critical/high → "error", medium → "warning",
  low/info → "note")
- Finding.location → SARIF physicalLocation (if no file/line available, omit location
  block per spec rather than fabricating one)
- Include a `runs[0].tool.driver` block identifying vsixgate with its version.

Validate the SARIF output against a public SARIF validator or schema before considering
this step done — malformed SARIF silently fails to render in GitHub's UI, which would
defeat the whole point of this output mode.

Acceptance criteria: same finding set produces all three formats; SARIF output validates
against the 2.1.0 schema; text output is legible without any other tooling.
Step 8 — CLI Wrapper, Exit Codes & CI Integration

AGENT PROMPT:

Finalize /src/cli.ts and add CI integration.

CLI commands:
- `vsixgate scan <path-or-publisher.extension-id>` — runs all modules (Steps 1-6) against
  a local .vsix file or downloads from the marketplace by ID (implement marketplace
  download via the public VS Code Marketplace API or Open VSX API — support both with a
  --registry flag, defaulting to vscode).
- `vsixgate scan --format sarif --out results.sarif` — for CI use.
- Exit codes: 0 for PASS, 1 for WARN, 2 for BLOCK — standard convention so CI systems can
  gate on this directly without parsing output.
- `--strict` flag: treat WARN as exit code 2 as well (some teams want zero-tolerance).

CI Integration: write a GitHub Action (/action.yml + supporting script) that:
1. Installs vsixgate.
2. Runs `vsixgate scan . --format sarif --out results.sarif` against the current repo
   (packaging it as a .vsix first via `vsce package` if not already built).
3. Uploads the SARIF file using `github/codeql-action/upload-sarif` so findings appear as
   inline PR annotations.
4. Fails the workflow step based on the exit code from vsixgate itself.

Write a usage example in /docs/ci-usage.md showing a full `.github/workflows/vsixgate.yml`
that publishers can copy directly into their own extension repos.

Acceptance criteria: running the Action against this project's own test fixtures in a
sample workflow succeeds/fails correctly based on fixture severity; SARIF renders correctly
as annotations in a test PR.
Step 9 — Test Suite & Evaluation Harness

AGENT PROMPT:

Build an evaluation harness distinct from the unit tests already written per-module.

1. /eval/known-malicious — a directory structure (not committed with real malware; use
   placeholder/reconstructed benign-equivalent fixtures with clear comments marking what
   real-world pattern each one simulates, referencing public writeups by name e.g.
   "simulates GlassWorm's PNG-disguised archive pattern per Socket's public writeup") for
   recall testing.
2. /eval/known-legitimate — pull manifests (not full code, to keep the repo small) from a
   handful of popular, well-known extensions' public GitHub repos (with attribution) to
   run false-positive testing against real-world code structure, not just synthetic
   fixtures.
3. Write /eval/run-eval.ts that runs vsixgate against both directories and outputs:
   - Recall: % of known-malicious fixtures correctly flagged at WARN or BLOCK.
   - False positive rate: % of known-legitimate fixtures incorrectly flagged at BLOCK.
   - A per-fixture breakdown so failures are debuggable, not just an aggregate number.
4. Document how to add new fixtures to this harness as new campaigns get publicly
   documented, so the evaluation set grows over time instead of going stale.

Acceptance criteria: `npm run eval` produces a readable recall/FP report; the harness is
documented well enough that adding one new fixture requires editing only the eval
directory, no code changes.
Step 10 — Packaging, Documentation, and Release

AGENT PROMPT:

Prepare vsixgate for public release.

1. Write a complete README.md: what it is, the pre-publish gap it addresses (cite the
   general research landscape, not specific vendors' proprietary claims), install
   instructions (`npm install -g vsixgate`), CLI usage examples for all commands, the
   GitHub Action snippet from Step 8, and a clear "Limitations" section (obfuscated code,
   heuristic-based typosquat detection, static-analysis-only — no dynamic/sandboxed
   execution in v1) so users have accurate expectations.
2. Write /docs/architecture.md summarizing the module pipeline (Steps 1-7) at a level a
   new contributor could understand without reading all the source.
3. Write /docs/schema.md documenting the Finding type and JSON output schema.
4. Set up package.json for npm publish: bin entry pointing to the CLI, files whitelist,
   license (MIT or Apache-2.0 — pick one and add LICENSE file), keywords for discoverability
   (vscode, security, vsix, extension, scanner, sast).
5. Add a CONTRIBUTING.md explaining how to add new Semgrep rules (Step 2) or YARA rules
   (Step 3) — since the ruleset is the part most likely to get community contributions.
6. Tag a v0.1.0 release.

Acceptance criteria: `npm pack` produces a valid installable tarball; a fresh
`npm install -g ./vsixgate-0.1.0.tgz` followed by `vsixgate scan ./fixtures/sample.vsix`
works end to end with no missing dependencies.
Project Summary (for README / pitch use)

VsixGate is an open-source, pre-publish security scanner for VS Code and Open VSX extensions. Unlike existing tools (ExtensionTotal/Koi, vsix-audit, VSCan), which all scan extensions after they're already published or installed, VsixGate runs in a publisher's own CI pipeline before vsce publish — combining manifest analysis, taint-based static analysis grounded in the peer-reviewed UntrustIDE threat model (NDSS 2024), signature matching against documented malware campaigns, dependency/typosquat risk analysis, and — its core differentiator — a version-diff engine that flags newly introduced risky behavior between an extension's releases, the exact pattern behind real incidents like the AsyncAPI and GlassWorm compromises. It outputs SARIF for native CI annotation, making it a drop-in gate for extension teams rather than another dashboard to check.