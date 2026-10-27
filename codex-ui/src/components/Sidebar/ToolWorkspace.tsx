import {useEffect,useRef,useState,type ReactNode} from 'react';
import {NonoBrand} from '../Brand/NonoBrand';
import {Icon} from '../../Icons';
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

export function ToolRail({active,opened,settings,busy,onTool,onAttach,onToggle,accountControl}:{
  active:ToolView;opened:boolean;settings:boolean;busy:boolean;
  onTool:(view:ToolView)=>void;onAttach:()=>void;onToggle:()=>void;
  accountControl?:ReactNode;
}){
  return <nav className="strip-tool-rail strip-drag" aria-label="Strip Bot 工具栏">
    <div className="strip-tool-rail__group strip-tool-rail__group--top">
      <StripIconButton className="strip-tool-btn strip-tool-btn--brand" label="聊天主页" title="聊天主页" onClick={()=>onTool('history')}><NonoBrand className="strip-tool-brand"/></StripIconButton>
      <div className="strip-tool-rail__divider" aria-hidden="true"/>
      {toolDefinitions.map(item=><StripIconButton key={item.id} className="strip-tool-btn"
        active={!settings&&opened&&active===item.id} label={item.name} icon={item.icon}
        aria-pressed={!settings&&opened&&active===item.id} aria-controls="strip-tool-panel"
        onClick={()=>onTool(item.id)}/>)}
      <div className="strip-tool-rail__divider" aria-hidden="true"/>
      <StripIconButton className="strip-tool-btn" label="添加附件" icon="plus" disabled={busy} onClick={onAttach}/>
    </div>
    <div className="strip-tool-rail__spacer"/>
    <div className="strip-tool-rail__group strip-tool-rail__group--bottom">

      <StripIconButton className="strip-tool-btn" title={(opened?'收起侧边栏':'展开侧边栏')+' (Ctrl+B)'}
        label={opened?'收起侧边栏':'展开侧边栏'} icon={opened?'panel-left':'panel-right'}
        aria-keyshortcuts="Control+B Meta+B" aria-controls="strip-tool-panel" aria-expanded={opened} onClick={onToggle}/>
      {accountControl}
    </div>
  </nav>;
}

export function ToolPanel({active,opened,onClose,children,onTool,onSettings,searchControl}:{
  active:ToolView;opened:boolean;onClose:()=>void;children:ReactNode;
  onTool:(view:ToolView)=>void;onSettings:()=>void;searchControl?:ReactNode;
}){
  const [menuOpen,setMenuOpen]=useState(false);
  const dropdownRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!menuOpen)return;
    const outside=(event:PointerEvent)=>{
      if(event.target instanceof Node&&!dropdownRef.current?.contains(event.target))setMenuOpen(false);
    };
    const escape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setMenuOpen(false);triggerRef.current?.focus();}
    };
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[menuOpen]);
  useEffect(()=>{if(!opened)setMenuOpen(false);},[opened]);
  const selectTool=(view:ToolView)=>{setMenuOpen(false);if(view!==active)onTool(view);};
  return <aside id="strip-tool-panel"
    className={'strip-tool-panel'+(['plugins','github-tools','integrations','astrbot'].includes(active)?' strip-tool-panel--plugins':'')+(opened?' strip-sidebar-open':'')}
    aria-label={toolTitle(active)} aria-hidden={!opened} hidden={!opened}>
    <header className="strip-tool-panel__header strip-drag">
      <div ref={dropdownRef} className="strip-tool-panel__workspace-menu">
        <button type="button" ref={triggerRef} className="strip-tool-panel__workspace-trigger"
          title="切换工作区" aria-label="切换工作区" aria-haspopup="menu" aria-expanded={menuOpen}
          onClick={()=>setMenuOpen(value=>!value)}>
          <Icon name="chevron-down"/>
        </button>
        {menuOpen&&<div role="menu" className="strip-tool-panel__workspace-popup" aria-label="工作区菜单">
          <button type="button" role="menuitem" onClick={()=>selectTool('history')}><Icon name="chat-soft"/>聊天记录</button>
          <button type="button" role="menuitem" onClick={()=>selectTool('plugins')}><Icon name="package"/>插件与工具</button>
          <button type="button" role="menuitem" onClick={()=>{setMenuOpen(false);onSettings();}}><Icon name="settings"/>设置</button>
        </div>}
      </div>
      <div className="strip-tool-panel__header-actions">
        {active==='history'&&searchControl}
        <StripIconButton className="strip-tool-panel__close" title="收起侧边栏 (Ctrl+B)" label="收起侧边栏" icon="panel-left" onClick={onClose}/>
      </div>
    </header>
    <div className={'strip-tool-panel__body'+(active==='history'?' is-history':'')}>
      {children}
    </div>
  </aside>;
}
