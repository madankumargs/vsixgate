import { Finding } from '../types.js';

const order = ['info', 'low', 'medium', 'high', 'critical'] as const;
type Severity = typeof order[number];

function indexOf(sev: Severity) {
  return order.indexOf(sev);
}

function downgrade(sev: Severity): Severity {
  const i = indexOf(sev);
  return order[Math.max(0, i - 1)];
}

export function scoreFindings(findings: Finding[], config?: { strict?: boolean }) {
  // compute final severity per finding (apply mitigation downgrade unless novel)
  const finalFindings = findings.map(f => {
    const base = (f.severity || 'info') as Severity;
    let final = base;
    // simple mitigation heuristic: if legitimateUse exists and redFlag indicates mitigation, downgrade
    const hasMitigation = !!f.legitimateUse && /mitigat|opt-out|optout|isTelemetryEnabled/i.test(String(f.redFlag || ''));
    if (hasMitigation && !f.newInThisVersion) {
      final = downgrade(base);
    }
    return { ...f, finalSeverity: final };
  });

  const counts: Record<Severity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const f of finalFindings) counts[(f as any).finalSeverity as Severity]++;

  // Determine status
  let status: 'BLOCK' | 'WARN' | 'PASS' = 'PASS';

  // BLOCK if any critical, or any high-severity finding with newInThisVersion === true
  if (finalFindings.some(f => (f as any).finalSeverity === 'critical')) status = 'BLOCK';
  else if (finalFindings.some(f => (f as any).finalSeverity === 'high' && f.newInThisVersion === true)) status = 'BLOCK';
  else if (finalFindings.some(f => (f as any).finalSeverity === 'high' || (f as any).finalSeverity === 'medium')) status = 'WARN';

  // Special rule: a novel finding that would be medium after mitigation must still trigger WARN (covered above)

  // strict mode: treat WARN as BLOCK
  if (config?.strict && status === 'WARN') status = 'BLOCK';

  return { counts, status, findings: finalFindings };
}
