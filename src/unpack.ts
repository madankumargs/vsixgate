import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';

export async function unpackVsix(vsixPath: string): Promise<{ extractedPath: string; manifestPath?: string; cleanup: () => void }>{
  if (!fs.existsSync(vsixPath)) throw new Error(`vsix not found: ${vsixPath}`);
  const stat = fs.statSync(vsixPath);
  // Reject absurd inputs early (zip-bomb pre-check): 200MB packed cap.
  const MAX_PACKED_BYTES = 200 * 1024 * 1024;
  if (stat.size > MAX_PACKED_BYTES) throw new Error(`vsix too large (${stat.size} bytes), refusing to unpack`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsixgate-'));
  const cleanup = () => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  };
  try {
    const zip = new AdmZip(vsixPath);
    const entries = zip.getEntries();
    // Hard caps: file count + uncompressed size + compression ratio.
    const MAX_FILES = 5000;
    const MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;
    const MAX_RATIO = 100;
    if (entries.length > MAX_FILES) throw new Error(`vsix has too many entries (${entries.length} > ${MAX_FILES})`);
    let totalUncompressed = 0;
    for (const e of entries) {
      totalUncompressed += e.header.size || 0;
      if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error(`vsix uncompressed size exceeds cap (${MAX_UNCOMPRESSED_BYTES} bytes)`);
    }
    if (stat.size > 0 && totalUncompressed / stat.size > MAX_RATIO) throw new Error(`vsix compression ratio suspicious (${(totalUncompressed / stat.size).toFixed(1)}x), possible zip-bomb`);
    // Zip-slip guard: validate every entry resolves inside tmpDir before extracting.
    for (const e of entries) {
      const resolved = path.resolve(tmpDir, e.entryName);
      if (!(resolved === tmpDir || resolved.startsWith(tmpDir + path.sep))) {
        throw new Error(`vsix contains unsafe path: ${e.entryName}`);
      }
    }
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

    return { extractedPath: tmpDir, manifestPath, cleanup };
  } catch (e) {
    cleanup();
    throw e;
  }
}
