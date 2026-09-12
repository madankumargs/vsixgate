# CI / GitHub Actions Usage

An example GitHub Action workflow is included at `.github/workflows/vsixgate.yml`.
It builds the project, runs `vsixgate` against the repository, and uploads SARIF
results for GitHub code scanning.

Basic steps performed by the workflow:

1. Checkout repository
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Build (`npm run build`)
5. Run `node dist/src/cli.js scan . --format sarif --out results.sarif`
6. Upload `results.sarif` via `github/codeql-action/upload-sarif`

Notes:

- Ensure Semgrep / YARA-X binaries are available in CI if you replace the
  heuristic engines with native integrations (the included workflow assumes the
  JS-only heuristics present in v0.1).
- The workflow exits with the CLI exit code so a `BLOCK` status will fail the
  job; use the `--strict` flag in `cli.js` to treat `WARN` as blocking as well.
