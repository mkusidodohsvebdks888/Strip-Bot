import {useEffect,useRef,useState} from 'react';
import {ControlIcon} from '../ControlIcon';
import {Icon} from '../../Icons';
import './chat-history.css';
import {useAnchoredPopup} from '../useAnchoredPopup';

type Entry = {id:string;title:string;description:string;updatedAt:number;workspace?:string};
// Preserve existing pinned and visited project data; only remove UI group labels.
const pinnedKey = 'strip_codex_sidebar_pinned_v1';
const projectsKey = 'strip_recent_project_paths_v1';

function readPinned():string[] {
  try {
    const value=JSON.parse(localStorage.getItem(pinnedKey)||'[]');
    return Array.isArray(value)? [...new Set(value.filter((id):id is string=>typeof id==='string' && /^(?:ses_[a-zA-Z0-9]+|legacy:.+)$/.test(id)))].slice(0,200):[];
  }catch{return [];}
}
function readProjects():string[] {
  try{const value=JSON.parse(localStorage.getItem(projectsKey)||'[]');return Array.isArray(value)?[...new Set(value.filter((path):path is string=>typeof path==='string' && path.length>0 && path.length<=1024))].slice(0,30):[];}catch{return [];}
}
function projectName(path:string):string {return path.replace(/[\\/]+$/,'').split(/[\\/]/).pop() || path;}

