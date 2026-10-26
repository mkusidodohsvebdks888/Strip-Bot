import {useState} from 'react';
import {BuiltinPluginsTool} from './BuiltinPluginsTool';
import {GithubToolsTool} from './GithubToolsTool';
import {IntegrationsTool} from './IntegrationsTool';
import {AstrBotTool} from './AstrBotTool';
import {MarketplaceTool} from './MarketplaceTool';
import './tools-hub.css';

export type ToolsSection='local'|'github'|'mcp'|'astrbot'|'marketplace';
const sections:{id:ToolsSection;label:string}[]=[
  {id:'local',label:'本地工具'},
  {id:'github',label:'GitHub'},
  {id:'mcp',label:'MCP 连接'},
  {id:'astrbot',label:'AstrBot'},
  {id:'marketplace',label:'插件市场'}
];

export function ToolsHub({initialSection='local',onOpenSkills}:{initialSection?:ToolsSection;onOpenSkills:()=>void}){
  const [section,setSection]=useState<ToolsSection>(initialSection);
  return <div className="strip-tools-hub">
    <div className="strip-tools-hub__categories" role="group" aria-label="工具与插件分类">
      {sections.map(item=><button key={item.id} type="button" aria-pressed={section===item.id} onClick={()=>setSection(item.id)}>{item.label}</button>)}
    </div>
    <div className="strip-tools-hub__content">
      {section==='local'&&<BuiltinPluginsTool/>}
      {section==='github'&&<GithubToolsTool onOpenSkills={onOpenSkills}/>}
      {section==='mcp'&&<IntegrationsTool/>}
      {section==='astrbot'&&<AstrBotTool/>}
      {section==='marketplace'&&<MarketplaceTool/>}
    </div>
  </div>;
}
