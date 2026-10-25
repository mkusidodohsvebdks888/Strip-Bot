'use strict';
const os=require('node:os'),{pathToFileURL}=require('node:url');
const {fs,path,fail,absolute,binary,run,registryPath,installed}=require('../_shared.cjs');
function command(){
  const p=process.platform;
  return binary('LIBREOFFICE_BIN',p==='win32'?[registryPath('HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\soffice.exe','Path','soffice.com'),path.join(process.env.ProgramFiles||'C:/Program Files','LibreOffice/program/soffice.com')].filter(Boolean):p==='darwin'?['/Applications/LibreOffice.app/Contents/MacOS/soffice']:['/usr/bin/libreoffice','/usr/bin/soffice'],'soffice');
}
function status(){const cmd=command(),ready=installed(cmd);return {dependency:'LibreOffice',command:cmd,installed:ready,description:ready?'LibreOffice 已就绪，可将本地文档转换为 PDF。':'未找到 LibreOffice，请安装或配置 LIBREOFFICE_BIN。'};}
async function execute({action,input,output}){
  if(action!=='convert')throw fail('无效的文档转换操作。');
  const src=absolute(input,'输入文档'),dir=absolute(output,'输出目录');
  if(!new Set(['.doc','.docx','.ppt','.pptx','.xls','.xlsx','.odt','.ods','.odp','.rtf']).has(path.extname(src).toLowerCase()))throw fail('不支持的文档格式。');
  if(!(await fs.stat(src).catch(()=>null))?.isFile())throw fail('输入文档不存在。',404);
  if((await fs.stat(dir).catch(()=>null))?.isFile())throw fail('输出路径必须是文件夹。');
  const dest=path.join(dir,path.parse(src).name+'.pdf');
  if(await fs.stat(dest).catch(()=>null))throw fail('目标 PDF 已存在；为避免覆盖请更换输出目录。',409);
  await fs.mkdir(dir,{recursive:true});
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'strip-pdf-'));
  try {
    await run(command(),['-env:UserInstallation='+pathToFileURL(profile).href,'--headless','--convert-to','pdf','--outdir',dir,src]);
    if(!(await fs.stat(dest).catch(()=>null))?.isFile())throw fail('未生成 PDF，请确认 LibreOffice 已安装。',502);
    return {ok:true,output:dest,message:'PDF 转换完成。'};
  }finally{await fs.rm(profile,{recursive:true,force:true});}
}
module.exports={status,execute};
