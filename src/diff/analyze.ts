import fs from 'fs';
import path from 'path';
import { Finding } from '../types.js';

const STORAGE_DIR = path.join(process.cwd(), '.vsixgate');
const JSON_DB = path.join(STORAGE_DIR, 'scans.json');
let useSqlite = false as boolean;
let dbHandle: any = null;
try {
  // try optional sqlite backend
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const BetterSqlite3 = require('better-sqlite3');
  const dbPath = path.join(STORAGE_DIR, 'scans.sqlite');
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  dbHandle = new BetterSqlite3(dbPath);
  dbHandle.exec(`CREATE TABLE IF NOT EXISTS scans(id INTEGER PRIMARY KEY AUTOINCREMENT, publisher TEXT, extension TEXT, version TEXT, scanned_at TEXT, manifest_json TEXT, findings_json TEXT)`);
  useSqlite = true;
} catch (e) {
  useSqlite = false;
}

function ensureDir() {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export interface ScanRecord {
  publisher: string;
  extensionName: string;
  version: string;
  manifest?: any;
  findings: Finding[];
  scannedAt: string;
}

export async function saveScan(rec: ScanRecord) {
  ensureDir();
  if (useSqlite && dbHandle) {
    const stmt = dbHandle.prepare('INSERT INTO scans(publisher, extension, version, scanned_at, manifest_json, findings_json) VALUES(?,?,?,?,?,?)');
    stmt.run(rec.publisher, rec.extensionName, rec.version, rec.scannedAt, JSON.stringify(rec.manifest || {}), JSON.stringify(rec.findings || []));
    return;
  }
  let db: ScanRecord[] = [];
  if (fs.existsSync(JSON_DB)) {
    try { db = JSON.parse(fs.readFileSync(JSON_DB, 'utf8')); } catch { db = []; }
  }
  db.push(rec);
  fs.writeFileSync(JSON_DB, JSON.stringify(db, null, 2));
}

export async function getLastScan(publisher: string, extensionName: string): Promise<ScanRecord | null> {
  if (useSqlite && dbHandle) {
    try {
      const stmt = dbHandle.prepare('SELECT * FROM scans WHERE publisher = ? AND extension = ? ORDER BY id DESC LIMIT 1');
      const row = stmt.get(publisher, extensionName);
      if (!row) return null;
      return {
        publisher: row.publisher,
        extensionName: row.extension,
        version: row.version,
        manifest: JSON.parse(row.manifest_json || '{}'),
        findings: JSON.parse(row.findings_json || '[]'),
        scannedAt: row.scanned_at
      } as ScanRecord;
    } catch (e) {
      // fall through to JSON
    }
  }
  if (!fs.existsSync(JSON_DB)) return null;
  try {
    const db: ScanRecord[] = JSON.parse(fs.readFileSync(JSON_DB, 'utf8'));
    for (let i = db.length - 1; i >= 0; i--) {
      const r = db[i];
      if (r.publisher === publisher && r.extensionName === extensionName) return r;
    }
  } catch { }
  return null;
}

export function diffFindings(previous: Finding[] | undefined, current: Finding[]) {
  const prevSet = new Set((previous || []).map(p => `${p.rule}|${p.location?.file}|${p.location?.line || ''}|${p.message || ''}`));
  for (const f of current) {
    const key = `${f.rule}|${f.location?.file}|${f.location?.line || ''}|${f.message || ''}`;
    if (!prevSet.has(key)) f.newInThisVersion = true;
    else f.newInThisVersion = false;
  }
  return current;
}
