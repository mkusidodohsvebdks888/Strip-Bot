// Based on the supplied MotionDirector, with replay and cross-fade cleanup.
export class MotionDirector{
 constructor(THREE,root,clips){this.THREE=THREE;this.mixer=new THREE.AnimationMixer(root);this.actions=new Map(clips.map(c=>[c.name,this.mixer.clipAction(c)]));this.current=null;this.retired=[];this.clock=0;this.name='idle';this.onFinish=()=>{};this.mixer.addEventListener('finished',e=>{if(e.action===this.current)this.onFinish(this.name)})}
 play(name,{loop=false,hold=false,speed=1}={}){
  const next=this.actions.get(name);if(!next)return false;
  const previous=this.current;
  this.retired=this.retired.filter(item=>item.action!==next);
  next.stopFading();next.reset();next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(speed);next.setLoop(loop?this.THREE.LoopRepeat:this.THREE.LoopOnce,loop?Infinity:1);next.clampWhenFinished=hold;next.play();
  if(previous&&previous!==next){previous.fadeOut(.08);next.fadeIn(.08);this.retired=this.retired.filter(item=>item.action!==previous);this.retired.push({action:previous,until:this.clock+.1})}
  this.current=next;this.name=name;return true;
 }
 update(dt){this.clock+=dt;this.mixer.update(dt);this.retired=this.retired.filter(x=>{if(x.until<=this.clock){if(x.action!==this.current)x.action.stop();return false}return true})}
 dispose(){this.mixer.stopAllAction();this.actions.clear();this.retired=[]}
}
