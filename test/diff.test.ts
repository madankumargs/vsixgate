import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { saveScan, getLastScan, diffFindings } from '../src/diff/analyze';
import { Finding } from '../src/types';

const DB = path.join(process.cwd(), '.vsixgate', 'scans.json');

describe('diff engine', () => {
  beforeEach(() => {
    try {
      fs.rmSync(DB, { force: true });
    } catch (e) {
      // ignore
    }
  });

  it('marks new findings in new scan', async () => {
    const baseFindings: Finding[] = [{ rule: 'a', severity: 'low', message: 'old', location: { file: 'x' } }];
    await saveScan({ publisher: 'p', extensionName: 'e', version: '1.0.0', findings: baseFindings, scannedAt: new Date().toISOString() });

    const last = await getLastScan('p', 'e');
    expect(last).not.toBeNull();

    const current: Finding[] = [
      { rule: 'a', severity: 'low', message: 'old', location: { file: 'x' } },
      { rule: 'b', severity: 'high', message: 'new', location: { file: 'y' } }
    ];
    const diffed = diffFindings(last?.findings, current);
    const newFlag = diffed.find(f => f.rule === 'b')?.newInThisVersion;
    expect(newFlag).toBe(true);
    const oldFlag = diffed.find(f => f.rule === 'a')?.newInThisVersion;
    expect(oldFlag).toBe(false);
  });

  it('first scan (no baseline) marks everything as new', async () => {
    const current: Finding[] = [
      { rule: 'a', severity: 'low', message: 'x', location: { file: 'f.js' } }
    ];
    const diffed = diffFindings(undefined, current);
    expect(diffed[0].newInThisVersion).toBe(true);
  });

  it('re-scanning same version does not create duplicate new findings', async () => {
    const base: Finding[] = [
      { rule: 'a', severity: 'low', message: 'old', location: { file: 'x' } }
    ];
    await saveScan({ publisher: 'p2', extensionName: 'e2', version: '1.0.0', findings: base, scannedAt: new Date().toISOString() });
    const last = await getLastScan('p2', 'e2');
    const current: Finding[] = [
      { rule: 'a', severity: 'low', message: 'old', location: { file: 'x' } }
    ];
    const diffed = diffFindings(last?.findings, current);
    expect(diffed.every(f => f.newInThisVersion === false)).toBe(true);
  });

  it('diffFindings uses normalized paths (ignoring bundle root prefix)', async () => {
    const rootA = fs.mkdtempSync(path.join(os.tmpdir(), 'vsixgate-a-'));
    const rootB = fs.mkdtempSync(path.join(os.tmpdir(), 'vsixgate-b-'));
    try {
      // absolute paths from two different tmp dirs, same logical file
      const prev: Finding[] = [
        { rule: 'static.source_to_shell', severity: 'critical', message: 'm', location: { file: path.join(rootA, 'extension', 'index.js') } }
      ];
      const curr: Finding[] = [
        { rule: 'static.source_to_shell', severity: 'critical', message: 'm', location: { file: path.join(rootB, 'extension', 'index.js') } }
      ];
      const diffed = diffFindings(prev, curr, rootB);
      expect(diffed[0].newInThisVersion).toBe(false);
    } finally {
      fs.rmSync(rootA, { recursive: true, force: true });
      fs.rmSync(rootB, { recursive: true, force: true });
    }
  });

  it('handles empty previous findings gracefully', async () => {
    const diffed = diffFindings([], [{ rule: 'a', severity: 'low', message: 'x' }]);
    expect(diffed[0].newInThisVersion).toBe(true);
  });
});
