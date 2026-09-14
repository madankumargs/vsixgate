#!/usr/bin/env node
import { Command } from 'commander';
import { unpackVsix } from './unpack.js';
import { analyzeManifest } from './manifest/analyze.js';
import { analyzeStatic } from './static/analyze.js';
import { scanSignatures } from './signatures/scan.js';
import { analyzeDependencies } from './dependency/analyze.js';
import { saveScan, getLastScan, diffFindings } from './diff/analyze.js';
import { scoreFindings } from './scoring/score.js';
import { explainFinding } from './report/explanations.js';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import Table from 'cli-table3';
import { createReadStream } from 'fs';
import figlet from 'figlet';

const program = new Command();
program.name('vsixgate').description('vsixgate CLI (work in progress)');

program.command('scan <path>')
  .description('Unpack and run all analyzers')
  .option('--strict', 'treat WARN as BLOCK')
  .option('--osv-api <url>', 'Custom OSV API endpoint')
  .option('--json', 'Print machine-readable JSON report')
  .option('--mascot-ascii <file>', 'Path to ASCII art file to use as mascot')
  .action(async (pathArg: string, opts: { strict?: boolean, osvApi?: string, json?: boolean, mascotAscii?: string }) => {
    try {
      await performScan(pathArg, { strict: !!opts.strict, osvApi: opts.osvApi, json: !!opts.json, mascotAscii: opts.mascotAscii });
    } catch (e: any) {
      console.error('Error:', e.message || e);
      process.exit(2);
    }
  });

