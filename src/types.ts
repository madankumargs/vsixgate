export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  legitimateUse?: string;
  redFlag?: string;
  location?: { file: string; line?: number };
  newInThisVersion?: boolean;
}

export interface ManifestAnalysisResult {
  activationEvents: { value: string[]; flags: Finding[] };
  declaredSettings: string[];
  untrustedWorkspacesClaim?: boolean | 'limited';
  extensionDependencies: string[];
  hasLockfile: boolean;
  publisher?: string;
  extensionName?: string;
  version?: string;
  findings: Finding[];
}
