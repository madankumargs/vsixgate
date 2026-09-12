import { describe, it, expect } from 'vitest';
import path from 'path';
import { analyzeDependencies } from '../src/dependency/analyze';
describe('dependency analyzer', () => {
    it('flags OSV advisory from lookup', async () => {
        const lock = path.join(__dirname, 'fixtures', 'lock_with_advisory', 'package-lock.json');
        const fakeLookup = async (name, version) => {
            if (name === 'vuln-pkg')
                return { advisories: [{ id: 'OSV-TEST-1', severity: 'HIGH', summary: 'Test advisory' }] };
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
});
