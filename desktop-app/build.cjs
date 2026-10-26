'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {execFileSync}=require('node:child_process');
function productionInstall(dir){execFileSync(process.platform==='win32'?'npm.cmd':'npm',['install','--omit=dev','--ignore-scripts','--package-lock=false','--no-audit','--no-fund'],{cwd:dir,stdio:'inherit',shell:process.platform==='win32',windowsHide:true});}
async function build() {
  const root = path.resolve(__dirname, '..');
  const metadata=JSON.parse(await fs.readFile(path.join(__dirname,'package.json'),'utf8'));
  const output = path.resolve(__dirname, process.argv[2] || 'dist');
  if (!output.startsWith(__dirname + path.sep)) throw new Error('Package output must be a child of desktop-app.');
  const staging = path.join(__dirname, 'staging');
  await fs.rm(staging, {recursive:true, force:true});
  await fs.mkdir(staging, {recursive:true});
  await fs.copyFile(path.join(__dirname, 'main.cjs'), path.join(staging, 'main.cjs'));
  await fs.copyFile(path.join(__dirname, 'preload.cjs'), path.join(staging, 'preload.cjs'));
  await fs.cp(path.join(root, 'backend'), path.join(staging, 'backend'), {recursive:true});
  // The marketplace backend resolves its catalog relative to the packaged app.
  await fs.mkdir(path.join(staging,'marketplace'),{recursive:true});
  await fs.copyFile(path.join(root,'marketplace','registry.json'),path.join(staging,'marketplace','registry.json'));
  // Business modules are outside backend; preserve them in the packaged app.
  await fs.cp(path.join(root, 'modules'), path.join(staging, 'modules'), {recursive:true});
   await fs.mkdir(path.join(staging,'plugins'),{recursive:true});
   await fs.copyFile(path.join(root,'plugins','_shared.cjs'),path.join(staging,'plugins','_shared.cjs'));
   for (const plugin of ['archive-7zip','office-pdf','deepseek-harness-pet']) await fs.cp(path.join(root,'plugins',plugin),path.join(staging,'plugins',plugin),{recursive:true});
   // Nono's large desktop assets remain in extraResource; only its plugin manifest is copied here.
   await fs.mkdir(path.join(staging,'plugins','nono-desktop'),{recursive:true});
   await fs.copyFile(path.join(root,'plugins','nono-desktop','plugin.json'),path.join(staging,'plugins','nono-desktop','plugin.json'));
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
  await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({name:metadata.name,productName:'Strip Bot',version:metadata.version,main:'main.cjs',description:'Strip Bot local desktop AI chat',author:'Strip Bot',dependencies:metadata.dependencies}));
  productionInstall(staging);
  const {packager} = await import('@electron/packager');
  const agentVendor = path.join(root,'agent-runtime','node_modules','@openai','codex-win32-x64','vendor','x86_64-pc-windows-msvc');
  await fs.access(path.join(agentVendor,'bin','codex.exe'));
  const agentResources = path.join(__dirname,'codex');
  await fs.mkdir(agentResources,{recursive:true});
  await fs.cp(agentVendor,agentResources,{recursive:true});
  // Ship a clean runtime for other computers: no source checkout or host Node installation is required.
  const runtimeResources=path.join(__dirname,'runtime-resources');
  const petResources=path.join(runtimeResources,'dsh-pet'),nodeResources=path.join(runtimeResources,'node');
  await fs.mkdir(petResources,{recursive:true});await fs.mkdir(nodeResources,{recursive:true});
  const petSource=path.join(root,'桌宠','DeepSeek-Q版-dsh-pet','dsh-pet');
  await fs.access(path.join(petSource,'lib','standalone.js'));
  for(const name of ['lib','runtime','assets'])await fs.cp(path.join(petSource,name),path.join(petResources,name),{recursive:true});
  for(const name of ['LICENSE','README.md'])await fs.copyFile(path.join(petSource,name),path.join(petResources,name));
  await fs.copyFile(path.join(petSource,'..','README.md'),path.join(petResources,'UPSTREAM-README.md'));
  const petPackage=JSON.parse(await fs.readFile(path.join(petSource,'package.json'),'utf8'));
  await fs.writeFile(path.join(petResources,'package.json'),JSON.stringify({name:'dsh-pet',version:petPackage.version,type:'module',dependencies:petPackage.dependencies}));
  productionInstall(petResources);
  await fs.copyFile(process.execPath,path.join(nodeResources,'node.exe'));
  await fs.copyFile(path.join(root,'licenses','node-LICENSE.txt'),path.join(nodeResources,'LICENSE'));
  const paths = await packager({dir:staging,name:'Strip Bot',platform:'win32',arch:'x64',out:output,overwrite:true,asar:true,extraResource:[agentResources,petResources,nodeResources,path.join(root,'plugins','nono-desktop'),path.join(root,'plugins','astrbot-desktop')],icon:path.join(root,'public','strip-bot.ico'),electronVersion:require('./node_modules/electron/package.json').version,electronZipDir:path.join(root,'.runtime'),appCopyright:'Strip Bot',win32metadata:{CompanyName:'Strip Bot',FileDescription:'Strip Bot Desktop',ProductName:'Strip Bot'},prune:false});
  console.log('Desktop application:', paths.join(', '));
}
build().catch(error=>{console.error(error.message);process.exitCode=1;});
