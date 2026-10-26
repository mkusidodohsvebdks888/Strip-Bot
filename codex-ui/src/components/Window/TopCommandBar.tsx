import {useEffect,useRef,useState} from 'react';
import {Icon} from '../../Icons';
import './top-command-bar.css';

type MenuName='file'|'edit'|'view'|'help';
type Action={label:string;icon:string;shortcut?:string;disabled?:boolean;run:()=>void};
type Props={
  canPrevious:boolean;canNext:boolean;
  onPrevious:()=>void;onNext:()=>void;
  onToggleSidebar:()=>void;
  sidebarOpen:boolean;
  onNewChat:()=>void;
  onSearch:()=>void;
  onFocusComposer:()=>void;
  onAttach:()=>void;
  onOpenProject:()=>void;
  onOpenSettings:()=>void;
  onHistory:()=>void;
  onPlugins:()=>void;
};

/** Native-titlebar-safe command surface inspired by the Codex Desktop layout.
 * The Electron window owns minimize/maximize/close hit targets on the right.
 * Every menu item delegates to an existing StripBot action.
 */
export function TopCommandBar({
  canPrevious,canNext,onPrevious,onNext,onToggleSidebar,sidebarOpen,
  onNewChat,onSearch,onFocusComposer,onAttach,onOpenProject,onOpenSettings,onHistory,onPlugins,
}:Props){
  const [open,setOpen]=useState<MenuName|null>(null);
  const [showShortcuts,setShowShortcuts]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const panel=useRef<HTMLDivElement>(null);
  const trigger=useRef<Record<MenuName,HTMLButtonElement|null>>({file:null,edit:null,view:null,help:null});
  const close=()=>setOpen(null);
  useEffect(()=>{
    if(!open)return;
    const onOutside=(event:PointerEvent)=>{
      if(event.target instanceof Node&&!root.current?.contains(event.target))close();
    };
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();const current=open;close();trigger.current[current]?.focus();}
    };
    document.addEventListener('pointerdown',onOutside);
    document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('pointerdown',onOutside);document.removeEventListener('keydown',onKey);};
  },[open]);
  useEffect(()=>{
    if(!showShortcuts)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setShowShortcuts(false);trigger.current.help?.focus();}};
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[showShortcuts]);
  const run=(fn:()=>void)=>{close();fn();};
  const groups:{id:MenuName;label:string;actions:Action[]}[]=[
    {id:'file',label:'文件',actions:[
      {label:'新建聊天',icon:'square-pen',shortcut:'Ctrl+N',run:onNewChat},
      {label:'项目与目录',icon:'folder-open',run:onOpenProject},
      {label:'设置',icon:'settings',run:onOpenSettings},
    ]},
    {id:'edit',label:'编辑',actions:[
      {label:'聚焦输入框',icon:'chat-soft',run:onFocusComposer},
      {label:'添加附件',icon:'plus',run:onAttach},
      {label:'搜索会话',icon:'search',shortcut:'Ctrl+K',run:onSearch},
    ]},
    {id:'view',label:'视图',actions:[
      {label:sidebarOpen?'收起侧边栏':'展开侧边栏',icon:'panel-left',shortcut:'Ctrl+B',run:onToggleSidebar},
      {label:'聊天记录',icon:'chat-soft',run:onHistory},
      {label:'插件与工具',icon:'package',run:onPlugins},
    ]},
    {id:'help',label:'帮助',actions:[
      {label:'键盘快捷键',icon:'circle-help',run:()=>setShowShortcuts(true)},
    ]},
  ];
  return <>
    <div className="strip-top-commandbar" ref={root} aria-label="Strip Bot 菜单栏">
      <div className="strip-top-commandbar__navigation" aria-label="会话导航">
        <button type="button" className="strip-top-commandbar__icon" title="上一条会话" aria-label="上一条会话" disabled={!canPrevious} onClick={onPrevious}><Icon name="arrow-left"/></button>
        <button type="button" className="strip-top-commandbar__icon" title="下一条会话" aria-label="下一条会话" disabled={!canNext} onClick={onNext}><Icon name="arrow-right"/></button>
        <button type="button" className="strip-top-commandbar__icon strip-top-commandbar__toggle" title={sidebarOpen?'收起侧边栏 (Ctrl+B)':'展开侧边栏 (Ctrl+B)'} aria-label={sidebarOpen?'收起侧边栏':'展开侧边栏'} aria-expanded={sidebarOpen} aria-controls="strip-tool-panel" onClick={onToggleSidebar}><Icon name="panel-left"/></button>
      </div>
      <nav className="strip-top-commandbar__menus" aria-label="文件与视图操作">
        {groups.map(group=><div key={group.id} className="strip-top-commandbar__menu">
          <button type="button" ref={node=>{trigger.current[group.id]=node;}}
            className="strip-top-commandbar__trigger" aria-expanded={open===group.id}
            aria-haspopup="menu" onClick={()=>setOpen(current=>current===group.id?null:group.id)}
            onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen(group.id);requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());}}}>
            {group.label}
          </button>
          {open===group.id && <div ref={panel} role="menu" aria-label={group.label} className="strip-top-commandbar__popup">
            {group.actions.map(item=><button type="button" role="menuitem" key={item.label} disabled={item.disabled}
              onClick={()=>run(item.run)}><Icon name={item.icon}/><span>{item.label}</span>{item.shortcut&&<kbd>{item.shortcut}</kbd>}</button>)}
          </div>}
        </div>)}
      </nav>
    </div>
    {showShortcuts&&<div className="strip-top-shortcuts-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setShowShortcuts(false);}}>
      <section className="strip-top-shortcuts" role="dialog" aria-modal="true" aria-label="快捷键说明">
        <header><strong>键盘快捷键</strong><button type="button" onClick={()=>setShowShortcuts(false)} aria-label="关闭快捷键"><Icon name="x"/></button></header>
        <dl><div><dt>搜索聊天</dt><dd>Ctrl + K</dd></div><div><dt>侧边栏展开/收起</dt><dd>Ctrl + B</dd></div><div><dt>新建聊天</dt><dd>Ctrl + N</dd></div></dl>
        <button type="button" className="strip-top-shortcuts__close" onClick={()=>setShowShortcuts(false)}>关闭</button>
      </section>
    </div>}
  </>;
}
