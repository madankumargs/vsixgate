# vsixgate

vsixgate is a pre-publish security scanner for VS Code/Open VSX extensions. It unpacks
`.vsix` bundles, analyzes the manifest and source code for risky patterns, checks
dependencies and signatures, performs dependency and typosquat analysis, and produces
SARIF/text/JSON reports for CI gating.

Installation
------------

Install globally from a local package (example for v0.1.0):

```bash
npm install -g ./vsixgate-0.1.0.tgz
```

Development
-----------

Install dev dependencies and run tests:

```bash
npm install
npm test
```

Quick usage
-----------

Unpack and scan a local `.vsix` or an unpacked extension directory:

```bash
npm run build
node dist/src/cli.js scan ./fixtures/sample.vsix
```

Produce SARIF for CI (example):

```bash
node dist/src/cli.js scan ./fixtures/sample.vsix --format sarif --out results.sarif
```

Limitations
-----------

- Many analyzers are heuristic placeholders intended to be replaced with full Semgrep
	and YARA-X integrations in production.
- No real malware samples are included; fixtures simulate benign-equivalent patterns.
- Typosquat detection uses a simple Levenshtein heuristic against a cached top-packages
	list and may require tuning for production.

