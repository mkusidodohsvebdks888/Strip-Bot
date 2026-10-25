const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ui=path.join(root,'codex-ui');
const component=fs.readFileSync(path.join(ui,'src/components/Brand/AlphaEye.tsx'),'utf8');
const home=fs.readFileSync(path.join(ui,'src/components/EmptyState/HomeWelcome.tsx'),'utf8');
const rail=fs.readFileSync(path.join(ui,'src/components/Sidebar/ToolWorkspace.tsx'),'utf8');
const login=fs.readFileSync(path.join(ui,'src/components/ApiEntry.tsx'),'utf8');
const css=fs.readFileSync(path.join(ui,'src/components/Brand/AlphaEye.css'),'utf8');

test('Alpha eye keeps the verified source geometry and interaction parameters',()=>{
  for(const token of ['CX=393','CY=400','MAX_X=14','MAX_Y=18','PUPIL_EASE=.14','HOVER_LID=.45','requestAnimationFrame','pointermove','prefers-reduced-motion'])assert.ok(component.includes(token),token);
  assert.ok(component.includes('alpha-eye__overlay'));
  assert.ok(component.includes('const tickers=new Set<Tick>()'));
  assert.ok(component.includes('root.getBoundingClientRect()'));
  assert.ok(component.includes('lidTarget=hovered?HOVER_LID:0'));
  assert.ok(component.includes('new IntersectionObserver'));
  assert.ok(component.includes('reducedMQ?.addEventListener'));
  assert.ok(component.includes('startLoops();'));
});

test('Alpha eye CSS locks square cover geometry and project sizes',()=>{
  assert.ok(css.includes('aspect-ratio:1/1'));
  assert.ok(css.includes('contain:layout paint'));
  assert.ok(css.includes('object-fit:cover'));
  assert.ok(css.includes('width:38px'));
  assert.ok(css.includes('width:26px'));
});

test('all brand render points use the interactive component',()=>{
  assert.ok(home.includes('<AlphaEye'));
  assert.ok(rail.includes('<AlphaEye'));
  assert.ok(login.includes('<AlphaEye'));
  assert.ok(!rail.includes('src="/brand-logo.png"'));
  assert.ok(!login.includes('src="/login-brand.jpg"'));
  assert.equal((rail.match(/<button\b/g)||[]).length,(rail.match(/<\/button>/g)||[]).length);
});

test('published PNG and multi-size ICO assets are valid',()=>{
  const publicDir=path.join(root,'public');
  const png=fs.readFileSync(path.join(publicDir,'brand-logo.png'));
  assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),1024);
  assert.equal(png.readUInt32BE(20),1024);
  const ico=fs.readFileSync(path.join(publicDir,'strip-bot.ico'));
  assert.equal(ico.readUInt16LE(0),0);
  assert.equal(ico.readUInt16LE(2),1);
  assert.equal(ico.readUInt16LE(4),7);
  assert.ok(fs.statSync(path.join(publicDir,'login-brand.jpg')).size>1000);
});

