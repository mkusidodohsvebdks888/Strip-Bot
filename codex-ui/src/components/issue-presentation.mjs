import {localizeStatusMessage} from './status-message.mjs';
/** Convert raw engine/provider failures to concise, user-readable local messages.
 * Always keep original diagnostics accessible. Never infer which provider is at fault.
 */
export function issueText(value) {
  let parsed=value;
  if(typeof value==='string') {
    try {parsed=JSON.parse(value);} catch {/* It is already a plain-text error. */}
  }
  if(parsed && typeof parsed==='object') {
    const message=parsed.message ?? parsed.error?.message ?? parsed.data?.message;
    if(typeof message==='string' && message.trim())return message.trim();
  }
  return typeof value==='string' ? value.trim():value==null?'':JSON.stringify(value);
}

export function presentIssue(value) {
  const source=issueText(value);
  const original=typeof value==='string'?value:JSON.stringify(value,null,2);
  const detail=((original==='{}' && source ? source:original) || source || '无详细信息').slice(0,24000);
  if(/^(?:step interrupted|execution interrupted|task interrupted)[.!]?$/i.test(source)) {
    return {title:'执行已中断',summary:'本轮执行提前结束。请查看之前失败的操作或错误详情。',detail,interrupted:true};
  }
  if(/expected json value|invalid json|failed to parse (?:json|response)|unexpected token.*json/i.test(source)) {
    return {title:'数据格式异常',summary:'执行器接收到的数据不符合预期的 JSON 结构。请核对模型与 API 协议配置。',detail,interrupted:false};
  }
  if(/\b(?:timeout|timed out|etimedout)\b/i.test(source)) {
    return {title:'请求超时',summary:'连接或模型响应超时，请检查网络并在确认执行状态后重试。',detail,interrupted:false};
  }
  if(/\b(?:401|403|unauthorized|forbidden)\b/i.test(source)) {
    return {title:'接口授权失败',summary:'请检查 API Key、服务商地址及账号权限。',detail,interrupted:false};
  }
  const clean=localizeStatusMessage(source).replace(/\s+/g,' ').trim();
  return {title:'请求失败',summary:clean.length>148?clean.slice(0,145)+'…':clean || '请求未完成，请查看技术详情。',detail,interrupted:false};
}

/** Prefer a specific failure to an interruption follow-on within the same turn. */
export function selectRelevantIssue(items) {
  const candidates=items.filter(item=>item && item.raw!==undefined && item.raw!==null && issueText(item.raw));
  for(let index=candidates.length-1;index>=0;index--) {
    if(!presentIssue(candidates[index].raw).interrupted)return candidates[index];
  }
  return candidates.at(-1);
}

/** Global notifications describe failed turns, not failures of individual tools inside a turn. */
export function selectTurnIssue(messages,conversationError) {
  const list=Array.isArray(messages)?messages:[];
  const lastUserIndex=list.map(message=>message?.type).lastIndexOf('user');
  const candidates=list.slice(lastUserIndex+1)
    .filter(message=>message?.error)
    .map(message=>({id:message.id||'assistant',raw:message.error}));
  if(conversationError)candidates.push({id:'conversation',raw:conversationError});
  return selectRelevantIssue(candidates);
}
