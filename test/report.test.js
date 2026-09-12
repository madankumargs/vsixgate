import { describe, it, expect } from 'vitest';
import { generateReport } from '../src/report/generate';
describe('report generator', () => {
    const manifest = { name: 'x' };
    const findings = [{ rule: 'r', severity: 'high', message: 'm', location: { file: 'a' } }];
    const scoring = { status: 'BLOCK', counts: { high: 1, medium: 0, low: 0, info: 0, critical: 0 } };
    it('produces JSON', () => {
        const out = generateReport(manifest, findings, scoring, 'json');
        const parsed = JSON.parse(out);
        expect(parsed.findings.length).toBe(1);
    });
    it('produces SARIF', () => {
        const out = generateReport(manifest, findings, scoring, 'sarif');
        const parsed = JSON.parse(out);
        expect(parsed.runs[0].results.length).toBe(1);
    });
    it('produces text', () => {
        const out = generateReport(manifest, findings, scoring, 'text');
        expect(out.includes('Status:')).toBe(true);
    });
});
