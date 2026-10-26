'use strict';
const path=require('node:path'),fs=require('node:fs/promises');
const {build,Platform,Arch}=require('electron-builder');
(async()=>{
 const source=path.resolve(__dirname,process.argv[2]||'releases/update-ready/Strip Bot-win32-x64');
 const manifest=JSON.parse(await fs.readFile(path.join(__dirname,'package.json'),'utf8'));
 await fs.access(path.join(source,'Strip Bot.exe'));
 // Prepackaged apps skip electron-builder's afterPack hook; write the public feed explicitly.
 const feed=require('./electron-builder.cjs').publish[0];
 await fs.writeFile(path.join(source,'resources','app-update.yml'),JSON.stringify({...feed,updaterCacheDirName:'strip-bot-desktop-updater'},null,2));
 process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL||='3';
 const paths=await build({projectDir:__dirname,prepackaged:source,targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),publish:'never',config:path.join(__dirname,'electron-builder.cjs')});
 console.log(paths.join('\n'));
})().catch(e=>{console.error(e);process.exitCode=1;});
