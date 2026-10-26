'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const src = path => readFileSync(join(__dirname,'..',path),'utf8');

test('API avatar is a local real DiceBear Bottts SVG with attribution',()=>{
  const svg=src('codex-ui/public/avatars/dicebear-bottts-api.svg');
  const attribution=src('codex-ui/public/avatars/README.md');
  assert.match(svg,/<svg\b[^>]*viewBox="0 0 180 180"/);
  assert.match(svg,/<path\b/);
  assert.match(svg,/Bottts style artwork by Pablo Stanley/);
  assert.match(attribution,/dicebear\/styles/);
  assert.match(attribution,/Free for personal and commercial use/);
  assert.doesNotMatch(svg,/<script\b|<foreignObject\b|onload\s*=|https?:[^"']+\.(?:png|svg)/i);
  const ids=[...svg.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size,'SVG element IDs must be unique');
  for(const ref of svg.matchAll(/url\(#([^)]+)\)/g)){
    assert.ok(ids.includes(ref[1]),'SVG mask/filter id missing: '+ref[1]);
  }
});

test('API Key avatar is swapped in both toolbar and account popup only',()=>{
  const view=src('codex-ui/src/components/Sidebar/ApiAccountMenu.tsx');
  assert.match(view,/const API_AVATAR_SRC='\/avatars\/dicebear-bottts-api.svg'/);
  assert.match(view,/mode==='direct'\?<img src=\{API_AVATAR_SRC\}/);
  assert.match(view,/mode==='ccswitch'\?'CC':'AI'/);
  assert.match(view,/<Icon name="user"\/>/);
  assert.match(view,/aria-label="账户与授权"/);
});

test('local avatar does not require an external API or add dependencies',()=>{
  const css=src('codex-ui/src/styles/account-popover.css');
  const view=src('codex-ui/src/components/Sidebar/ApiAccountMenu.tsx');
  const pkg=JSON.parse(src('codex-ui/package.json'));
  assert.match(css,/strip-account-avatar--dicebear img/);
  assert.match(css,/strip-account-profile__avatar--dicebear img/);
  assert.doesNotMatch(view,/api\.dicebear\.com/);
  assert.equal(pkg.dependencies['@dicebear/core'],undefined);
  assert.equal(pkg.dependencies['@dicebear/styles'],undefined);
});
