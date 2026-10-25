import {Children, isValidElement, memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ReactElement, ReactNode} from 'react';
import Markdown from 'react-markdown';
import type {Components} from 'react-markdown';
import type {PluggableList} from 'unified';
import {copyToClipboard} from './copy-text.mjs';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import './MarkdownReply.css';
import {Icon} from '../../Icons';
import {ThinkingIndicator} from './ThinkingIndicator';

type CodeElementProps = {className?: string; children?: ReactNode};

// Extract code from the React tree rather than copying highlighted HTML.
function plainText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plainText).join('');
  if (isValidElement<{children?: ReactNode}>(node)) return plainText(node.props.children);
  return '';
}

function downloadText(filename:string,text:string,type='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),2500);
}
async function copyText(value: string, onSuccess: () => void, onError?: (message: string) => void) {
  try {
    await copyToClipboard(value);
    onSuccess();
  } catch {
    // The page may be opened outside a secure context; do not display a false success.
    onError?.('复制失败。请在本地 localhost 地址打开 Strip Bot，或手动选择文字复制。');
  }
}

function useCopied():[boolean,()=>void]{
  const [copied,setCopied]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>>(),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;clearTimeout(timer.current);};},[]);
  const mark=useCallback(()=>{if(!alive.current)return;setCopied(true);clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),1600);},[]);
  return [copied,mark];
}

function CodeFrame({children, onError}: {children?: ReactNode; onError?: (message: string) => void}) {
  const [copied, markCopied] = useCopied();
  const codeElement = Children.toArray(children).find(isValidElement) as ReactElement<CodeElementProps> | undefined;
  const code = plainText(codeElement?.props.children ?? children).replace(/\n$/, '');
  const language = /(?:^|\s)language-([\w+.#-]+)/.exec(codeElement?.props.className || '')?.[1] || 'text';

  return (
    <div className="strip-md-code">
      <div className="strip-md-code__toolbar">
        <span className="strip-md-code__language">{language}</span>
        <button
          className={'strip-md-code__copy' + (copied ? ' strip-copy-done' : '')}
          type="button"
          aria-label={copied ? "已复制代码" : "复制代码"}
          title={copied ? "已复制" : "复制代码"}
          onClick={() => void copyText(code, markCopied, onError)}
        >
          <Icon name={copied ? "check" : "copy"}/>
        </button>
        <button className="strip-md-code__copy" type="button" aria-label="导出代码文件" title="导出代码" onClick={()=>downloadText(`strip-output.${language==='text'?'txt':language.replace(/[^a-z0-9+-]/gi,'').slice(0,12)}`,code)}>↓</button>
      </div>
      <pre className="strip-md-code__pre">{children}</pre>
    </div>
  );
}

function safeLink(href?: string) {
  // Never let model-generated markdown navigate to javascript:, data:, or file: URLs.
  return href && /^(https?:\/\/|mailto:)/i.test(href) ? href : undefined;
}

const plugins = [remarkGfm];
const highlightPlugins:PluggableList=[[rehypeHighlight,{detect:false,ignoreMissing:true}]];
const MarkdownBody=memo(function MarkdownBody({text,components}:{text:string;components:Components}){
  return <Markdown remarkPlugins={plugins} rehypePlugins={highlightPlugins} components={components}>{text}</Markdown>;
});

export function MarkdownReply({text, copySource, streaming = false, thinkingLabel, onError}: {
  text: string;
  copySource?: string;
  streaming?: boolean;
  thinkingLabel?: string;
  onError?: (message: string) => void;
}) {
  const [copied, markCopied] = useCopied();
  const source = copySource ?? text;
  const errorRef=useRef(onError);errorRef.current=onError;
  const reportError=useCallback((message:string)=>errorRef.current?.(message),[]);
  const components=useMemo<Components>(()=>({
    pre:({children})=><CodeFrame onError={reportError}>{children}</CodeFrame>,
    table:({children})=><div className="strip-md-table-scroll"><table>{children}</table></div>,
    a:({href,children})=>{const url=safeLink(href);return url?<a href={url} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>;},
  }),[reportError]);

  if (streaming && !text.trim()) {
    return (
      <div className="strip-md-answer" aria-busy="true">
        <ThinkingIndicator label={thinkingLabel} />
      </div>
    );
  }

  return (
    <div className="strip-md-answer" aria-busy={streaming}>
      <div className={streaming ? "strip-markdown strip-markdown--streaming" : "strip-markdown"}>
        <MarkdownBody text={text} components={components}/>
        {streaming ? <span className="strip-md-cursor" aria-hidden="true" /> : null}
      </div>
      {!streaming && source.trim() ? (
        <div className="strip-md-answer__actions">
          <button
            type="button"
            className={'strip-md-answer__copy' + (copied ? ' strip-copy-done' : '')}
            aria-label={copied ? "已复制回复" : "复制完整回复"}
            title={copied ? "已复制" : "复制完整回复"}
            onClick={() => void copyText(source, markCopied, onError)}
          >
            <Icon name={copied ? "check" : "copy"}/>
          </button>
          <button type="button" className="strip-md-answer__copy" title="导出 Markdown 回复" aria-label="导出 Markdown 回复" onClick={()=>downloadText("strip-bot-reply.md",source,"text/markdown;charset=utf-8")}>↓ .md</button>
        </div>
      ) : null}
    </div>
  );
}
