export interface ProtocolEvent {
  type: string;
  phase: string;
  targets: unknown[];
  after: unknown | null;
  createdSeq: number;
  turnIndex: number;
  eventIndex: number;
  batchKey: unknown | null;
  meta: unknown | null;
  [key: string]: unknown;
}

export type EventValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type EventTemplate = Partial<ProtocolEvent> & Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Minimal event schema and validator for Protocol v0.
export function validateEvent(evt: unknown): EventValidationResult {
  if (!isObject(evt)) return { ok: false, reason: 'not-object' };

  const required = ['type', 'phase', 'createdSeq', 'turnIndex', 'eventIndex'] as const;
  for (const key of required) {
    if (typeof evt[key] === 'undefined') return { ok: false, reason: `missing:${key}` };
  }

  if (typeof evt.type !== 'string') return { ok: false, reason: 'type-not-string' };
  if (typeof evt.phase !== 'string') return { ok: false, reason: 'phase-not-string' };
  if (typeof evt.createdSeq !== 'number') return { ok: false, reason: 'createdSeq-not-number' };
  if (typeof evt.turnIndex !== 'number') return { ok: false, reason: 'turnIndex-not-number' };
  if (typeof evt.eventIndex !== 'number') return { ok: false, reason: 'eventIndex-not-number' };
  if (evt.targets && !Array.isArray(evt.targets)) return { ok: false, reason: 'targets-not-array' };

  return { ok: true };
}

export function makeEvent(template: EventTemplate): ProtocolEvent {
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
