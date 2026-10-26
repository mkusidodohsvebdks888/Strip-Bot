'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {gitPreflight}=require('../modules/agent/safety/git-preflight.cjs');
test('git preflight reports clean and dirty worktrees without modifying them',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'stripbot-preflight-'));
  t.after(()=>fs.rm(cwd,{recursive:true,force:true}));
  const git=(...args)=>execFileSync('git',args,{cwd,stdio:'pipe'});
  git('init');git('config','user.name','Test');git('config','user.email','test@example.invalid');
  await fs.writeFile(path.join(cwd,'tracked.txt'),'first');
  git('add','tracked.txt');git('commit','-m','initial');
  const clean=await gitPreflight(cwd);
  assert.equal(clean.git,true);assert.equal(clean.dirty,false);assert.ok(clean.head);
  await fs.writeFile(path.join(cwd,'tracked.txt'),'second');
  await fs.writeFile(path.join(cwd,'new.txt'),'new');
  const dirty=await gitPreflight(cwd);
  assert.equal(dirty.dirty,true);assert.equal(dirty.modified,1);assert.equal(dirty.untracked,1);
  assert.notEqual(clean.statusFingerprint,dirty.statusFingerprint);
  assert.equal(await fs.readFile(path.join(cwd,'tracked.txt'),'utf8'),'second');
});
test('non-Git workspace is reported safely',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'stripbot-nongit-'));
  t.after(()=>fs.rm(cwd,{recursive:true,force:true}));
  assert.equal((await gitPreflight(cwd)).git,false);
});
