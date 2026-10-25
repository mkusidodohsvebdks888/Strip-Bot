'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require('../codex-ui/node_modules/typescript');
function harness(saved=null,legacy=null,blocked=false){
 let state,stored=saved;const attrs={},style={},native=[];
 const storage={getItem(k){if(blocked)throw Error('blocked');return k==='strip_appearance_v1'?stored:legacy;},setItem(k,v){if(blocked)throw Error('blocked');assert.equal(k,'strip_appearance_v1');stored=v;}};
 const hooks={useState(init){if(state===undefined)state=typeof init==='function'?init():init;return [state,next=>{state=typeof next==='function'?next(state):next;}];},useLayoutEffect(fn){fn();}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../codex-ui/src/state/useAppearance.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports','localStorage','document','window',code)(()=>hooks,mod,mod.exports,storage,{documentElement:{dataset:attrs,style}},{stripWindowAppearance:{sync:v=>native.push(v)}});
 return {render:()=>mod.exports.useAppearance(),saved:()=>stored,attrs,style,native,choices:mod.exports.THEME_CHOICES};
}
test('all five themes apply immediately, synchronize native chrome and survive reload',()=>{
 const h=harness();assert.equal(h.choices.length,5);
 for(const choice of h.choices){
  h.render().setAppearance(choice.id);assert.equal(h.render().appearance,choice.id);
  assert.equal(h.saved(),choice.id);assert.equal(h.attrs.stripPalette,choice.id);
  const dark=choice.id==='dark'||choice.id==='graphite';
  assert.equal(h.attrs.stripTheme,dark?'dark':'light');assert.equal(h.style.colorScheme,dark?'dark':'light');
  assert.equal(h.native.at(-1),choice.id);assert.equal(harness(h.saved()).render().appearance,choice.id);
 }
});
test('theme migration retains current preferences ahead of legacy theme settings',()=>{
 for(const current of ['warm','white','dark'])assert.equal(harness(current,'graphite').render().appearance,current);
 for(const [legacy,expected] of [['light','white'],['ivory','warm'],['mist','mist'],['graphite','graphite']])assert.equal(harness(null,legacy).render().appearance,expected);
 assert.equal(harness('invalid').render().appearance,'warm');
});
test('blocked preference storage still permits in-memory theme changes',()=>{
 const h=harness(null,null,true);assert.equal(h.render().appearance,'warm');h.render().setAppearance('graphite');assert.equal(h.render().appearance,'graphite');assert.equal(h.attrs.stripTheme,'dark');
});
