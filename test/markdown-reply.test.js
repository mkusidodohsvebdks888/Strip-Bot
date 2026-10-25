const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../codex-ui');
const requireUI=createRequire(path.join(root,'package.json'));
const ts=requireUI('typescript'),React=requireUI('react');
const {renderToStaticMarkup}=requireUI('react-dom/server');
function sourceURL(filename){
  if(filename.endsWith('.mjs'))return pathToFileURL(filename).href;
  const source=fs.readFileSync(filename,'utf8').replace(/^import ['"].*\.css['"];?\s*$/gm,'');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
    .replace(/from (["'])([^"']+)\1/g,(_,quote,id)=>{
      const url=id.startsWith('.')?sourceURL(id.endsWith('.mjs')?path.resolve(path.dirname(filename),id):path.resolve(path.dirname(filename),id+'.tsx').replace(/\.tsx$/,fs.existsSync(path.resolve(path.dirname(filename),id+'.tsx'))?'.tsx':'.ts')):pathToFileURL(requireUI.resolve(id)).href;
      return 'from '+JSON.stringify(url);
    });
  return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
const component=import(sourceURL(path.join(root,'src/components/MessageThread/MarkdownReply.tsx')));
async function render(text,props={}){
  const {MarkdownReply}=await component;
  return renderToStaticMarkup(React.createElement(MarkdownReply,{text,...props}));
}
test('assistant renders GFM lists, tables and highlighted fenced code',async()=>{
  const html=await render('# Heading\n\n**Bold** and `inline`\n\n- Item\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```js\nconst x = 1;\n```');
  for(const fragment of ['<h1>Heading</h1>','<strong>Bold</strong>','<li>Item</li>','<table>','strip-md-table-scroll','hljs-keyword','复制代码','复制完整回复'])assert.ok(html.includes(fragment),fragment);
});
test('unsafe links and raw HTML cannot become executable markup',async()=>{
  const html=await render('[unsafe](javascript:alert%281%29)\n\n<script>alert(1)</script>\n\n[safe](https://example.com)');
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});
test('streaming partial code renders with cursor and hides full-reply copy',async()=>{
  const html=await render('```unknown\npartial',{streaming:true});
  assert.ok(html.includes('partial'));
  assert.ok(html.includes('strip-md-cursor'));
  assert.ok(!html.includes('复制完整回复'));
});

test('cross-paragraph reference links and loose lists preserve full-document Markdown semantics',async()=>{
 const html=await render('[文档][ref]\n\n- first paragraph\n\n  second paragraph\n\n[ref]: https://example.com/docs');
 assert.ok(html.includes('href="https://example.com/docs"'));assert.equal((html.match(/<ul>/g)||[]).length,1);assert.ok(html.includes('second paragraph'));
});
test('empty streaming reply shows the themed thinking indicator',async()=>{
 const html=await render('',{streaming:true,thinkingLabel:'准备答案…'});
 assert.ok(html.includes('strip-thinking'));
 assert.ok(html.includes('准备答案…'));
 assert.ok(!html.includes('strip-md-cursor'));
});