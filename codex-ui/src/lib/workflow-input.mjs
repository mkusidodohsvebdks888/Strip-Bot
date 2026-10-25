// Shared with Node tests; these are safety ceilings, not a model's context window.
export const MAX_PROMPT_CHARS = 240000;
export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_FILE_COUNT = 12;
export function estimateTokens(value) {
  // Approximation for display only. Actual tokenizer and context window depend on the model.
  const ascii = (value.match(/[\x00-\x7F]/g) || []).length;
  return Math.ceil(ascii / 4 + (value.length - ascii) * 1.4);
}
export function formatBytes(size) {return size < 1024 ? size + ' B' : size < 1024*1024 ? (size/1024).toFixed(1) + ' KB' : (size/(1024*1024)).toFixed(1) + ' MB';}
export function validateFiles(files) {
  if (files.length > MAX_FILE_COUNT) throw new Error(`每次最多附加 ${MAX_FILE_COUNT} 个文本或代码文件。`);
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new Error(`附件 ${file.name} 超过 512 KB，请只选择相关片段。`);
  }
}
export async function mergePrompt(text,files,previousConversation='') {
  validateFiles(files);
  let prompt=text.trim() || '请阅读并分析以下附件。';
  for (const file of files) {
    // Binary files are intentionally unsupported by the text-only OpenCode prompt route.
    const raw=await file.arrayBuffer();
    const bytes=new Uint8Array(raw);
    if(bytes.some(byte=>byte===0))throw new Error(`附件 ${file.name} 是二进制或 UTF-16 文件，请转成 UTF-8 文本。`);
    let contents;
    try {contents=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
    catch {throw new Error(`附件 ${file.name} 不是 UTF-8 文本，请转换编码后重试。`);}
    const name=file.name.replace(/[\r\n<>"\\]/g,'_').slice(0,180);
    prompt+=`\n\n--- 附件开始: ${name} ---\n${contents}\n--- 附件结束: ${name} ---`;
    if(prompt.length>MAX_PROMPT_CHARS)throw new Error(`输入与附件合计不能超过 ${MAX_PROMPT_CHARS.toLocaleString()} 字符；模型本身的上下文上限仍以供应商为准。`);
  }
  if(previousConversation)prompt=`以下是此前对话的文本记录，作为背景信息：\n<previous_conversation>\n${previousConversation}\n</previous_conversation>\n\n现在用户的请求：\n${prompt}`;
  if(prompt.length>MAX_PROMPT_CHARS)throw new Error(`输入与附件合计不能超过 ${MAX_PROMPT_CHARS.toLocaleString()} 字符。`);
  return prompt;
}
