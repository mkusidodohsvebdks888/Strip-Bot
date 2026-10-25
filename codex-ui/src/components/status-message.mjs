// Translate known UI status messages only; preserve unknown upstream diagnostics.
const translations=new Map([
 ['step interrupted','执行步骤已中断。'],
 ['failed to fetch','连接失败，请检查网络或服务是否运行。'],
 ['fetch failed','连接失败，请检查网络或服务是否运行。'],
 ['network error','网络连接异常，请稍后重试。'],
 ['request failed','请求失败，请稍后重试。'],
 ['request timed out','请求超时，请稍后重试。'],
 ['request timeout','请求超时，请稍后重试。'],
 ['the operation was aborted.','操作已取消。'],
 ['the operation was aborted','操作已取消。'],
 ['the usage limit has been reached','使用额度已用尽，请检查账户额度。'],
 ['unauthorized','认证失败，请检查连接配置。']
]);
export function localizeStatusMessage(value){return translations.get(value.trim().toLowerCase()) || value;}
