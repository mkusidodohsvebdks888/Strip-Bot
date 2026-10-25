'use strict';
const input=document.getElementById('input'),button=document.getElementById('send'),status=document.getElementById('status'),log=document.getElementById('messages');
let history=[],busy=false;
function append(role,text){const item=document.createElement('div');item.className='message';item.textContent=role+'：'+text;log.append(item);while(log.children.length>40)log.firstChild.remove();log.scrollTop=log.scrollHeight;}
input.addEventListener('input',()=>window.nonoPet.typing());
document.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const text=input.value.trim();if(!text||busy)return;busy=true;button.disabled=true;input.disabled=true;status.textContent='正在等待模型回复…';
  try{const messages=[...history.slice(-20),{role:'user',content:text}];const reply=await window.nonoPet.chat(messages);if(reply.error)throw new Error(reply.error);append('你',text);append('糯糯',reply.text);history=[...messages,{role:'assistant',content:reply.text.slice(0,4000)}].slice(-20);input.value='';status.textContent='当前模型：'+reply.model;}catch(error){status.textContent=error.message || '连接失败，请检查 Strip Bot。';}finally{busy=false;button.disabled=false;input.disabled=false;input.focus();}
});
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();document.querySelector('form').requestSubmit();}});
window.addEventListener('keydown',event=>{if(event.key==='Escape')window.close();});input.focus();
