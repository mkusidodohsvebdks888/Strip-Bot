import {presentIssue} from '../issue-presentation.mjs';
import type {Snapshot} from '../AgentPanel';

export type ActivityEvent={id:string;type:string;status:string;title:string;subtitle?:string;path?:string;add?:number;del?:number;defaultOpen?:boolean;sourceMessageId?:string;startedAt?:number;endedAt?:number;detail?:Record<string,unknown>};
const record=(value:unknown):Record<string,unknown>=>value && typeof value==='object' && !Array.isArray(value)?value as Record<string,unknown>:{};
function text(value:unknown):string {
  if(value===undefined || value===null)return '';
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.map(item=>{const part=record(item);return typeof part.text==='string'?part.text:JSON.stringify(item,null,2);}).join('\n');
  const part=record(value);return typeof part.message==='string'?part.message:JSON.stringify(value,null,2);
}
const preview=(value:unknown)=>{const result=text(value);return result.length>24000?result.slice(0,24000)+'\n…显示已截断':result;};
const string=(value:unknown)=>typeof value==='string'?value:'';
export function activityEvents(snapshot:Snapshot|null):ActivityEvent[]{
  if(!snapshot)return [];
  const events:ActivityEvent[]=[];
  let failedTool:ActivityEvent|undefined;
  for(const message of [...snapshot.messages].reverse()){
    if(message.type==='user')failedTool=undefined;
    for(const [index,tool] of (message.content || []).entries()){
      if(tool.type!=='tool')continue;
      const name=tool.name || 'tool',input=record(tool.state?.input),status=tool.state?.status;
      const state=status==='completed'?'success':status==='error'?'error':['pending','queued'].includes(status || '')?'pending':status==='running'?'running':'idle';
      const type=['shell','bash','terminal'].includes(name)?'command':['write','edit','apply_patch','patch'].includes(name)?'edit':['grep','glob','search','webfetch','websearch'].includes(name)?'search':name==='read'?'read':['todowrite','plan'].includes(name)?'plan':'read';
      const commandLine=string(input.command).split('\n')[0].trim();
      const title=type==='command' ? '运行 '+(commandLine ? commandLine.slice(0,100) : '命令') :
        type==='edit' ? '编辑文件' : type==='search' ? '搜索' : type==='read' ? '读取文件' : '更新计划';
      const content=preview(tool.state?.content),failure=preview(tool.state?.error);
      const output=[content,...(failure && failure!==content?[failure]:[])].filter(Boolean).join('\n\n');
      const path=string(input.path || input.filePath || input.file_path);
      const before=input.oldString ?? input.old_string,after=input.newString ?? input.new_string;
      const replacement=type==='edit' && state==='success' && typeof before==='string' && typeof after==='string';
      events.push({id:message.id+':'+(tool.id || index),sourceMessageId:message.id,type:state==='error'?'error':type,status:state,title,path,startedAt:tool.time?.created ?? tool.time?.ran ?? message.time?.created,endedAt:tool.time?.completed,subtitle:({success:'已完成',error:'执行失败',pending:'等待执行',running:'执行中',idle:'已停止或状态未知'} as Record<string,string>)[state],detail:type==='command'?{kind:'command',command:string(input.command),cwd:string(input.workdir || input.cwd) || snapshot.workspace,output}:replacement?{kind:'diff',diffTitle:path+' · 替换片段',diff:[...preview(before).split('\n').map(line=>({kind:'del',text:line})),...preview(after).split('\n').map(line=>({kind:'add',text:line}))]}:{kind:state==='error'?'error':'text',message:[preview(input),output].filter(Boolean).join('\n\n')}});
      if(state==='error'){
        failedTool=events[events.length-1];
        failedTool.defaultOpen=false;
        failedTool.subtitle=presentIssue(tool.state?.error || output).summary;
      }
    }
    if(message.error){
      const issue=presentIssue(message.error);
      if(issue.interrupted && failedTool){
        const detail=failedTool.detail || {};
        const field=detail.kind==='command'?'output':'message';
        const previous=string(detail[field]);
        failedTool.detail={...detail,[field]:previous.includes(issue.detail)?previous:[previous,issue.detail].filter(Boolean).join('\n\n')};
        failedTool.subtitle+=' · 执行已中断';
      }else events.push({id:message.id+':error',sourceMessageId:message.id,type:'error',status:'error',title:issue.title,subtitle:issue.summary,detail:{kind:'error',message:issue.detail},defaultOpen:false});
    }
  }
  const latestAssistant=snapshot.messages.find(message=>message.type==='assistant')?.id;
  for(const [index,value] of snapshot.diff.entries()){
    const file=record(value),path=string(file.path || file.filePath || file.file),patch=string(file.patch || file.diff);
    // Diff belongs to the latest turn, not a dangling section below the whole chat.
    if(events.some(event=>event.type==='edit' && event.path===path))continue;
    const diff=patch.split('\n').map(line=>({kind:line.startsWith('+') && !line.startsWith('+++')?'add':line.startsWith('-') && !line.startsWith('---')?'del':'context',text:line}));
    events.push({id:'diff:'+path+':'+index,sourceMessageId:latestAssistant,type:'edit',status:'success',title:'修改文件',path,add:typeof file.additions==='number'?file.additions:undefined,del:typeof file.deletions==='number'?file.deletions:undefined,detail:patch?{kind:'diff',diff,diffTitle:path}:{kind:'text',message:preview(value)}});
  }
  for(const permission of snapshot.permissions)events.push({id:'permission:'+permission.id,type:'approval',status:'pending',title:'需要你确认 · '+permission.action,subtitle:'请核对操作详情；长期授权需要再次确认。',defaultOpen:true,detail:{kind:'approval',message:[permission.resources.join('\n'),preview(permission.metadata)].filter(Boolean).join('\n\n')}});
  return events;
}
export function activityStatus(snapshot:Snapshot|null,busy:boolean){
  if(snapshot?.permissions.length || snapshot?.forms.length)return 'pending';
  if(busy)return 'running';
  // A past failed turn should not mark a later successful turn as failed.
  const latest=snapshot?.messages.find(message=>message.type==='assistant');
  if(latest?.error || latest?.content?.some(tool=>tool.type==='tool' && tool.state?.status==='error'))return 'error';
  return 'idle';
}

// Groups the actual tool events next to the messages that produced them.
// Snapshot.messages is newest-first. Session-wide diffs and live approvals
// have no reliable turn timestamp; they stay in a clearly labelled tail.
export function linearActivity(snapshot:Snapshot|null){
  const chronological=[...(snapshot?.messages || [])].reverse();
  const grouped=new Map<string,ActivityEvent[]>();
  for(const message of chronological)grouped.set(message.id,[]);
  const tail:ActivityEvent[]=[];
  for(const event of activityEvents(snapshot)){
    const group=event.sourceMessageId && grouped.get(event.sourceMessageId);
    if(group)group.push(event);
    else tail.push(event);
  }
  return {turns:chronological.map(message=>({message,events:grouped.get(message.id) || []})),tail};
}
