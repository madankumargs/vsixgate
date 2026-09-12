# Contributing

Thank you for considering contributing to VsixGate. Contributions that improve
rulesets, add test fixtures, or harden the analyzers are especially welcome.

How to addRemove-Item -Force .vsixgate\scans.sqlite -ErrorAction SilentlyContinue
Remove-Item -Force .vsixgate\scans.json -ErrorAction SilentlyContinue Semgrep rules

1. Place new YAML rule files under `src/static/rules/`.
2. Follow Semgrep's `mode: taint` pattern for source→sink rules where possible.
3. Add fixture code in `test/fixtures/` and a unit test in `test/` mirroring existing
   test structure.

How to add YARA rules

1. Add `.yar` files under `src/signatures/rules/`.
2. Ensure rules are written generically (behavioral patterns) and do not include
   private vendor IOCs or real malware samples.

Testing

Run the full test suite with:

```bash
npm test
```
