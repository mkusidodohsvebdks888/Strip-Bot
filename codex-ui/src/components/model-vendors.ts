// Vendor labels describe model ownership; connection modes describe how requests are routed.
export const modelVendors=[{id:'openai',name:'OpenAI'},{id:'anthropic',name:'Anthropic'},{id:'google',name:'Google'},{id:'deepseek',name:'DeepSeek'},{id:'qwen',name:'通义千问 Qwen'},{id:'moonshot',name:'月之暗面 Moonshot'},{id:'zhipu',name:'智谱 GLM'},{id:'custom',name:'其他 / 自定义'}];
export function modelVendor(model:string){
  const id=model.toLowerCase().replace(/^.*\//,'');
  if(/^(gpt-|o[134](?:-|$)|chatgpt|codex)/.test(id))return 'openai';
  if(id.startsWith('claude'))return 'anthropic';
  if(id.startsWith('gemini'))return 'google';
  if(id.startsWith('deepseek'))return 'deepseek';
  if(id.startsWith('qwen') || id.startsWith('qwq'))return 'qwen';
  if(/^(moonshot|kimi)/.test(id))return 'moonshot';
  if(id.startsWith('glm'))return 'zhipu';
  return 'custom';
}
