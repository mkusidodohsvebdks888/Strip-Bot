'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {getAppearance}=require('../desktop-app/runtime/window-appearance.cjs');

test('native chrome remains neutral across all content appearance options',()=>{
  for(const appearance of ['warm','white','dark','mist','graphite']){
    assert.deepEqual(getAppearance(appearance),{color:'#eef2f6',symbolColor:'#52606d',backgroundColor:'#eef2f6',theme:'light'});
  }
});
test('titlebar appearance rejects unrecognized IPC data',()=>{
  for(const value of ['', 'blue', 'LIGHT', 'constructor', '__proto__', null, false, 42, {}, ['dark']]){
    assert.equal(getAppearance(value),null);
  }
});
