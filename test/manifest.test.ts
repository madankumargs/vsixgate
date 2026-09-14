import { describe, it, expect } from 'vitest';
import path from 'path';
import { analyzeManifest } from '../src/manifest/analyze';

describe('manifest analyzer', () => {
  it('finds activationEvents star', async () => {
    const manifest = path.join(__dirname, 'fixtures', 'with_star_activation', 'package.json');
    const r = await analyzeManifest(manifest, path.dirname(manifest));
    const actFlags = r.activationEvents.flags;
    expect(actFlags.some(f => f.rule === 'manifest.activation_star')).toBe(true);
  });

  it('lists declared settings', async () => {
    const manifest = path.join(__dirname, 'fixtures', 'minimal', 'package.json');
    const r = await analyzeManifest(manifest, path.dirname(manifest));
    expect(Array.isArray(r.declaredSettings)).toBe(true);
  });

  it('detects missing lockfile', async () => {
    const manifest = path.join(__dirname, 'fixtures', 'minimal', 'package.json');
    const r = await analyzeManifest(manifest, path.dirname(manifest));
    expect(r.hasLockfile).toBe(false);
    expect(r.findings.some(f => f.rule === 'manifest.missing_lockfile')).toBe(true);
  });

  it('respects present lockfile', async () => {
    const manifest = path.join(__dirname, 'fixtures', 'with_lockfile', 'package.json');
    const r = await analyzeManifest(manifest, path.dirname(manifest));
    expect(r.hasLockfile).toBe(true);
  });

  it('flags risky install scripts and suspicious build scripts', async () => {
    const manifest = path.join(__dirname, 'fixtures', 'manifest_risky', 'package.json');
    const r = await analyzeManifest(manifest, path.dirname(manifest));
    expect(r.findings.some(f => f.rule === 'manifest.risky_install_script' && f.severity === 'high')).toBe(true);
    expect(r.findings.some(f => f.rule === 'manifest.suspicious_script' && f.severity === 'medium')).toBe(true);
  });

  it('does not flag clean scripts', async () => {
    const manifest = path.join(__dirname, 'fixtures', 'manifest_clean', 'package.json');
    const r = await analyzeManifest(manifest, path.dirname(manifest));
    expect(r.findings.some(f => f.rule === 'manifest.risky_install_script')).toBe(false);
    expect(r.findings.some(f => f.rule === 'manifest.suspicious_script')).toBe(false);
  });

  it('flags outdated and unbounded engines, passes modern pin', async () => {
    const risky = path.join(__dirname, 'fixtures', 'manifest_risky', 'package.json');
    const r1 = await analyzeManifest(risky, path.dirname(risky));
    expect(r1.findings.some(f => f.rule === 'manifest.outdated_engine')).toBe(true);

    const clean = path.join(__dirname, 'fixtures', 'manifest_clean', 'package.json');
    const r2 = await analyzeManifest(clean, path.dirname(clean));
    expect(r2.findings.some(f => f.rule.startsWith('manifest.') && f.rule.includes('engine'))).toBe(false);

    const minimal = path.join(__dirname, 'fixtures', 'minimal', 'package.json');
    const r3 = await analyzeManifest(minimal, path.dirname(minimal));
    expect(r3.findings.some(f => f.rule === 'manifest.missing_engines')).toBe(true);
  });
});
