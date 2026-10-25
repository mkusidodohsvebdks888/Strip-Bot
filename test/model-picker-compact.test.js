const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'codex-ui/src/styles/model-picker-compact.css'),'utf8');
const switcher=fs.readFileSync(path.join(root,'codex-ui/src/components/ModelSwitcher/ModelSwitcher.tsx'),'utf8');
const hook=fs.readFileSync(path.join(root,'codex-ui/src/styles/useScrollSelectedIntoView.ts'),'utf8');

test('compact model picker limits the real inner scroll list to two rows',()=>{
  assert.ok(css.includes('--smp-visible: 2'));
  assert.ok(css.includes('.smp-popup.smp-model-menu .smp-simple-models'));
  assert.ok(css.includes('--smp-list-h: 108px'));
  assert.ok(css.includes('overflow-y: auto'));
  assert.ok(css.includes('scroll-snap-type: y proximity'));
  assert.ok(css.includes('mask-image: linear-gradient'));
  assert.ok(css.includes(':nth-of-type(3)'));
  assert.ok(css.includes('.smp-response-menu'));
});

test('selected model is scrolled after the asynchronous catalog renders',()=>{
  assert.ok(switcher.includes('useScrollSelectedIntoView'));
  assert.ok(switcher.includes("loading?'loading':catalog.models.map(item=>item.id).join('|')"));
  assert.ok(hook.includes("closest<HTMLElement>('.smp-simple-models')"));
  assert.ok(hook.includes('[aria-current="true"], [aria-selected="true"]'));
});
