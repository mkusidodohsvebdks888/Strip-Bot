// Only native OpenCode catalog entries advertise speed aliases in this app.
// A matching-looking model ID on an arbitrary proxy is not a capability claim.
export const processingModes = ['standard','fast','ultrafast'];
export function processingMode(id) {
  return id.endsWith('-ultrafast') ? 'ultrafast' : id.endsWith('-fast') ? 'fast' : 'standard';
}
export function speedChoices(models, id, route) {
  const base = id.replace(/-(ultrafast|fast)$/, '');
  return processingModes.map(mode => {
    const target = mode === 'standard' ? base : `${base}-${mode}`;
    return models.find(item => item.id === target && item.routes.some(entry => entry.id === route && entry.configured)
      && (route === 'opencode' || item.id === id)) || null;
  });
}
