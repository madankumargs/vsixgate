import { describe, it, expect } from 'vitest';
import { scoreFindings } from '../src/scoring/score';
import { Finding } from '../src/types';

describe('scoring engine', () => {
  it('returns BLOCK for critical finding', () => {
    const f: Finding[] = [{ rule: 'a', severity: 'critical', message: 'x' }];
    const r = scoreFindings(f);
    expect(r.status).toBe('BLOCK');
  });

  it('returns BLOCK for new high finding', () => {
    const f: Finding[] = [{ rule: 'h', severity: 'high', message: 'x', newInThisVersion: true }];
    const r = scoreFindings(f);
    expect(r.status).toBe('BLOCK');
  });

  it('returns WARN for medium findings', () => {
    const f: Finding[] = [{ rule: 'm', severity: 'medium', message: 'x' }];
    const r = scoreFindings(f);
    expect(r.status).toBe('WARN');
  });

  it('downgrades mitigated findings unless novel', () => {
    const f: Finding[] = [{ rule: 't', severity: 'high', message: 'telemetry', legitimateUse: 'yes', redFlag: 'mitigat', newInThisVersion: false }];
    const r = scoreFindings(f);
    // high downgraded to medium => WARN
    expect(r.counts.medium).toBe(1);
    expect(r.status).toBe('WARN');

    const f2: Finding[] = [{ rule: 't', severity: 'high', message: 'telemetry', legitimateUse: 'yes', redFlag: 'mitigat', newInThisVersion: true }];
    const r2 = scoreFindings(f2);
    // novel -> not downgraded
    expect(r2.counts.high).toBe(1);
    expect(r2.status).toBe('BLOCK');
  });

  it('returns PASS for only low/info', () => {
    const f: Finding[] = [{ rule: 'l', severity: 'low', message: 'x' }, { rule: 'i', severity: 'info', message: 'y' }];
    const r = scoreFindings(f);
    expect(r.status).toBe('PASS');
  });

  it('untrusted_and_sinks HIGH counts toward verdict when scored with the rest', () => {
    // Regression: cli.ts used to call scoreFindings() BEFORE pushing this
    // finding, so a HIGH that should BLOCK was invisible to scoring.
    // Order enforced in cli.ts: synth -> score. This test pins the scoring half.
    const f: Finding[] = [
      { rule: 'static.source_to_shell', severity: 'critical', message: 'shell', newInThisVersion: false },
      { rule: 'manifest.untrusted_and_sinks', severity: 'high', message: 'Declares untrustedWorkspaces while containing shell/file-write/eval sinks', newInThisVersion: true }
    ];
    const r = scoreFindings(f);
    expect(r.status).toBe('BLOCK');
  });
});
