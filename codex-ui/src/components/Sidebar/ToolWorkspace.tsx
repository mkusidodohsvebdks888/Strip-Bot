import type {ReactNode} from 'react';
import {Icon} from '../../Icons';
import {NonoBrand} from '../Brand/NonoBrand';

export type ToolView = 'history' | 'activity' | 'backend' | 'astrbot' | 'skills' | 'github-tools' | 'integrations';

const toolDefinitions:{id:ToolView;name:string;icon:string}[] = [
  {id:'history',name:'聊天记录',icon:'chat-soft'},
  {id:'activity',name:'执行记录与输出',icon:'terminal-soft'},
  {id:'backend',name:'本地后端',icon:'server'},
  {id:'skills',name:'Skills 技能',icon:'blocks'},
  {id:'github-tools',name:'GitHub 工具',icon:'package'},
  {id:'integrations',name:'MCP 项目连接',icon:'plug'},
  {id:'astrbot',name:'AstrBot QQ',icon:'bot'},
];
export const toolTitle = (view:ToolView) => toolDefinitions.find(item=>item.id===view)?.name || '工具';

export function ToolRail({active,opened,settings,busy,onTool,onNew,onSearch,onAttach,onToggle,onSettings,accountControl,searchControl}:{
  active:ToolView;opened:boolean;settings:boolean;busy:boolean;
  onTool:(view:ToolView)=>void;onNew:()=>void;onSearch?:()=>void;onAttach:()=>void;onToggle:()=>void;onSettings:()=>void;accountControl?:ReactNode;searchControl?:ReactNode;
}){
  return <nav className="strip-tool-rail strip-drag" aria-label="Strip Bot 工具栏">
    <div className="strip-tool-rail__group strip-tool-rail__group--top">
      <button type="button" className="strip-tool-btn strip-tool-btn--brand" aria-label="返回对话" title="返回对话" onClick={()=>onTool('history')}><NonoBrand className="strip-tool-brand"/></button>
      <button type="button" className="strip-tool-btn" title="新建对话" aria-label="新建对话" disabled={busy} onClick={onNew}><Icon name="square-pen"/></button>
      {searchControl ?? <button type="button" className="strip-tool-btn" title="搜索会话" aria-label="搜索会话" onClick={onSearch}><Icon name="search"/></button>}
      <div className="strip-tool-rail__divider"/>
      {toolDefinitions.map(item=><button type="button" key={item.id} className={'strip-tool-btn'+(!settings && opened && active===item.id?' is-active':'')} aria-label={item.name} title={item.name} aria-pressed={!settings && opened && active===item.id} aria-controls="strip-tool-panel" onClick={()=>onTool(item.id)}>
        <Icon name={item.icon}/>
      </button>)}
      <button type="button" className="strip-tool-btn" title="添加文本或代码附件" aria-label="添加附件" disabled={busy} onClick={onAttach}><Icon name="plus"/></button>
    </div>
    <div className="strip-tool-rail__spacer"/>
    <div className="strip-tool-rail__group strip-tool-rail__group--bottom">
      {accountControl}
      <div className="strip-tool-rail__divider"/>
      <button type="button" className={'strip-tool-btn'+(settings?' is-active':'')} title="设置与连接" aria-label="设置与连接" aria-pressed={settings} onClick={onSettings}><Icon name="settings"/></button>
      <button type="button" className="strip-tool-btn" title={(opened?'收起工具面板':'展开工具面板')+' (Ctrl+B)'} aria-keyshortcuts="Control+B Meta+B" aria-label={opened?'收起工具面板':'展开工具面板'} aria-controls="strip-tool-panel" aria-expanded={opened} onClick={onToggle}><Icon name={opened?'panel-left':'panel-right'}/></button>
    </div>
  </nav>;
}

export function ToolPanel({active,opened,onClose,children}:{active:ToolView;opened:boolean;onClose:()=>void;children:ReactNode}){
  return <aside id="strip-tool-panel" className={'strip-tool-panel'+(opened?' strip-sidebar-open':'')} aria-label={toolTitle(active)} aria-hidden={!opened} hidden={!opened}>
    <header className="strip-tool-panel__header strip-drag">
      <div className="strip-tool-panel__brand"><span className="strip-tool-panel__eyebrow">STRIP BOT / 工作区</span><strong>{toolTitle(active)}</strong></div>
      <button type="button" className="strip-tool-panel__close" title="收起面板 (Ctrl+B)" aria-label="收起工具面板" onClick={onClose}><Icon name="panel-left"/></button>
    </header>
    <div className={'strip-tool-panel__body'+(active==='history'?' is-history':'')}>
      {children}
    </div>
  </aside>;
}


