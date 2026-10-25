// Display-only token estimates, independent of provider generation speed.
const HAN=/\p{Script=Han}/u,PAUSE=/[。！？；!?;\n]/;
export function displayCost(character){return HAN.test(character)?1:PAUSE.test(character)?2.5:.25;}
export class DisplayPacer{
  constructor(text='',rate=null,animate=false){this.target=text;this.visible=animate?'':text;this.rate=rate;this.credit=0;}
  get done(){return this.visible===this.target;}
  setTarget(text){if(text===this.target)return;if(!text.startsWith(this.visible)){this.visible=text;this.credit=0;}this.target=text;}
  setRate(rate){this.rate=rate;if(rate===null)this.finish();}
  reset(text){this.visible=this.target=text;this.credit=0;}
  finish(){this.visible=this.target;this.credit=0;return this.visible;}
  tick(seconds){
    if(this.rate===null || this.done)return this.finish();
    if(!Number.isFinite(this.rate) || this.rate<=0)return this.visible;
    // Cap catch-up at 4x so a background-tab delay never flushes a large reply.
    const boost=Math.min(4,Math.max(1,(this.target.length-this.visible.length)/(this.rate*2)));
    this.credit+=this.rate*boost*Math.max(0,Math.min(.1,seconds));
    let i=this.visible.length;
    while(i<this.target.length){const cp=this.target.codePointAt(i),cost=displayCost(String.fromCodePoint(cp));if(this.credit<cost)break;this.credit-=cost;i+=cp>0xffff?2:1;}
    this.visible=this.target.slice(0,i);return this.visible;
  }
}
