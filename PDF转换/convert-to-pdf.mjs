#!/usr/bin/env node
// Free local Office -> PDF conversion using an installed LibreOffice executable.
// Usage: node convert-to-pdf.mjs <file-or-directory> [...] [--out output-directory] [--soffice executable]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const supported = new Set(['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.odt', '.odp', '.ods', '.rtf']);
const args = process.argv.slice(2);
const inputArgs = [];
let outputArg = 'pdf-output';
let sofficeArg = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--out' || arg === '-o' || arg === '--soffice') {
    if (!args[i + 1]) {
      console.error('Missing value for ' + arg);
      process.exit(2);
    }
    if (arg === '--soffice') sofficeArg = args[++i];
    else outputArg = args[++i];
  } else if (arg === '--help' || arg === '-h') {
    console.log('Usage: node convert-to-pdf.mjs <file|directory> [...] [--out DIR] [--soffice PATH]');
    process.exit(0);
  } else if (arg.startsWith('-')) {
    console.error('Unknown option: ' + arg);
    process.exit(2);
  } else {
    inputArgs.push(arg);
  }
}

if (!inputArgs.length) {
  console.error('Give one or more Office files or directories. Use --help for usage.');
  process.exit(2);
}

function findSoffice() {
  if (sofficeArg) return sofficeArg;
  if (process.env.LIBREOFFICE_BIN) return process.env.LIBREOFFICE_BIN;
  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.ProgramFiles || 'C:/Program Files', 'LibreOffice', 'program', 'soffice.com'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'LibreOffice', 'program', 'soffice.com'),
      ]
    : process.platform === 'darwin'
      ? ['/Applications/LibreOffice.app/Contents/MacOS/soffice']
      : ['/usr/bin/libreoffice', '/usr/bin/soffice'];
  return candidates.find(existsSync) || 'soffice';
}

function runLibreOffice(executable, pdfDir, document, profile) {
  return new Promise((resolve, reject) => {
    const options = [
      '-env:UserInstallation=' + pathToFileURL(profile).href,
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', pdfDir,
      document,
    ];
    const child = spawn(executable, options, { shell: false, windowsHide: true, timeout: 120000 });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
    child.once('error', error => reject(error));
    child.once('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error('LibreOffice exited with code ' + code + ': ' + (stderr || stdout).trim()));
    });
  });
}

async function main() {
  const outDir = path.resolve(outputArg);
  await fs.mkdir(outDir, { recursive: true });
  const inputs = [];
  for (const raw of inputArgs) {
    const location = path.resolve(raw);
    const stat = await fs.stat(location);
    if (stat.isDirectory()) {
      const children = await fs.readdir(location, { withFileTypes: true });
      for (const child of children) {
        if (child.isFile() && supported.has(path.extname(child.name).toLowerCase())) {
          inputs.push(path.join(location, child.name));
        }
      }
    } else if (stat.isFile()) {
      if (!supported.has(path.extname(location).toLowerCase())) {
        console.warn('Skip unsupported format: ' + location);
      } else inputs.push(location);
    }
  }
  const documents = [...new Set(inputs)];
  if (!documents.length) throw new Error('No supported Office documents found.');

  const soffice = findSoffice();
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'stripbot-pdf-'));
  let failed = 0;
  try {
    for (const document of documents) {
      const target = path.join(outDir, path.parse(document).name + '.pdf');
      if (existsSync(target)) {
        console.log('[SKIP, already exists] ' + target);
        continue;
      }
      try {
        const log = await runLibreOffice(soffice, outDir, document, profile);
        if (!existsSync(target)) throw new Error('LibreOffice did not create the expected PDF. ' + log);
        console.log('[OK] ' + document + ' -> ' + target);
      } catch (error) {
        failed++;
        console.error('[FAILED] ' + document + ': ' + error.message);
        if (error.code === 'ENOENT') {
          console.error('Install LibreOffice, or pass --soffice with the executable path.');
        }
      }
    }
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
  if (failed) process.exitCode = 1;
}

main().catch(error => {
  console.error('[ERROR] ' + error.message);
  process.exitCode = 1;
});
