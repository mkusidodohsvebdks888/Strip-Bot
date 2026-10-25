'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {getAppearance}=require('../desktop-app/runtime/window-appearance.cjs');

test('native titlebar starts warm and follows all UI appearance options',()=>{
  assert.deepEqual(getAppearance('warm'),{color:'#faf9f6',symbolColor:'#4a4139',backgroundColor:'#faf9f6',theme:'light'});
  assert.deepEqual(getAppearance('white'),{color:'#ffffff',symbolColor:'#3f3b36',backgroundColor:'#ffffff',theme:'light'});
  assert.deepEqual(getAppearance('dark'),{color:'#211f1d',symbolColor:'#f2ece4',backgroundColor:'#211f1d',theme:'dark'});
  assert.deepEqual(getAppearance('mist'),{color:'#f2f6fa',symbolColor:'#344353',backgroundColor:'#f2f6fa',theme:'light'});
  assert.deepEqual(getAppearance('graphite'),{color:'#22262b',symbolColor:'#f0f0f1',backgroundColor:'#22262b',theme:'dark'});
});
test('titlebar appearance rejects unrecognized IPC data',()=>{
  for(const value of ['', 'blue', 'LIGHT', 'constructor', '__proto__', null, false, 42, {}, ['dark']]){
    assert.equal(getAppearance(value),null);
  }
});
