import { describe, it, expect } from 'vitest';
import path from 'path';
import { scanSignatures } from '../src/signatures/scan';

describe('signatures scanner (heuristic)', () => {
  it('detects disguised executable in png', async () => {
    const root = path.join(__dirname, 'fixtures', 'signature_png_disguised');
    const findings = await scanSignatures(root);
    expect(findings.some(f => f.rule === 'signatures.disguised_executable')).toBe(true);
  });

  it('flags telemetry without mitigation', async () => {
    const root = path.join(__dirname, 'fixtures', 'signature_telemetry_no_mit');
    const findings = await scanSignatures(root);
    const f = findings.find(f => f.rule === 'signatures.telemetry_usage');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('high');
  });

  it('downgrades telemetry with mitigation', async () => {
    const root = path.join(__dirname, 'fixtures', 'signature_telemetry_mitigated');
    const findings = await scanSignatures(root);
    const f = findings.find(f => f.rule === 'signatures.telemetry_usage');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('medium');
  });
});
