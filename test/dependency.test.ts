import { describe, it, expect } from 'vitest';
import path from 'path';
import { analyzeDependencies } from '../src/dependency/analyze';

describe('dependency analyzer', () => {
  it('flags OSV advisory from lookup', async () => {
    const lock = path.join(__dirname, 'fixtures', 'lock_with_advisory', 'package-lock.json');
    const fakeLookup = async (name: string, version: string) => {
      if (name === 'vuln-pkg') return { advisories: [{ id: 'OSV-TEST-1', severity: 'HIGH', summary: 'Test advisory' }] };
      return {};
    };
    const findings = await analyzeDependencies(lock, { osvLookup: fakeLookup, topPackagesPath: path.join(__dirname, 'fixtures', 'top_packages.json') });
    expect(findings.some(f => f.rule === 'dependency.osv_advisory')).toBe(true);
  });

  it('detects typosquat', async () => {
    const lock = path.join(__dirname, 'fixtures', 'lock_with_typosquat', 'package-lock.json');
    const findings = await analyzeDependencies(lock, { topPackagesPath: path.join(__dirname, 'fixtures', 'top_packages.json') });
    expect(findings.some(f => f.rule === 'dependency.typosquat')).toBe(true);
  });

  it('supports lockfileVersion 3 packages map', async () => {
    const lock = path.join(__dirname, 'fixtures', 'lock_v3', 'package-lock.json');
    const fakeLookup = async (name: string, version: string) => {
      if (name === 'vuln-pkg') return { advisories: [{ id: 'OSV-V3-1', severity: 'HIGH', summary: 'v3 advisory' }] };
      return {};
    };
    const findings = await analyzeDependencies(lock, { osvLookup: fakeLookup, topPackagesPath: path.join(__dirname, 'fixtures', 'top_packages.json') });
    // v3-only dep must be seen (OSV), typosquat dep seen, nested dep seen via OSV lookup probe
    expect(findings.some(f => f.rule === 'dependency.osv_advisory')).toBe(true);
    expect(findings.some(f => f.rule === 'dependency.typosquat')).toBe(true);
  });

  it('supports yarn.lock v1', async () => {
    const lock = path.join(__dirname, 'fixtures', 'lock_yarn', 'yarn.lock');
    const findings = await analyzeDependencies(lock, { topPackagesPath: path.join(__dirname, 'fixtures', 'top_packages.json') });
    expect(findings.some(f => f.rule === 'dependency.typosquat')).toBe(true);
  });

  it('supports pnpm-lock.yaml', async () => {
    const lock = path.join(__dirname, 'fixtures', 'lock_pnpm', 'pnpm-lock.yaml');
    const findings = await analyzeDependencies(lock, { topPackagesPath: path.join(__dirname, 'fixtures', 'top_packages.json') });
    expect(findings.some(f => f.rule === 'dependency.typosquat')).toBe(true);
  });

  it('stores relative lockfile paths when bundleRoot given', async () => {
    const lock = path.join(__dirname, 'fixtures', 'lock_with_typosquat', 'package-lock.json');
    const findings = await analyzeDependencies(lock, {
      topPackagesPath: path.join(__dirname, 'fixtures', 'top_packages.json'),
      bundleRoot: path.join(__dirname, 'fixtures')
    });
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.location?.file).not.toMatch(/^[A-Za-z]:\\/);
      expect(f.location?.file).not.toContain('__dirname');
    }
  });
});
