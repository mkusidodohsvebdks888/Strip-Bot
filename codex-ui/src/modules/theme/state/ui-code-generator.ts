import {parseOpenUITheme} from './generated-theme';

export type LayoutKind='codex'|'compact'|'focus';
export type GeneratedUI={filename:string;source:string;diff:string;summary:string};
const HEX=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
export function generateUI({instruction,layout,target,css}:{instruction:string;layout:LayoutKind;target:string;css:string}):GeneratedUI{
 if(!instruction.trim()||instruction.length>2000)throw new Error('设计需求长度必须为 1-2000 字符。');
 const palette=parseOpenUITheme(css);
 const names:Record<string,string>={'聊天工作区':'ChatWorkspace','设置页面':'SettingsPage','插件页面':'PluginPage','项目列表':'ProjectList'};
 const component=names[target];
 if(!component)throw new Error('不支持的页面类型。');
 const slug=component+'Preview';
 const sidebar=layout!=='focus';
 const cols=layout==='compact'?'160px 1fr':'230px 1fr';
 const colors=Object.fromEntries(Object.entries(palette).filter(([,v])=>HEX.test(v)));
 const source=`import React from 'react';

// Generated UI preview. Standalone component: does not replace existing app routes.
// Layout preview generated from a validated design request.
export default function ${slug}(){
  const palette=${JSON.stringify(colors,null,2)};
  const frame:React.CSSProperties={display:'grid',gridTemplateColumns:'${sidebar?cols:'1fr'}',minHeight:420,background:palette['--bg'],color:palette['--fg'],borderRadius:16,overflow:'hidden'};
  return <div style={frame}>
    ${sidebar?'<aside style={{padding:20,background:palette[\'--sidebar-bg\']||palette[\'--card-bg\']}}>StripBot<br/><br/>对话<br/>项目<br/>设置</aside>':''}
    <main style={{padding:24,display:'flex',flexDirection:'column',gap:18}}>
      <h2>${target} · ${layout==='focus'?'专注模式':layout==='compact'?'紧凑布局':'Codex 布局'}</h2>
      <section style={{padding:24,background:palette['--card-bg']||palette['--bg'],borderRadius:14,flex:1}}>
        <strong>Agent 工作区</strong><p>在此预览组件布局和主题效果。</p>
      </section>
      <div style={{border:'1px solid '+(palette['--accent']||'#888'),padding:16,borderRadius:14}}>输入任务…</div>
    </main>
  </div>;
}
`;
 return {filename:'codex-ui/src/generated-ui/'+slug+'.tsx',source,diff:source.split('\n').map(line=>'+'+line).join('\n'),summary:'生成独立 '+target+' 预览组件，不覆盖现有业务页面。'};
}
