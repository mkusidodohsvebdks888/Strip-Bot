import type {ReactNode} from 'react';
import {StripIconButton} from '../ui/StripIconButton';

export type ToolView = 'history' | 'activity' | 'backend' | 'astrbot' | 'skills' | 'github-tools' | 'integrations' | 'plugins';

const toolDefinitions:{id:ToolView;name:string;icon:string}[]=[
  {id:'history',name:'聊天记录',icon:'chat-soft'},
  {id:'backend',name:'本地项目',icon:'folder-soft'},
  {id:'skills',name:'Skills 技能',icon:'blocks'},
  {id:'plugins',name:'插件与工具',icon:'layout-grid'},
  {id:'integrations',name:'MCP 连接',icon:'plug'},
  {id:'github-tools',name:'GitHub 工具',icon:'git-branch'},
  {id:'astrbot',name:'机器人',icon:'bot'},
];
export const toolTitle=(view:ToolView)=>toolDefinitions.find(item=>item.id===view)?.name||'工具';

export function ToolRail({active,opened,settings,onTool,accountControl}:{
  active:ToolView;opened:boolean;settings:boolean;
  onTool:(view:ToolView)=>void;
  accountControl?:ReactNode;
}){
  return <nav className="strip-tool-rail strip-drag" aria-label="Strip Bot 工具栏">
    <div className="strip-tool-rail__group strip-tool-rail__group--top">
      {toolDefinitions.map(item=><StripIconButton key={item.id} className="strip-tool-btn"
        active={!settings&&opened&&active===item.id} label={item.name} icon={item.icon}
        aria-pressed={!settings&&opened&&active===item.id} aria-controls="strip-tool-panel"
        onClick={()=>onTool(item.id)}/>)}
    </div>
    <div className="strip-tool-rail__spacer"/>
    <div className="strip-tool-rail__group strip-tool-rail__group--bottom">

      {accountControl}
    </div>
  </nav>;
}

export function ToolPanel({active,opened,children}:{active:ToolView;opened:boolean;children:ReactNode}){
  return <aside id="strip-tool-panel"
    className={'strip-tool-panel'+(['plugins','github-tools','integrations','astrbot'].includes(active)?' strip-tool-panel--plugins':'')+(opened?' strip-sidebar-open':'')}
    aria-label={toolTitle(active)} aria-hidden={!opened} hidden={!opened}>
    <header className="strip-tool-panel__header strip-drag"><strong>{toolTitle(active)}</strong></header>
    <div className={'strip-tool-panel__body'+(active==='history'?' is-history':'')}>{children}</div>
  </aside>;
}
