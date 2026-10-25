'use strict';
const os=require('node:os'),{pathToFileURL}=require('node:url');
const {fs,path,fail,absolute,binary,run}=require('../_shared.cjs');
function command(){
  const p=process.platform;
  return binary('LIBREOFFICE_BIN',p==='win32'?[path.join(process.env.ProgramFiles||'C:/Program Files','LibreOffice/program/soffice.com')]:p==='darwin'?['/Applications/LibreOffice.app/Contents/MacOS/soffice']:['/usr/bin/libreoffice','/usr/bin/soffice'],'soffice');
}
function status(){return {dependency:'LibreOffice',command:command(),description:'需要安装免费 LibreOffice，仓库中的源码不是可执行程序。'};}
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
