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
});
