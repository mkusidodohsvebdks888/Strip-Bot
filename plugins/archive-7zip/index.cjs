'use strict';
const {fs,path,fail,absolute,binary,run,registryPath,installed}=require('../_shared.cjs');
function command(){
  return binary('SEVENZIP_BIN',process.platform==='win32'?[registryPath('HKLM\\Software\\7-Zip','Path64','7z.exe'),registryPath('HKCU\\Software\\7-Zip','Path','7z.exe'),path.join(process.env.ProgramFiles||'C:/Program Files','7-Zip/7z.exe')].filter(Boolean):['/usr/bin/7z','/usr/local/bin/7z'],'7z');
}
function status(){const cmd=command(),ready=installed(cmd);return {dependency:'7-Zip',command:cmd,installed:ready,description:ready?'7-Zip 已就绪，可压缩或解压本地文件。':'未找到 7-Zip，请安装或配置 SEVENZIP_BIN。'};}
async function execute({action,input,output}){
  const src=absolute(input,'源文件'),dst=absolute(output,'目标路径');
  const stat=await fs.stat(src).catch(()=>null);
  if(!stat)throw fail('源文件或文件夹不存在。',404);
  if(await fs.stat(dst).catch(()=>null))throw fail('目标路径已存在；禁止覆盖。',409);
  if(action==='extract'){
    if(!stat.isFile() || !new Set(['.zip','.7z','.rar','.tar','.gz','.bz2','.xz']).has(path.extname(src).toLowerCase()))throw fail('请选择支持的压缩包文件。');
    await fs.mkdir(path.dirname(dst),{recursive:true});
    await run(command(),['x','-bd','-o'+dst,'--',src]);
    return {ok:true,output:dst,message:'解压完成。'};
  }
  if(action==='compress'){
    const ext=path.extname(dst).toLowerCase();
    if(!['.7z','.zip'].includes(ext))throw fail('压缩输出路径必须以 .7z 或 .zip 结尾。');
    const relative=path.relative(src,dst);
    if(stat.isDirectory() && (relative==='' || (!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))))throw fail('不能把压缩包放进待压缩目录。');
    await fs.mkdir(path.dirname(dst),{recursive:true});
    await run(command(),['a','-bd','-t'+ext.slice(1),'--',dst,src]);
    if(!(await fs.stat(dst).catch(()=>null))?.isFile())throw fail('未创建压缩包。',502);
    return {ok:true,output:dst,message:'压缩完成。'};
  }
  throw fail('不支持的压缩动作。');
}
module.exports={status,execute};
