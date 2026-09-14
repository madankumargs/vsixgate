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

  it('stores bundle-relative paths (stable across tmp dirs)', async () => {
    const root = path.join(__dirname, 'fixtures', 'signature_png_disguised');
    const findings = await scanSignatures(root);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.location?.file).not.toMatch(/^[A-Za-z]:\\/);
    }
  });

  it('flags embedded secrets and ignores clean code', async () => {
    const bad = await scanSignatures(path.join(__dirname, 'fixtures', 'secret_key'));
    const hit = bad.find(f => f.rule === 'secret.embedded_key');
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe('high');

    const good = await scanSignatures(path.join(__dirname, 'fixtures', 'secret_clean'));
    expect(good.some(f => f.rule === 'secret.embedded_key')).toBe(false);
  });

  it('flags prebuilt .node binaries, downgrades lone binding.gyp', async () => {
    const bin = await scanSignatures(path.join(__dirname, 'fixtures', 'native_binary'));
    const b = bin.find(f => f.rule === 'native.binary_present');
    expect(b).toBeDefined();
    expect(b?.severity).toBe('medium');

    const gyp = await scanSignatures(path.join(__dirname, 'fixtures', 'native_gyp_only'));
    const g = gyp.find(f => f.rule === 'native.binary_present');
    expect(g).toBeDefined();
    expect(g?.severity).toBe('low');
  });
});
