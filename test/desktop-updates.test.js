'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createUpdates,CHANNELS}=require('../desktop-app/runtime/updates.cjs');
function fixture(supported=true){
 const handlers=new Map(),updater=new EventEmitter(),messages=[];
 let installed=0,prepared=0;
 const contents={mainFrame:{},getURL:()=> 'http://127.0.0.1:3060/',send:(_channel,state)=>messages.push(state)};
 const win={webContents:contents,isDestroyed:()=>false};
 updater.checkForUpdates=async()=>updater.emit('update-available',{version:'1.0.3'});
 updater.downloadUpdate=async()=>{updater.emit('download-progress',{percent:61});updater.emit('update-downloaded',{version:'1.0.3'});};
 updater.quitAndInstall=()=>{installed++;};
 const updates=createUpdates({app:{getVersion:()=> '1.0.2'},ipcMain:{handle:(k,f)=>handlers.set(k,f),removeHandler:k=>handlers.delete(k)},updater,getWindow:()=>win,baseUrl:'http://127.0.0.1:3060',supported,beforeInstall:async()=>{prepared++;}});
 const event={sender:contents,senderFrame:contents.mainFrame};
 return {updates,updater,handlers,event,messages,counts:()=>({installed,prepared})};
}
test('updates require a discovered version and completed download before restart',async t=>{
 const f=fixture();t.after(()=>f.updates.dispose());
 await assert.rejects(f.updates.install(),/尚未下载/);
 await f.updates.check();assert.equal(f.updates.snapshot().status,'available');
 assert.equal(f.updater.autoDownload,false);assert.equal(f.updater.autoInstallOnAppQuit,false);
 await f.updates.download();assert.equal(f.updates.snapshot().status,'downloaded');assert.equal(f.updates.snapshot().progress,100);
 await f.updates.install();await new Promise(setImmediate);
 assert.deepEqual(f.counts(),{installed:1,prepared:1});
});
test('update IPC rejects subframes and other renderer origins',async t=>{
 const f=fixture();t.after(()=>f.updates.dispose());const check=f.handlers.get(CHANNELS.check);
 await assert.rejects(check({...f.event,senderFrame:{}}),/来源无效/);
 await assert.rejects(check({...f.event,sender:{...f.event.sender,getURL:()=> 'https://example.com/'}}),/来源无效/);
 assert.equal((await check(f.event)).status,'available');
});
test('portable builds expose unsupported status and do not attempt network updates',async t=>{
 const f=fixture(false);t.after(()=>f.updates.dispose());
 assert.equal(f.updates.snapshot().status,'unsupported');await assert.rejects(f.updates.check(),/正式版本/);
});
test('failed update check is retryable and cannot install unverified data',async t=>{
 const f=fixture();t.after(()=>f.updates.dispose());f.updater.checkForUpdates=async()=>{throw Error('network');};
 await f.updates.check();assert.equal(f.updates.snapshot().status,'error');await assert.rejects(f.updates.install(),/尚未下载/);
 f.updater.checkForUpdates=async()=>f.updater.emit('update-not-available');await f.updates.check();assert.equal(f.updates.snapshot().status,'current');
});
