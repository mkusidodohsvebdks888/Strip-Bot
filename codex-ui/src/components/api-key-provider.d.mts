export type ApiKeyDetection = {kind:'empty'|'recognized'|'suggested'|'ambiguous'|'unknown';providerId:string};
export function detectApiKeyProvider(value:unknown):ApiKeyDetection;
export function resolveKeyProvider(key:string, manuallySelected?:string):string;
