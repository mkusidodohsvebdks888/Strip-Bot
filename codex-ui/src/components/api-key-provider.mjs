/**
 * Key-prefix heuristics only. This is NOT authentication and never contacts a provider.
 * A generic sk- key is intentionally not associated with any single company.
 */
export function detectApiKeyProvider(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!key) return {kind:'empty',providerId:''};
  if (/^sk-or-v1-[A-Za-z0-9_-]+$/.test(key)) return {kind:'recognized',providerId:'openrouter'};
  if (/^sk-proj-[A-Za-z0-9_-]+$/.test(key)) return {kind:'recognized',providerId:'openai'};
  if (/^gsk_[A-Za-z0-9_-]+$/.test(key)) return {kind:'recognized',providerId:'groq'};
  // AIza is used for many Google APIs, not only Gemini: explicit confirmation required.
  if (/^AIza[A-Za-z0-9_-]+$/.test(key)) return {kind:'suggested',providerId:'google'};
  // Many unrelated providers share the sk- prefix (including DeepSeek and DashScope).
  if (/^sk-[A-Za-z0-9_-]+$/.test(key)) return {kind:'ambiguous',providerId:''};
  return {kind:'unknown',providerId:''};
}

/** Only an identifiable prefix is routed automatically; all other keys need a choice. */
export function resolveKeyProvider(key, manuallySelected = '') {
  if (manuallySelected) return manuallySelected;
  const result = detectApiKeyProvider(key);
  return result.kind === 'recognized' ? result.providerId : '';
}
