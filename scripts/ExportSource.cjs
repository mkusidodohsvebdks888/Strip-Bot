'use strict';
// Allowlisted source export; never copy private runtime, credentials or browser data.
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
async function main(){
  const root=path.resolve(__dirname,'..');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const output=path.join(root,'exports','Strip-Bot-source-'+stamp);
  const target=path.join(output,'Strip-Bot');
  const blocked=new Set(['node_modules','.runtime','.git','.codex','.agents','dist','releases','staging','exports','.design-reference']);
  const manifest=[];
  async function copy(relative){
    if(relative.split(path.sep).some(part=>blocked.has(part) || /^\.env(?:\.|$)/i.test(part)))return;
    const from=path.join(root,relative),stat=await fs.lstat(from);
    if(stat.isSymbolicLink())return;
    if(stat.isDirectory()){for(const name of await fs.readdir(from))await copy(path.join(relative,name));return;}
    if(!stat.isFile() || /\.(?:log|exe|dll|zip|pfx|pem|key)$/i.test(relative))return;
    const data=await fs.readFile(from),to=path.join(target,relative);
    await fs.mkdir(path.dirname(to),{recursive:true});await fs.writeFile(to,data);
    manifest.push({path:relative.replaceAll('\\','/'),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
  }
  for(const directory of ['backend','codex-ui','agent-runtime','desktop-app','scripts','test','licenses'])await copy(directory);
  for(const file of await fs.readdir(root))if(/\.(?:md|cjs|js|json|ps1|bat|txt)$/i.test(file) || file==='.gitignore')await copy(file);
  const build=JSON.parse((await fs.readFile(path.join(root,'public','build-manifest.json'),'utf8')).replace(/^\uFEFF/,''));
  for(const file of ['index.html','brand-logo.png','strip-bot.ico','build-manifest.json',...build.assets]){
    if(!/^[a-zA-Z0-9_./-]+$/.test(file) || file.split('/').includes('..'))throw new Error('Invalid build manifest');
    await copy(path.join('public',file));
  }
  await copy(path.join('public','strip-buttons'));
  const instructions="# Strip Bot 最新源码包\n\n打包日期：2026-10-20。\n\n包含按需弹出的内联命令窗口、默认折叠的手动命令结果（当前运行期间按会话保留）、本地后端授权、Skills 管理、GitHub 工具导入和 MCP 项目连接，以及长文本编辑、UTF-8 文件输入、修改文件下载、手动终端、回复导出，以及当前完整源码和已构建的前端界面：流光能量等六种滑杆外观、五档推理与响应、模型切换、Markdown 聊天、执行时间线、错误提示优化、精简工具栏、置顶/项目/最近会话列表、API Key 接入、主题和自定义图片背景。Aa 字号切换已移除，保留舒适字号。\n\n## Windows 使用\n\n解压后进入 Strip-Bot 文件夹，双击 rebuild-and-start.bat。需要 Node.js 和 npm；脚本会安装依赖、构建界面并启动。\n\n也可使用已构建页面：先执行 npm.cmd ci --prefix .\\agent-runtime，再运行 npm.cmd start，然后打开 http://127.0.0.1:3060/。\n\n修改前端后，在项目目录执行：\n\n    npm.cmd ci --prefix .\\codex-ui\n    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\BuildUI.ps1\n\n## 流光拉杆\n\n进入工作区，点击输入框的响应档位 → 滑杆外观 → 流光能量。原有外观默认选择保留；档位是否可用由实际模型和渠道能力决定。\n\n## 桌面开发\n\n    npm.cmd ci --prefix .\\desktop-app\n    npm.cmd start --prefix .\\desktop-app\n\n本包为源码包，不含 Electron 可执行程序、node_modules、个人 API 密钥、账号授权、聊天记录或 .runtime。目标机器需要重新配置模型连接。\n\n当前源码已通过 163 项回归测试（含真实隔离引擎与本地测试 MCP）及 TypeScript/Vite 正式构建。未进行本次真实付费模型调用及桌面视觉验收。可执行 npm.cmd test 运行回归测试；单独的 real/e2e 脚本可能调用真实模型，运行前请先阅读源码。\n\nSOURCE-MANIFEST.json 提供文件 SHA-256；历史文档可能描述旧界面，当前启动说明以本文件为准。\n";
  await fs.writeFile(path.join(target,'START-HERE.md'),instructions);
  await fs.writeFile(path.join(target,'SOURCE-MANIFEST.json'),JSON.stringify({createdAt:new Date().toISOString(),files:manifest},null,2));
  console.log(JSON.stringify({output,target,files:manifest.length,bytes:manifest.reduce((sum,file)=>sum+file.bytes,0)}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
