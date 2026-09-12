import { describe, it, expect } from 'vitest';
import path from 'path';
import { analyzeStatic } from '../src/static/analyze';

describe('static analyzer (heuristic)', () => {
  it('flags vulnerable fixture', async () => {
    const root = path.join(__dirname, 'fixtures', 'static_vuln');
    const findings = await analyzeStatic(root);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some(f => f.rule === 'static.source_to_shell')).toBe(true);
  });

  it('does not flag safe fixture', async () => {
    const root = path.join(__dirname, 'fixtures', 'static_safe');
    const findings = await analyzeStatic(root);
    expect(findings.length).toBe(0);
  });
});
