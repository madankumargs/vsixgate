import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { saveScan, getLastScan, diffFindings } from '../src/diff/analyze';
const DB = path.join(process.cwd(), '.vsixgate', 'scans.json');
describe('diff engine', () => {
    beforeEach(() => {
        if (fs.existsSync(DB))
            fs.unlinkSync(DB);
    });
    it('marks new findings in new scan', async () => {
        const baseFindings = [{ rule: 'a', severity: 'low', message: 'old', location: { file: 'x' } }];
        await saveScan({ publisher: 'p', extensionName: 'e', version: '1.0.0', findings: baseFindings, scannedAt: new Date().toISOString() });
        const last = await getLastScan('p', 'e');
        expect(last).not.toBeNull();
        const current = [
            { rule: 'a', severity: 'low', message: 'old', location: { file: 'x' } },
            { rule: 'b', severity: 'high', message: 'new', location: { file: 'y' } }
        ];
        const diffed = diffFindings(last?.findings, current);
        const newFlag = diffed.find(f => f.rule === 'b')?.newInThisVersion;
        expect(newFlag).toBe(true);
        const oldFlag = diffed.find(f => f.rule === 'a')?.newInThisVersion;
        expect(oldFlag).toBe(false);
    });
});
