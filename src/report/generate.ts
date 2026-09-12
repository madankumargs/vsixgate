import { Finding } from '../types.js';

export type ReportFormat = 'text' | 'json' | 'sarif';

function severityToSarifLevel(s: Finding['severity']) {
  if (s === 'critical' || s === 'high') return 'error';
  if (s === 'medium') return 'warning';
  return 'note';
}

export function generateReport(manifest: any, findings: Finding[], scoring: any, format: ReportFormat = 'text') {
  if (format === 'json') {
    return JSON.stringify({ manifest, findings, scoring }, null, 2);
  }

  if (format === 'sarif') {
    const sarif: any = {
      $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: { driver: { name: 'vsixgate', version: '0.1.0' } },
          results: findings.map(f => ({
            ruleId: f.rule,
            level: severityToSarifLevel(f.severity),
            message: { text: f.message },
            locations: f.location ? [{ physicalLocation: { artifactLocation: { uri: f.location.file }, region: f.location.line ? { startLine: f.location.line } : undefined } }] : undefined
          }))
        }
      ]
    };
    return JSON.stringify(sarif, null, 2);
  }

  // text
  const lines: string[] = [];
  lines.push(`Status: ${scoring.status}`);
  lines.push('Summary:');
  for (const sev of ['critical', 'high', 'medium', 'low', 'info']) {
    const c = scoring.counts[sev as keyof typeof scoring.counts] || 0;
    lines.push(`- ${sev.toUpperCase()}: ${c}`);
  }

  lines.push('Findings:');
  for (const f of findings) {
    lines.push(`- ${f.rule} [${f.severity}] ${f.message}` + (f.location ? ` (${f.location.file}${f.location.line ? ':' + f.location.line : ''})` : ''));
    if (f.legitimateUse) lines.push(`  Legitimate: ${f.legitimateUse}`);
    if (f.redFlag) lines.push(`  RedFlag: ${f.redFlag}`);
  }

  return lines.join('\n');
}
