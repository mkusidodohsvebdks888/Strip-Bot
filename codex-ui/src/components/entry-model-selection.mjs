/** Choose an API-visible chat model without guessing an ID not provided by the service. */
export function pickEntryModel(models, preferred = '', fallback = '') {
  if (!Array.isArray(models) || models.length === 0) return '';
  const candidates = models.filter(item => item && typeof item.id === 'string' && item.id);
  if (!candidates.length) return '';
  const exact = [preferred, fallback].find(id => id && candidates.some(item => item.id === id));
  if (exact) return exact;
  const textModels = candidates.filter(item => !/(embed|rerank|whisper|tts|audio|speech|transcri|moderation|image|vision-only|dall-e|realtime)/i.test(item.id));
  return (textModels[0] || candidates[0]).id;
}
