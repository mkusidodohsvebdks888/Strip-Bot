const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const ui=path.resolve(__dirname,'../codex-ui'),requireUI=createRequire(path.join(ui,'package.json')),ts=requireUI('typescript'),React=requireUI('react');
const {renderToStaticMarkup}=requireUI('react-dom/server');
const cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',code)(id=>{if(id.endsWith('.css'))return {};if(/\.(png|jpe?g|webp|svg)$/.test(id))return '/alpha-eye.png';if(!id.startsWith('.'))return requireUI(id);const base=path.resolve(path.dirname(file),id);if(base.endsWith('.mjs'))return require(base);return load(['.tsx','.ts'].map(ext=>base+ext).find(candidate=>fs.existsSync(candidate)) || base);},module,module.exports);return module.exports;
}
const {ToolRail}=load(path.join(ui,'src/components/Sidebar/ToolWorkspace.tsx'));
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
const {StripCodexComposer}=load(path.join(ui,'src/components/StripCodexComposer.tsx'));
const {ApprovalConfirm}=load(path.join(ui,'src/components/Activity/SessionApproval.tsx'));
test('composer keeps approval before model controls and exposes blocked send reason',()=>{
 const html=render(StripCodexComposer,{value:'test',onSend(){},toolsInSidebar:true,modelReadOnly:true,permissionControl:React.createElement('span',null,'APPROVAL_CONTROL'),modelControl:React.createElement('span',null,'MODEL_CONTROL'),sendDisabled:true,sendDisabledReason:'WAIT_FOR_APPROVAL'});
 assert.ok(html.includes('MODEL_CONTROL'));
 assert.ok(html.indexOf('APPROVAL_CONTROL')<html.indexOf('MODEL_CONTROL'));
 assert.match(html,/<button type="submit"[^>]*disabled=""/);
 assert.ok(html.includes('WAIT_FOR_APPROVAL'));
 const running=render(StripCodexComposer,{value:'test',onSend(){},busy:true,onStop(){}});
 assert.ok(running.includes('aria-label="停止生成"'));assert.match(running,/aria-label="发送"[^>]*aria-hidden="true"/);
});

test('left navigation omits the standalone model and speed panel while retaining the other tools',()=>{
 const {ToolRail}=load(path.join(ui,'src/components/Sidebar/ToolWorkspace.tsx'));
 const html=render(ToolRail,{active:'history',opened:true,settings:false,busy:false,pending:0,onTool(){},onNew(){},onSearch(){},onAttach(){},onToggle(){},onSettings(){}});
 assert.ok(!html.includes('模型与速度'));
 for(const name of ['聊天记录','执行记录与输出','本地后端','Skills 技能','GitHub 工具','MCP 项目连接'])assert.ok(html.includes(name));
 for(const name of ['项目目录','会话文件','权限与审批','更多工具'])assert.ok(!html.includes(name));
});
test('approval confirmation buttons cannot submit an enclosing composer form',()=>{
 const html=render(ApprovalConfirm,{title:'Approval',label:'Confirm',onConfirm:async()=>{},onCancel(){},children:'Details'});
 const buttons=html.match(/<button\b[^>]*>/g);
 assert.equal(buttons.length,2);
 assert.ok(buttons.every(button=>button.includes('type="button"')));
});

test('compact composer presents a single approval control and a non-submit model-panel shortcut',()=>{
 const html=render(StripCodexComposer,{value:'draft',onSend(){},toolsInSidebar:true,selectedModel:'real-model',models:[{value:'real-model',label:'Actual Model'}],modelEffortLabel:'高',onOpenModelTools(){},permissionControl:React.createElement('span',null,'APPROVAL_CONTROL')});
 assert.equal((html.match(/APPROVAL_CONTROL/g)||[]).length,1);
 assert.match(html,/<textarea[^>]*rows="1"/);
 assert.match(html,/<button type="button"[^>]*aria-label="打开模型和推理强度设置"[^>]*aria-controls="strip-tool-panel"/);
 assert.ok(html.includes('Actual Model'));assert.ok(html.includes('高'));
 assert.ok(!html.includes('strip-codex-composer__status'));
 const running=render(StripCodexComposer,{value:'draft',onSend(){},busy:true,toolsInSidebar:true,onStop(){}});
 assert.match(running,/<input[^>]*type="file"[^>]*disabled=""/);
 assert.match(running,/<button type="button"[^>]*aria-label="添加附件"[^>]*disabled=""/);
 assert.ok(running.includes('aria-label="停止生成"'));
});

test('composer shows an arrow while idle and a stop square only while streaming',()=>{
 const idle=render(StripCodexComposer,{value:'ready',onSend(){},toolsInSidebar:true,onStop(){}});
 assert.match(idle,/strip-codex-composer__action-slot" data-state="send"/);
 assert.match(idle,/<button type="submit"[^>]*aria-label="发送"[^>]*aria-hidden="false"/);
 assert.match(idle,/aria-hidden="true"[^>]*aria-label="停止生成"/);
 const running=render(StripCodexComposer,{value:'ready',onSend(){},busy:true,toolsInSidebar:true,onStop(){}});
 assert.match(running,/strip-codex-composer__action-slot" data-state="stop"/);
 assert.match(running,/aria-label="发送"[^>]*aria-hidden="true"/);
 assert.match(running,/aria-hidden="false"[^>]*aria-label="停止生成"/);
 const css=fs.readFileSync(path.join(ui,'src/styles/stop-button.css'),'utf8');
 assert.match(css,/data-state='send'\][\s\S]*?strip-codex-composer__stop[\s\S]*?visibility: hidden/);
 assert.match(css,/data-state='send'\][\s\S]*?strip-codex-composer__send[\s\S]*?visibility: visible/);
});
test('composer exposes slash hints without the removed helper buttons',()=>{
 const html=render(StripCodexComposer,{value:'/f',onSend(){},toolsInSidebar:true});
 assert.ok(html.includes('/fix'));
 assert.ok(!html.includes('优化指令'));
 assert.ok(!html.includes('展开长文本编辑器'));
 assert.ok(!html.includes('strip-prompt-enhance-button'));
 assert.ok(!html.includes('strip-workflow-expand-button'));
 assert.ok(!html.includes('strip-workflow-terminal-button'));
 assert.ok(!html.includes('按需运行命令'));
 assert.ok(!html.includes('strip-codex-composer__status'));
});