export function ChatHistory({entries,search='',active,busy,workspace='',projects=[],onSelect,onRemove,onOpenProject,onProjectSettings}:{
  entries:Entry[];search?:string;active:string;busy:boolean;workspace?:string;projects?:string[];
  onSelect:(id:string)=>void;onRemove:(id:string)=>void;onOpenProject?:(path:string)=>void;onProjectSettings?:()=>void;
}) {
  const [pinned,setPinned]=useState(readPinned);
  const [visitedProjects,setVisitedProjects]=useState(readProjects);
  const [openMenu,setOpenMenu]=useState<{id:string;trigger:HTMLButtonElement}|null>(null);
  const menuRef=useRef<HTMLDivElement>(null),triggerRef=useRef<HTMLButtonElement|null>(null);
  triggerRef.current=openMenu?.trigger || null;
  const menuPosition=useAnchoredPopup(Boolean(openMenu),triggerRef,menuRef,{width:170});
  const [recentLimit,setRecentLimit]=useState(24);
  const [showAllProjects,setShowAllProjects]=useState(false);
  useEffect(()=>{try{localStorage.setItem(pinnedKey,JSON.stringify(pinned));}catch{}},[pinned]);
  useEffect(()=>{if(workspace.trim())setVisitedProjects(values=>values[0]===workspace?values:[workspace,...values.filter(value=>value!==workspace)].slice(0,30));},[workspace]);
  useEffect(()=>{try{localStorage.setItem(projectsKey,JSON.stringify(visitedProjects));}catch{}},[visitedProjects]);
  useEffect(()=>{
    if(!openMenu)return;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close=(event:PointerEvent)=>{const target=event.target as Node;if(!menuRef.current?.contains(target) && !openMenu.trigger.contains(target))setOpenMenu(null);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();openMenu.trigger.focus();setOpenMenu(null);}};
    document.addEventListener('pointerdown',close);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};
  },[openMenu]);
  const query=search.trim().toLocaleLowerCase();
  const sorted=[...entries].sort((a,b)=>b.updatedAt-a.updatedAt);
  const visible=query?sorted.filter(entry=>entry.title.toLocaleLowerCase().includes(query)):sorted;
  const pinnedEntries=pinned.map(id=>visible.find(entry=>entry.id===id)).filter((entry):entry is Entry=>Boolean(entry));
  const recentEntries=visible.filter(entry=>!pinned.includes(entry.id));
  const activeProject=entries.find(entry=>entry.id===active)?.workspace || workspace;
  const projectPaths=[...new Set([workspace,...projects,...visitedProjects,...entries.map(entry=>entry.workspace||'')].filter((path):path is string=>typeof path==='string' && Boolean(path.trim())))].slice(0,30);
  const filteredProjects=projectPaths.filter(path=>!query || projectName(path).toLocaleLowerCase().includes(query) || visible.some(entry=>entry.workspace===path));
  function togglePinned(id:string){setPinned(current=>current.includes(id)?current.filter(value=>value!==id):[id,...current].slice(0,200));setOpenMenu(null);}
  function removeEntry(id:string){setOpenMenu(null);onRemove(id);}
  const renderEntry=(entry:Entry,nested=false)=>{
    return <div key={entry.id} className={'strip-cx-thread'+(active===entry.id?' is-active':'')+(nested?' is-nested':'')+(pinned.includes(entry.id)?' is-pinned':'')}>
      <button type="button" className="strip-cx-thread__main" title={entry.title} aria-current={active===entry.id?'page':undefined} disabled={busy} onClick={()=>{setOpenMenu(null);onSelect(entry.id);}}><span>{entry.title || '未命名对话'}</span></button>
      <div className="strip-cx-actions">
        <button type="button" className="strip-cx-more" aria-label={'管理会话：'+entry.title} aria-expanded={Boolean(openMenu?.id===entry.id && openMenu.trigger.dataset.menuLocation===(nested?'project':'list'))} aria-haspopup="true" title="更多操作" data-menu-entry={entry.id} data-menu-location={nested?'project':'list'} onClick={event=>{const trigger=event.currentTarget;setOpenMenu(value=>value?.trigger===trigger?null:{id:entry.id,trigger});}}><Icon name="ellipsis"/></button>
      </div>
    </div>;
  };
  return <nav className="strip-cx-history strip-chat-history" aria-label="项目与历史会话">
    {/* No tab/group labels: project folders first, then one chronological list. */}
    {(filteredProjects.length>0 || onProjectSettings) && <section className="strip-cx-section strip-cx-section--projects" aria-label="项目目录">
      <div className="strip-cx-project-list">
        {filteredProjects.slice(0,showAllProjects?filteredProjects.length:5).map(path=><div className="strip-cx-project" key={path}>
          <div className="strip-cx-project__row">
            <button type="button" className={'strip-cx-project__open'+(activeProject===path?' is-current':'')}
              title={path} disabled={busy || !onOpenProject}
              onClick={()=>onOpenProject?.(path)}>
              <Icon name="folder-soft"/>
              <span>{projectName(path)}</span>
            </button>
          </div>
        </div>)}
        {filteredProjects.length>5 && <button type="button" className="strip-cx-show-more strip-cx-project-more" onClick={()=>setShowAllProjects(value=>!value)}>{showAllProjects?'收起项目':`展开更多项目 (${filteredProjects.length-5})`}</button>}
        {onProjectSettings && <button type="button" className="strip-cx-add-project" aria-label="管理项目目录" title="管理项目目录" onClick={onProjectSettings}><ControlIcon name="plus" size={15}/></button>}
      </div>
    </section>}
    <section className="strip-cx-section strip-cx-section--conversations" aria-label="会话列表">
      <div className="strip-cx-section__list">
        {pinnedEntries.map(entry=>renderEntry(entry))}
        {recentEntries.slice(0,recentLimit).map(entry=>renderEntry(entry))}
        {recentEntries.length>recentLimit && <button type="button" className="strip-cx-show-more" onClick={()=>setRecentLimit(value=>value+24)}>加载更多会话 <ControlIcon name="down" size={14}/></button>}
        {!visible.length && <p className="strip-cx-hint">{query?'没有匹配的会话':'还没有会话'}</p>}
      </div>
    </section>
    {openMenu && <div ref={menuRef} className="strip-cx-menu" role="group" aria-label={'会话操作：'+(entries.find(entry=>entry.id===openMenu.id)?.title || '未命名对话')} style={menuPosition}>
      <button type="button" onClick={()=>{openMenu.trigger.focus();togglePinned(openMenu.id);}}><ControlIcon name="star" size={14}/>{pinned.includes(openMenu.id)?'取消置顶':'置顶会话'}</button>
      <button type="button" className="strip-cx-danger" disabled={busy} onClick={()=>{openMenu.trigger.focus();removeEntry(openMenu.id);}}><Icon name="trash-bin-trash"/>删除会话</button>
    </div>}
    {query && !visible.length && !filteredProjects.length && <p className="strip-cx-hint" role="status">没有匹配的项目或会话</p>}
  </nav>;
}
