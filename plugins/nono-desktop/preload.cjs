'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('nonoPet',Object.freeze({
  ready:()=>ipcRenderer.send('nono:ready'),
  openChat:()=>ipcRenderer.send('nono:open-chat'),
  menu:()=>ipcRenderer.send('nono:menu'),
  move:(dx,dy)=>ipcRenderer.send('nono:move',{dx,dy}),
  typing:()=>ipcRenderer.send('nono:typing'),
  chat:messages=>ipcRenderer.invoke('nono:chat',messages),
  onAction:callback=>{const listener=(_event,action)=>callback(action);ipcRenderer.on('nono:action',listener);return()=>ipcRenderer.removeListener('nono:action',listener);}
}));
