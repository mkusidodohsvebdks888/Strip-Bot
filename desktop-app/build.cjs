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
  if (!Array.isArray(assets) || !assets.every(name => /^assets\/[a-zA-Z0-9._-]+\.(js|css|woff2?|png|jpe?g|webp|svg)$/.test(name)) || !entries.every(name => assets.includes(name))) throw new Error('UI build manifest is invalid or stale.');
  if (!assets.length) throw new Error('UI assets missing; run scripts/BuildUI.ps1 first.');
  for (const name of ['index.html','brand-logo.png','login-brand.jpg','strip-bot.ico', ...assets]) {
    const target = path.join(staging,'public',name);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.copyFile(path.join(publicDir,name),target);
  }
  const stripButtons = path.join(publicDir,'strip-buttons');
  try {
    await fs.access(stripButtons);
    await fs.cp(stripButtons, path.join(staging,'public','strip-buttons'), {recursive:true});
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await fs.cp(path.join(root, 'licenses'), path.join(staging, 'licenses'), {recursive:true});
  await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({name:'strip-bot',productName:'Strip Bot',version:'1.0.1',main:'main.cjs',description:'Strip Bot local desktop AI chat'}));
  const {packager} = await import('@electron/packager');
  const agentVendor = path.join(root,'agent-runtime','node_modules','@openai','codex-win32-x64','vendor','x86_64-pc-windows-msvc');
  await fs.access(path.join(agentVendor,'bin','codex.exe'));
  const agentResources = path.join(__dirname,'codex');
  await fs.mkdir(agentResources,{recursive:true});
  await fs.cp(agentVendor,agentResources,{recursive:true});
  const paths = await packager({dir:staging,name:'Strip Bot',platform:'win32',arch:'x64',out:output,overwrite:true,asar:true,extraResource:[agentResources,path.join(root,'plugins','nono-desktop'),path.join(root,'plugins','astrbot-desktop')],icon:path.join(root,'public','strip-bot.ico'),electronVersion:require('./node_modules/electron/package.json').version,electronZipDir:path.join(root,'.runtime'),appCopyright:'Strip Bot',win32metadata:{CompanyName:'Strip Bot',FileDescription:'Strip Bot Desktop',ProductName:'Strip Bot'},prune:false});
  console.log('Desktop application:', paths.join(', '));
}
build().catch(error=>{console.error(error.message);process.exitCode=1;});



