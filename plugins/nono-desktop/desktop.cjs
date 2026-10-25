'use strict';
const {app,BrowserWindow,Menu,ipcMain,screen,dialog}=require('electron');
const path=require('node:path'),fs=require('node:fs');
const origin=process.env.NONO_STRIPBOT_URL,token=process.env.NONO_STRIPBOT_TOKEN;
let pet,chatWindow,heartbeat,reminder,failures=0,ready=false,topmost=true,motion=true,size=220;
const requests=new Set();
let base;try{base=new URL(origin);if(base.protocol!=='http:' || base.hostname!=='127.0.0.1' || !base.port || base.pathname!=='/' || base.username || base.password || base.search || base.hash || !token)throw Error();}catch{app.quit();throw new Error('请从 Strip Bot 设置中启用桌面宠物。');}
app.setPath('userData',path.join(app.getPath('appData'),'StripBot-Nono3D'));
const settings=path.join(app.getPath('userData'),'appearance.json');
try{const saved=JSON.parse(fs.readFileSync(settings,'utf8'));if([150,220,300].includes(saved.size))size=saved.size;topmost=saved.topmost!==false;motion=saved.motion!==false;}catch{}
function save(){try{fs.mkdirSync(path.dirname(settings),{recursive:true});fs.writeFileSync(settings,JSON.stringify({size,topmost,motion}));}catch{}}
async function request(route,data){const controller=new AbortController();requests.add(controller);const timer=setTimeout(()=>controller.abort(),route==='chat'?95000:3000);try{const response=await fetch(new URL('/api/plugins/nono/'+route,base),{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...data?{body:JSON.stringify(data)}:{},signal:controller.signal,redirect:'error'});const result=await response.json();if(!response.ok)throw new Error(result.error || 'Strip Bot 连接失败。');return result;}finally{clearTimeout(timer);requests.delete(controller);}}
function valid(event){return [pet,chatWindow].some(window=>window && !window.isDestroyed() && event.sender===window.webContents && event.senderFrame===window.webContents.mainFrame);}
function action(name){if(pet&&!pet.isDestroyed())pet.webContents.send('nono:action',name);}
function secure(window){window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.session.setPermissionRequestHandler((_a,_b,callback)=>callback(false));}
function resetPosition(){const area=screen.getPrimaryDisplay().workArea;pet.setPosition(area.x+area.width-size-30,area.y+area.height-size-30);}
function openChat(){if(chatWindow&&!chatWindow.isDestroyed()){chatWindow.show();chatWindow.focus();return;}chatWindow=new BrowserWindow({title:'糯糯 · Strip Bot',width:460,height:430,minWidth:360,minHeight:300,show:false,autoHideMenuBar:true,alwaysOnTop:topmost,icon:path.join(__dirname,'nono.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'nono-chat'}});secure(chatWindow);chatWindow.once('ready-to-show',()=>chatWindow.show());chatWindow.on('close',event=>{if(!app.isQuitting){event.preventDefault();chatWindow.hide();}});void chatWindow.loadFile(path.join(__dirname,'chat.html'));}
function setSize(value){size=value;pet.setSize(size,size);resetPosition();save();}
function remind(minutes){clearTimeout(reminder);reminder=setTimeout(()=>{action('wave');void dialog.showMessageBox(pet,{type:'info',title:'糯糯提醒',message:'休息时间到啦',detail:'放松肩膀，看看远处，喝口水。',buttons:['知道了']});},minutes*60000);}
function menu(){Menu.buildFromTemplate([
  {label:'和糯糯说句话',click:openChat},{label:'挥挥手',click:()=>action('wave')},{label:'跳一下',click:()=>action('hop')},{label:'玩球',click:()=>action('ball')},{label:'睡觉 / 起床',click:()=>action('sleep')},{type:'separator'},
  {label:'更多动作',submenu:[...Object.entries({dance:'跳舞',spin:'转圈',shy:'捂脸',stretch:'伸懒腰',bow:'鞠躬',sway:'左右摇摆',highfive_wait:'来击掌',superhop:'蓄力大跳',combo:'连续小表演',random:'随机动作'}).map(([name,label])=>({label,click:()=>action(name)})),{type:'separator'},{label:'停止并复位',click:()=>action('reset')},{label:'按住空格蓄力，H 回应击掌',enabled:false}]},
  {label:'保持置顶',type:'checkbox',checked:topmost,click:item=>{topmost=item.checked;pet.setAlwaysOnTop(topmost);chatWindow?.setAlwaysOnTop(topmost);save();}},
  {label:'允许待机动画',type:'checkbox',checked:motion,click:item=>{motion=item.checked;action('motion');save();}},
  {label:'玩偶大小',submenu:[150,220,300].map(value=>({label:value+'px',type:'radio',checked:size===value,click:()=>setSize(value)}))},
  {label:'休息提醒',submenu:[...[5,25,50].map(minutes=>({label:minutes+' 分钟后提醒',click:()=>remind(minutes)})),{label:'取消提醒',click:()=>clearTimeout(reminder)}]},
  {label:'回到主屏幕右下角',click:resetPosition},{type:'separator'},{label:'退出糯糯',click:()=>app.quit()}
]).popup({window:pet});}
ipcMain.on('nono:ready',async event=>{
  if(!valid(event)||event.sender!==pet.webContents||ready)return;
  ready=true;if(!motion)action('motion');
  try{await request('heartbeat');}catch{app.quit();return;}
  heartbeat=setInterval(async()=>{try{await request('heartbeat');failures=0;}catch{if(++failures>=3)app.quit();}},3000);
  if(process.env.NONO_VERIFY_DIR){try{
    await new Promise(resolve=>setTimeout(resolve,1200));
    const result=await pet.webContents.executeJavaScript('window.nono.getState()');
    if(process.env.NONO_VERIFY_ACTIONS==='1'){
      result.actionChecks=[];
      for(const name of result.clips){
        await pet.webContents.executeJavaScript('window.nono.play('+JSON.stringify(name)+')');
        await new Promise(resolve=>setTimeout(resolve,90));
        const state=await pet.webContents.executeJavaScript('window.nono.getState()');
        result.actionChecks.push({name,finite:state.finite,actual:state.action});
      }
      await pet.webContents.executeJavaScript("window.nono.play('highfive_wait');window.nono.highfive()");
      result.highfive=(await pet.webContents.executeJavaScript('window.nono.getState()')).highfiveCount;
      await pet.webContents.executeJavaScript("window.nono.charge();window.dispatchEvent(new Event('blur'))");
      result.chargeCancelled=!(await pet.webContents.executeJavaScript('window.nono.getState()')).charging;
      await pet.webContents.executeJavaScript("window.nono.reset();window.nono.play('wave')");
    }
    if(process.env.NONO_VERIFY_CHAT==='1'){
      openChat();
      await new Promise(resolve=>{if(chatWindow.webContents.isLoading())chatWindow.webContents.once('did-finish-load',resolve);else resolve();});
      await chatWindow.webContents.executeJavaScript("document.getElementById('input').value='你好糯糯';document.querySelector('form').requestSubmit()");
      await new Promise(resolve=>setTimeout(resolve,700));
      result.chatUI=await chatWindow.webContents.executeJavaScript("document.getElementById('messages').textContent.includes('3D 插件模拟回复成功')");
    }
    result.clickResponse=await pet.webContents.executeJavaScript(`(()=>{window.nono.play('dance');const c=document.getElementById('canvas'),r=c.getBoundingClientRect(),props={button:0,pointerId:1,clientX:r.left+r.width*.5,clientY:r.top+r.height*.4};c.dispatchEvent(new PointerEvent('pointerdown',props));c.dispatchEvent(new PointerEvent('pointerup',props));return window.nono.getState().action})()`);
    result.timing=await pet.webContents.executeJavaScript(`(async()=>{window.nono.play('dance');const start=performance.now(),before=window.nono.getState();let frames=0;const count=()=>{frames++;if(performance.now()-start<600)requestAnimationFrame(count)};requestAnimationFrame(count);await new Promise(resolve=>setTimeout(resolve,650));const after=window.nono.getState();return {wall:(performance.now()-start)/1000,simulation:after.simulationTime-before.simulationTime,frames}})()`);
    fs.writeFileSync(path.join(process.env.NONO_VERIFY_DIR,'nono-3d-render.json'),JSON.stringify(result));
    fs.writeFileSync(path.join(process.env.NONO_VERIFY_DIR,'nono-3d-render.png'),(await pet.webContents.capturePage()).toPNG());
  }catch{}}
});
ipcMain.on('nono:open-chat',event=>{if(valid(event))openChat();});ipcMain.on('nono:menu',event=>{if(valid(event))menu();});ipcMain.on('nono:typing',event=>{if(valid(event))action('typing');});
ipcMain.on('nono:move',(event,value)=>{if(!valid(event)||event.sender!==pet.webContents||!Number.isFinite(value?.dx)||!Number.isFinite(value?.dy))return;const bounds=pet.getBounds(),area=screen.getDisplayMatching(bounds).workArea;pet.setPosition(Math.round(Math.max(area.x,Math.min(area.x+area.width-bounds.width,bounds.x+Math.max(-100,Math.min(100,value.dx))))),Math.round(Math.max(area.y,Math.min(area.y+area.height-bounds.height,bounds.y+Math.max(-100,Math.min(100,value.dy))))));});
ipcMain.handle('nono:chat',async(event,messages)=>{if(!valid(event))return {error:'窗口连接无效。'};try{return await request('chat',{messages});}catch(error){return {error:error.name==='AbortError'?'请求超时，请稍后重试。':error.message};}});
app.whenReady().then(async()=>{pet=new BrowserWindow({title:'糯糯 · 3D 桌面宠物',width:size,height:size,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,hasShadow:false,skipTaskbar:true,alwaysOnTop:topmost,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'nono-pet'}});secure(pet);resetPosition();pet.once('ready-to-show',()=>pet.showInactive());await pet.loadFile(path.join(__dirname,'pet.html'));}).catch(()=>app.quit());
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{app.isQuitting=true;clearInterval(heartbeat);clearTimeout(reminder);for(const controller of requests)controller.abort();save();});
