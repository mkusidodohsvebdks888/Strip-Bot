'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.join(__dirname,'..','plugins','nono-desktop');
async function fixture(){
 const THREE=await import('file:///'+path.join(root,'three','three.module.js').replaceAll('\\','/'));
 const source=await fs.readFile(path.join(root,'motion-controller.js'),'utf8');
 const {MotionDirector}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const object=new THREE.Object3D();object.name='pet';
 const clip=name=>new THREE.AnimationClip(name,1,[new THREE.NumberKeyframeTrack('.position[x]',[0,1],[0,1])]);
 return {director:new MotionDirector(THREE,object,['idle','wave','dance'].map(clip)),THREE};
}
test('rapid action switching retires old actions and replay resets loop/hold state',async()=>{
 const {director,THREE}=await fixture();director.play('idle',{loop:true,hold:true});director.update(.1);director.play('wave');director.update(.05);director.play('idle');
 assert.equal(director.current.loop,THREE.LoopOnce);assert.equal(director.current.clampWhenFinished,false);
 for(let i=0;i<30;i++){director.play(i%2?'wave':'dance');director.update(.01);}
 director.update(.25);assert.equal(director.retired.length,0);assert.equal([...director.actions.values()].filter(action=>action.isRunning()).length,1);
 assert.equal(director.play('absent'),false);director.dispose();assert.equal(director.actions.size,0);
});
test('supplied GLB contains all 14 action clips with finite keyframes and no external buffers',async()=>{
 const buffer=await fs.readFile(path.join(root,'nono_actions.glb'));assert.equal(buffer.toString('ascii',0,4),'glTF');assert.equal(buffer.readUInt32LE(8),buffer.length);
 const size=buffer.readUInt32LE(12),gltf=JSON.parse(buffer.subarray(20,20+size).toString('utf8'));const actions=JSON.parse(await fs.readFile(path.join(root,'actions.json'),'utf8'));
 assert.deepEqual(gltf.animations.map(clip=>clip.name).sort(),Object.keys(actions).sort());assert.equal(gltf.animations.length,14);assert.ok(gltf.buffers.every(buffer=>!buffer.uri));
 const binStart=20+size+8;
 for(const animation of gltf.animations)for(const sampler of animation.samplers)for(const index of [sampler.input,sampler.output]){
   const accessor=gltf.accessors[index],view=gltf.bufferViews[accessor.bufferView];assert.equal(accessor.componentType,5126);
   const dimensions={SCALAR:1,VEC3:3,VEC4:4}[accessor.type];assert.ok(dimensions);
   const offset=binStart+(view.byteOffset||0)+(accessor.byteOffset||0),count=accessor.count*dimensions;
   assert.ok(offset+count*4<=buffer.length);for(let n=0;n<count;n++)assert.ok(Number.isFinite(buffer.readFloatLE(offset+n*4)));
 }
});

test('an interaction takes full animation weight within 80ms',async()=>{
 const {director}=await fixture();director.play('idle',{loop:true});director.update(.1);director.play('wave');director.update(.08);assert.ok(director.current.getEffectiveWeight()>=.99,'interactive action still fading in');director.dispose();
});
