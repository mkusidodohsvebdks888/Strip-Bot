'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const catalog=require('../modules/catalog.json');
test('old and new module entrypoints resolve to the same exports',()=>{
  assert.ok(catalog.modules.length>=19);
  for(const item of catalog.migrations){
    const old=path.join(root,item.from),newFile=path.join(root,item.to);
    assert.ok(fs.statSync(old).isFile(),'Missing old entry: '+item.from);
    assert.ok(fs.statSync(newFile).isFile(),'Missing module: '+item.to);
    assert.strictEqual(require(old),require(newFile),item.from+' differs');
  }
});
test('manifest dependency references and entrypoints are valid',()=>{
  const ids=new Set(catalog.modules.map(x=>x.id));
  for(const m of catalog.modules){
    const meta=JSON.parse(fs.readFileSync(path.join(root,'modules',m.id,'module.json'),'utf8'));
    assert.equal(meta.id,m.id);
    assert.ok(m.files.every(file=>fs.existsSync(path.join(root,file))),m.id);
    assert.ok(m.dependsOn.every(dep=>ids.has(dep)),m.id+' unknown dependency');
  }
});
