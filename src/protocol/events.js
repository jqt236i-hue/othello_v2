// Minimal event schema and validator for Protocol v0
// Required fields: type, phase, targets, createdSeq, turnIndex, eventIndex

function validateEvent(evt) {
  if (!evt || typeof evt !== 'object') return { ok: false, reason: 'not-object' };
  const required = ['type', 'phase', 'createdSeq', 'turnIndex', 'eventIndex'];
  for (const k of required) {
    if (typeof evt[k] === 'undefined') return { ok: false, reason: `missing:${k}` };
  }
  // simple structural checks
  if (typeof evt.type !== 'string') return { ok: false, reason: 'type-not-string' };
  if (typeof evt.phase !== 'string') return { ok: false, reason: 'phase-not-string' };
  if (typeof evt.createdSeq !== 'number') return { ok: false, reason: 'createdSeq-not-number' };
  if (typeof evt.turnIndex !== 'number') return { ok: false, reason: 'turnIndex-not-number' };
  if (typeof evt.eventIndex !== 'number') return { ok: false, reason: 'eventIndex-not-number' };
  // optional: targets should be array if present
  if (evt.targets && !Array.isArray(evt.targets)) return { ok: false, reason: 'targets-not-array' };
  return { ok: true };
}

function makeEvent(template) {
  // Fill defaults for simple test usage
  return {
    type: template.type || 'unknown',
    phase: template.phase || 'action',
    targets: Array.isArray(template.targets) ? template.targets : [],
    after: template.after || null,
    createdSeq: typeof template.createdSeq === 'number' ? template.createdSeq : 0,
    turnIndex: typeof template.turnIndex === 'number' ? template.turnIndex : 0,
    eventIndex: typeof template.eventIndex === 'number' ? template.eventIndex : 0,
    batchKey: template.batchKey || null,
    meta: template.meta || null
  };
}

module.exports = { validateEvent, makeEvent };
