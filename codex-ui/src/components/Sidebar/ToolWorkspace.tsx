import type {ReactNode} from 'react';
import {NonoBrand} from '../Brand/NonoBrand';
import {StripIconButton} from '../ui/StripIconButton';

export type ToolView = 'history' | 'activity' | 'backend' | 'astrbot' | 'skills' | 'github-tools' | 'integrations' | 'plugins';

// Left rail shows only the essential entry points; hidden modules retain
// their source code and API data, so UI clean-up never deletes user projects.
const toolDefinitions:{id:ToolView;name:string;icon:string}[] = [
  {id:'history',name:'聊天记录',icon:'chat-soft'},
  {id:'plugins',name:'插件',icon:'package'},
];
export const toolTitle = (view:ToolView) => toolDefinitions.find(item=>item.id===view)?.name || '工具';

export function ToolRail({active,opened,settings,busy,onTool,onNew,onSearch,onAttach,onToggle,onSettings,accountControl,searchControl}:{
  active:ToolView;opened:boolean;settings:boolean;busy:boolean;
  onTool:(view:ToolView)=>void;onNew:()=>void;onSearch?:()=>void;onAttach:()=>void;onToggle:()=>void;onSettings:()=>void;accountControl?:ReactNode;searchControl?:ReactNode;
}){
  return <nav className="strip-tool-rail strip-drag" aria-label="Strip Bot 工具栏">
    <div className="strip-tool-rail__group strip-tool-rail__group--top">
      <StripIconButton className="strip-tool-btn strip-tool-btn--brand" label="返回对话" onClick={()=>onTool('history')}><NonoBrand className="strip-tool-brand"/></StripIconButton>
      <StripIconButton className="strip-tool-btn" label="新建对话" icon="square-pen" disabled={busy} onClick={onNew}/>
      {searchControl ?? <StripIconButton className="strip-tool-btn" label="搜索会话" icon="search" onClick={onSearch}/>}
      <div className="strip-tool-rail__divider"/>
      {toolDefinitions.map(item=><StripIconButton key={item.id} className="strip-tool-btn" active={!settings && opened && active===item.id} label={item.name} icon={item.icon} aria-pressed={!settings && opened && active===item.id} aria-controls="strip-tool-panel" onClick={()=>onTool(item.id)}/>)}
      <StripIconButton className="strip-tool-btn" label="添加附件" icon="plus" disabled={busy} onClick={onAttach}/>
    </div>
    <div className="strip-tool-rail__spacer"/>
    <div className="strip-tool-rail__group strip-tool-rail__group--bottom">
      {accountControl}
      <div className="strip-tool-rail__divider"/>
      <StripIconButton className="strip-tool-btn" active={settings} label="设置与连接" icon="settings" aria-pressed={settings} onClick={onSettings}/>
      <StripIconButton className="strip-tool-btn" title={(opened?'收起工具面板':'展开工具面板')+' (Ctrl+B)'} label={opened?'收起工具面板':'展开工具面板'} icon={opened?'panel-left':'panel-right'} aria-keyshortcuts="Control+B Meta+B" aria-controls="strip-tool-panel" aria-expanded={opened} onClick={onToggle}/>
    </div>
  </nav>;
}

export function ToolPanel({active,opened,onClose,children}:{active:ToolView;opened:boolean;onClose:()=>void;children:ReactNode}){
  return <aside id="strip-tool-panel" className={'strip-tool-panel'+(active==='plugins'?' strip-tool-panel--plugins':'')+(opened?' strip-sidebar-open':'')} aria-label={toolTitle(active)} aria-hidden={!opened} hidden={!opened}>
    <header className="strip-tool-panel__header strip-drag">
      <span className="strip-tool-panel__sr-title">{toolTitle(active)}</span>
      <StripIconButton className="strip-tool-panel__close" title="收起面板 (Ctrl+B)" label="收起工具面板" icon="panel-left" onClick={onClose}/>
    </header>
    <div className={'strip-tool-panel__body'+(active==='history'?' is-history':'')}>
      {children}
    </div>
  </aside>;
}


