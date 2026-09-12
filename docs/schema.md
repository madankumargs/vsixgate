# JSON Output Schema

Finding (shared across modules)

- `rule` (string): canonical rule identifier, e.g. `static.source_to_shell`.
- `severity` (string): one of `critical | high | medium | low | info`.
- `message` (string): short human message describing the finding.
- `legitimateUse` (string, optional): explanation of why this pattern may be
  benign in some extensions.
- `redFlag` (string, optional): why this instance is suspicious in context.
- `location` (object, optional): `{ file: string; line?: number }` pointing to
  the file and line where the finding was observed.
- `newInThisVersion` (boolean, optional): set by the diff engine if the finding
  did not exist in the prior recorded scan for this publisher+extension.

Top-level report JSON (CLI `--format json`) contains:

```
{
  manifest: { ...manifestAnalysisResult },
  findings: Finding[],
  scoring: {
    counts: { critical, high, medium, low, info },
    status: 'BLOCK'|'WARN'|'PASS'
  }
}
```

SARIF mapping

- `Finding.rule` → SARIF `ruleId`
- `Finding.severity` → SARIF level (`critical|high` => `error`, `medium` => `warning`, else `note`)
- `Finding.location` → SARIF physicalLocation (omitted if location absent)
