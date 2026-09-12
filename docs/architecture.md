# Architecture Overview

VsixGate is organized as a pipeline of modular analyzers. Each analyzer consumes
an unpacked extension bundle (the `.vsix` archive extracted to a temporary
directory) and emits `Finding[]` objects described in the schema documentation.

Pipeline stages:

- Unpack: extracts `.vsix` to a temporary directory and locates `package.json`.
- Manifest analysis: inspects `package.json` for activationEvents, contributes,
  capabilities, extensionDependencies, and lockfile presence.
- Static analysis: pattern-based detection (placeholder heuristics in v0.1) for
  source→sink flows (workspace settings → shell, eval, file writes).
- Signatures: YARA-like rules to detect disguised binaries and telemetry patterns.
- Dependency analysis: parse lockfile, consult OSV (pluggable), and detect
  possible typosquats against a cached top-packages list.
- Diff engine: compare current findings to the last recorded scan for
  publisher+extension to flag `newInThisVersion` findings.
- Scoring: apply severity adjustments (mitigation downgrades, novelty rules)
  and compute aggregate BLOCK/WARN/PASS status.
- Reporting: emit human-readable text, JSON, or SARIF 2.1.0 outputs for CI
  integration.

Storage and CI

- By default v0.1 stores scan history as JSON in `.vsixgate/scans.json` in the
  current working directory. This is a simple fallback to avoid requiring
  native SQLite in early development — migrating to `better-sqlite3` is planned.
- A GitHub Action workflow is provided to run a scan and upload SARIF results.
