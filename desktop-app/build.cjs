'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
async function build() {
  const root = path.resolve(__dirname, '..');
  const output = path.resolve(__dirname, process.argv[2] || 'dist');
  if (!output.startsWith(__dirname + path.sep)) throw new Error('Package output must be a child of desktop-app.');
  const staging = path.join(__dirname, 'staging');
  await fs.rm(staging, {recursive:true, force:true});
  await fs.mkdir(staging, {recursive:true});
  await fs.copyFile(path.join(__dirname, 'main.cjs'), path.join(staging, 'main.cjs'));
  await fs.copyFile(path.join(__dirname, 'preload.cjs'), path.join(staging, 'preload.cjs'));
  await fs.cp(path.join(root, 'backend'), path.join(staging, 'backend'), {recursive:true});
  await fs.cp(path.join(__dirname, 'runtime'), path.join(staging, 'runtime'), {recursive:true});
  // Package only the active UI, not retired bundles, history, or project sources.
  const publicDir = path.join(root,'public');
  const html = await fs.readFile(path.join(publicDir,'index.html'),'utf8');
  const entries = [...html.matchAll(/(?:src|href)="(\/assets\/[a-zA-Z0-9._-]+\.(?:js|css))"/g)].map(match => match[1].slice(1));
  const manifest = JSON.parse((await fs.readFile(path.join(publicDir,'build-manifest.json'),'utf8')).replace(/^\uFEFF/,''));
  const assets = manifest.assets;
  if (!Array.isArray(assets) || !assets.every(name => /^assets\/[a-zA-Z0-9._-]+\.(js|css|woff2?|png|svg)$/.test(name)) || !entries.every(name => assets.includes(name))) throw new Error('UI build manifest is invalid or stale.');
  if (!assets.length) throw new Error('UI assets missing; run scripts/BuildUI.ps1 first.');
  for (const name of ['index.html','brand-logo.png','strip-bot.ico', ...assets]) {
    const target = path.join(staging,'public',name);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.copyFile(path.join(publicDir,name),target);
  }
  await fs.cp(path.join(root, 'licenses'), path.join(staging, 'licenses'), {recursive:true});
  await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({name:'strip-bot',productName:'Strip Bot',version:'1.0.0',main:'main.cjs',description:'Strip Bot local desktop AI chat'}));
  const {packager} = await import('@electron/packager');
  const agentBinary = path.join(root,'agent-runtime','node_modules','@opencode','cli','bin','opencode.exe');
  await fs.access(agentBinary);
  const paths = await packager({dir:staging,name:'Strip Bot',platform:'win32',arch:'x64',out:output,overwrite:true,asar:true,extraResource:[agentBinary,path.join(root,'licenses','opencode-MIT.txt')],icon:path.join(root,'public','strip-bot.ico'),electronVersion:require('./node_modules/electron/package.json').version,electronZipDir:path.join(root,'.runtime'),appCopyright:'Strip Bot',win32metadata:{CompanyName:'Strip Bot',FileDescription:'Strip Bot Desktop',ProductName:'Strip Bot'},prune:false});
  console.log('Desktop application:', paths.join(', '));
}
build().catch(error=>{console.error(error.message);process.exitCode=1;});