export async function performScan(pathArg: string, opts: { strict?: boolean, osvApi?: string, json?: boolean, mascotAscii?: string, interactive?: boolean } = {}) {
  const res = await unpackVsix(pathArg);
  try {
  if (!res.manifestPath) {
    try { res.cleanup(); } catch { /* ignore */ }
    console.error('Manifest not found in vsix');
    return 1;
  }

  const manifest = await analyzeManifest(res.manifestPath, res.extractedPath);
      // pretty header with mascot and name
      // big ASCII header (orange) using figlet
      try {
        const banner = figlet.textSync('vsixgate', { horizontalLayout: 'default', verticalLayout: 'default' });
        console.log(chalk.hex('#FF8C42').bold(banner));
        console.log(chalk.gray('pre-publish extension scanner'));
      } catch (err) {
        // fallback
        const header = boxen(chalk.hex('#FF8C42')('  vsixgate  ') + '  ' + chalk.gray('pre-publish extension scanner'), { padding: 1, borderColor: 'magenta' });
        console.log(header);
      }

      // animated ASCII mascot moving horizontally while analyzers run
      let mascotLines = [
        "  (•_•)",
        "  <) )╯",
        "  / \\",
      ];
      if (opts.mascotAscii) {
        try {
          const m = fs.readFileSync(opts.mascotAscii, 'utf8').split('\n').slice(0,3);
          if (m.length) mascotLines = m;
        } catch (e) { /* ignore */ }
      }
      let pos = 0;
      let dir = 1;
      const width = Math.max(20, process.stdout.columns ? process.stdout.columns - 20 : 40);
      const spinner = ora({ text: 'Running analyzers', color: 'yellow' }).start();
      const anim = setInterval(() => {
        // clear previous line
        process.stdout.write('\x1b[2K\r');
        const space = ' '.repeat(pos);
        process.stdout.write(space + chalk.hex('#FFD1A9')(mascotLines[0]) + '\n');
        process.stdout.write('\x1b[2K\r');
        process.stdout.write(space + chalk.hex('#FFD1A9')(mascotLines[1]) + '\n');
        process.stdout.write('\x1b[2K\r');
        process.stdout.write(space + chalk.hex('#FFD1A9')(mascotLines[2]) + '\r');
        pos += dir;
        if (pos <= 0 || pos >= width) dir *= -1;
      }, 120);
      const staticFindings = await analyzeStatic(res.extractedPath);
      const signatureFindings = await scanSignatures(res.extractedPath);

      // dependency analysis if lockfile present
      const lockNpm = path.join(res.extractedPath, 'package-lock.json');
      const lockYarn = path.join(res.extractedPath, 'yarn.lock');
      const lockPnpm = path.join(res.extractedPath, 'pnpm-lock.yaml');
      // also check extension/ subdir (real .vsix layout: extension/package.json)
      const lockNpmExt = path.join(res.extractedPath, 'extension', 'package-lock.json');
      const lockYarnExt = path.join(res.extractedPath, 'extension', 'yarn.lock');
      const lockPnpmExt = path.join(res.extractedPath, 'extension', 'pnpm-lock.yaml');
      let dependencyFindings: any[] = [];
      const lockfilePath = [lockNpm, lockNpmExt, lockYarn, lockYarnExt, lockPnpm, lockPnpmExt].find(p => fs.existsSync(p));
      if (lockfilePath) {
        const topPackagesPath = path.join(process.cwd(), 'test', 'fixtures', 'top_packages.json');
        // provide an OSV lookup implementation
        const osvEndpoint = opts.osvApi || 'https://api.osv.dev/v1/query';
        const osvLookup = async (name: string, version: string) => {
          try {
            const resp = await (await import('axios')).default.post(osvEndpoint, {
              package: { name, ecosystem: 'npm' },
              version
            }, { timeout: 5000 });
            const advisories = resp.data && resp.data.vulns ? resp.data.vulns.map((v:any)=>({ id: v.id, severity: v.severity || 'UNKNOWN', summary: v.summary })) : [];
            return { advisories };
          } catch (e) {
            return { advisories: [] };
          }
        };
        dependencyFindings = await analyzeDependencies(lockfilePath, { osvLookup, topPackagesPath: fs.existsSync(topPackagesPath) ? topPackagesPath : undefined, bundleRoot: res.extractedPath });
      }

      clearInterval(anim);
      spinner.succeed('Analyzers finished');
      // ensure any partial mascot output is cleared, then print a persistent mascot box
      try {
        process.stdout.write('\x1b[0J');
        const mascotBox = boxen(mascotLines.join('\n'), { padding: 1, borderColor: 'green' });
        console.log(mascotBox);
      } catch (e) { /* ignore */ }

      const allFindings = [
        ...manifest.findings,
        ...staticFindings,
        ...signatureFindings,
        ...dependencyFindings
      ];

      // diff against last scan (bundleRoot passed so tmp-dir paths get stable keys)
      const publisher = manifest.publisher || 'unknown';
      const extName = manifest.extensionName || 'unknown';
      const last = await getLastScan(publisher, extName);
      const relManifestFile = path.relative(res.extractedPath, res.manifestPath).split(path.sep).join('/');
      const diffed = diffFindings(last?.findings, allFindings, res.extractedPath);

      // detect newly introduced network destinations and elevate
      const addedNetworkHosts = new Set<string>();
      for (const f of diffed) {
        if (f.rule === 'network.destination' && f.newInThisVersion && typeof f.message === 'string') {
          const m = f.message.match(/https?:\/\/[^\s]+/);
          if (m) addedNetworkHosts.add(m[0]);
        }
      }
      for (const u of addedNetworkHosts) {
        diffed.push({
          rule: 'network.new_destination',
          severity: 'high',
          message: `New outbound destination introduced: ${u}`,
          redFlag: 'New remote destination introduced in this version',
          location: { file: relManifestFile },
          newInThisVersion: true
        });
      }

      // cross-check: untrustedWorkspaces capability vs actual sinks
      // NOTE: must run BEFORE scoring so the synthesized finding affects verdict.
      try {
        const hasUntrusted = !!manifest.untrustedWorkspacesClaim;
        const hasShellOrWrite = diffed.some((f:any)=> ['static.source_to_shell','static.read_to_write','static.source_to_eval'].includes(f.rule));
        if (hasUntrusted && hasShellOrWrite) {
          diffed.push({
            rule: 'manifest.untrusted_and_sinks',
            severity: 'high',
            message: 'Declares untrustedWorkspaces while containing shell/file-write/eval sinks',
            redFlag: 'Contradiction between claimed untrusted workspace support and risky behaviors',
            location: { file: relManifestFile },
            newInThisVersion: true
          });
        }
      } catch (e) { /* ignore */ }

      const scoring = scoreFindings(diffed, { strict: !!opts.strict });

      // enrich findings with explanations
      for (const f of diffed) {
        const info = explainFinding(f.rule);
        (f as any).explanation = info.explanation;
        (f as any).recommendation = info.recommendation;
      }

      // save current scan
      await saveScan({ publisher, extensionName: extName, version: manifest.version || 'unknown', manifest, findings: diffed, scannedAt: new Date().toISOString() });

      const weight = (diffed.filter(f=>f.severity==='critical').length * 40) + (diffed.filter(f=>f.severity==='high').length * 20) + (diffed.filter(f=>f.severity==='medium').length * 10) + (diffed.filter(f=>f.severity==='low').length * 3);
      const securityScore = Math.max(0, Math.min(100, 100 - weight));

      const report = { manifest, findings: diffed, scoring, securityScore };

      // summary
      console.log(chalk.bold('\nScan results:'));
      const statusColor = scoring.status === 'PASS' ? 'green' : (scoring.status === 'WARN' ? 'yellow' : 'red');
      console.log(chalk[statusColor](`  Status: ${scoring.status}`));
      console.log(chalk.gray(`  Counts: infos=${scoring.counts.info} low=${scoring.counts.low} med=${scoring.counts.medium} high=${scoring.counts.high} critical=${scoring.counts.critical}`));
      console.log(chalk.bold(`  Security score: ${securityScore}/100`));

      // table of findings
      if (diffed.length > 0) {
        console.log(chalk.bold('\nFindings:'));
        const table = new Table({head:['Rule','Severity','Message']});
        diffed.forEach((f:any)=>{
          const sev = (f as any).finalSeverity || f.severity || 'info';
          const sevColor = sev === 'critical' ? chalk.red : (sev === 'high' ? chalk.redBright : (sev === 'medium' ? chalk.yellow : (sev === 'low' ? chalk.cyan : chalk.gray)));
          table.push([f.rule, sevColor(sev.toUpperCase()), f.message]);
        });
        console.log(table.toString());

        console.log(chalk.bold('\nDetails:'));
        for (const f of diffed) {
          console.log(chalk.underline(f.rule) + ' - ' + chalk.yellow(((f as any).finalSeverity || f.severity || 'info').toUpperCase()));
          console.log('  ' + f.message);
          if ((f as any).explanation) console.log('  Explanation: ' + chalk.gray((f as any).explanation));
          if ((f as any).recommendation) console.log('  Recommendation: ' + chalk.cyan((f as any).recommendation));
          console.log('');
        }
      } else {
        console.log(chalk.green('\nNo findings detected.'));
      }

      // friendly exit info
      if (opts.json) {
        console.log(chalk.dim('\nFull machine-readable report is printed below (JSON):'));
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(chalk.dim('\nJSON report suppressed (use --json to enable)'));
      }

      const code = scoring.status === 'PASS' ? 0 : (scoring.status === 'WARN' ? 1 : 2);
      try { res.cleanup(); } catch { /* ignore */ }
      if (!opts.interactive) process.exit(code);
      return code;
    } catch (e: any) {
      console.error('Error:', e.message || e);
      try { res.cleanup(); } catch { /* ignore */ }
      if (!opts.interactive) process.exit(2);
      return 2;
    }
}

async function interactiveUI() {
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  const question = (q:string) => new Promise<string>(res => rl.question(q, res));
  try {
    console.log('');
    console.log(chalk.hex('#FF8C42').bold('vsixgate — interactive mode'));
    const ans = await question('Scan a file now? (Y/n): ');
    if (ans.trim().toLowerCase() === 'n') {
      console.log('Bye.');
      rl.close();
      return;
    }
    const p = await question('Path to .vsix (default fixtures/minimal.vsix): ');
    const pathArg = p.trim() || 'fixtures/minimal.vsix';
    rl.close();
    await performScan(pathArg, { interactive: true, json: false });
  } catch (e) {
    rl.close();
    throw e;
  }
}

if (process.argv.length <= 2) {
  // no args — launch interactive UI
  interactiveUI().then(()=>process.exit(0)).catch(()=>process.exit(0));
} else {
  program.parseAsync();
}
