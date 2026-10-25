'use strict';
// OpenCode /api/event uses data-only SSE frames. Keep partial UTF-8/frames across
// network reads; no raw events or credentials are persisted or exposed to the UI.
async function readEvents(body,onEvent){
  const decoder=new TextDecoder();let buffer='';
  for await(const chunk of body){
    buffer+=decoder.decode(chunk,{stream:true});
    if(buffer.length>2_000_000)throw new Error('OpenCode event frame exceeded limit');
    let match;
    while((match=/\r?\n\r?\n/.exec(buffer))){
      const frame=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);
      const data=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');
      if(!data)continue;
      let event;try{event=JSON.parse(data);}catch{throw new Error('Malformed OpenCode event');}
      onEvent(event);
    }
  }
}
module.exports={readEvents};
