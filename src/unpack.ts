import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';

export async function unpackVsix(vsixPath: string): Promise<{ extractedPath: string; manifestPath?: string }>{
  if (!fs.existsSync(vsixPath)) throw new Error(`vsix not found: ${vsixPath}`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsixgate-'));
  const zip = new AdmZip(vsixPath);
  zip.extractAllTo(tmpDir, true);

  // Common manifest locations: extension/package.json or package.json at root
  const candidates = [
    path.join(tmpDir, 'extension', 'package.json'),
    path.join(tmpDir, 'package.json')
  ];
  let manifestPath: string | undefined;
  for (const c of candidates) {
    if (fs.existsSync(c)) { manifestPath = c; break; }
  }

  return { extractedPath: tmpDir, manifestPath };
}
