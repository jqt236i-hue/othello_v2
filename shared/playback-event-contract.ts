'use strict';

const BOARD_TARGET_EVENT_TYPES = new Set([
  'flip',
  'destroy',
  'move',
  'spawn',
  'status_applied',
  'status_removed',
  'manifest_ending',
  'status_change',
  'place_hand_animation'
]);

const STATUS_TARGET_EVENT_TYPES = new Set([
  'status_applied',
  'status_removed',
  'manifest_ending',
  'status_change'
]);

const STATUS_SUBJECT_KINDS = new Set([
  'stone_body',
  'stone_status',
  'cell_marker',
  'topology',
  'placement_effect'
]);

const STATUS_STONE_MUTATIONS = new Set([
  'preserve',
  'replace',
  'remove',
  'timer-only'
]);

const REQUIRED_EXPLICIT_CELL_MARKER_TYPES = new Set([
  'POISON_CELL',
  'SCORCHED_CELL',
  'HEALING_CELL'
]);

const STATUS_MUTATIONS_BY_SUBJECT: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  stone_body: new Set(['preserve', 'replace', 'remove']),
  stone_status: new Set(['preserve', 'replace', 'timer-only']),
  cell_marker: new Set(['preserve']),
  topology: new Set(['replace', 'remove']),
  placement_effect: new Set(['preserve', 'replace'])
});

function hasFiniteCoordinate(value: any): boolean {
  return Number.isFinite(Number(value));
}

function normalizeOwner(value: any): string {
  if (value === 'black' || value === 1 || value === '1' || value === '+1') return 'black';
  if (value === 'white' || value === -1 || value === '-1') return 'white';
  return '';
}

function hasCoordinatePair(value: any): boolean {
  const source = value && typeof value === 'object' ? value : {};
  const row = source.r ?? source.row;
  const col = source.col ?? source.c;
  return hasFiniteCoordinate(row) && hasFiniteCoordinate(col);
}

function statusValue(target: any, event: any, key: string): string {
  const targetMeta = target && target.meta && typeof target.meta === 'object' ? target.meta : {};
  const eventMeta = event && event.meta && typeof event.meta === 'object' ? event.meta : {};
  return String(target && target[key] || targetMeta[key] || eventMeta[key] || '').trim().toLowerCase();
}

function statusSpecial(target: any, event: any): string {
  const targetMeta = target && target.meta && typeof target.meta === 'object' ? target.meta : {};
  const eventMeta = event && event.meta && typeof event.meta === 'object' ? event.meta : {};
  return String(
    targetMeta.special
    || eventMeta.special
    || target && target.after && target.after.special
    || ''
  ).trim().toUpperCase();
}

function validateStatusTarget(
  event: any,
  target: any,
  eventIndex: number,
  targetIndex: number,
  type: string,
  errors: any[]
): void {
  const subjectKind = statusValue(target, event, 'subjectKind');
  const stoneMutation = statusValue(target, event, 'stoneMutation');
  const special = statusSpecial(target, event);
  const requiresExplicitTraits = REQUIRED_EXPLICIT_CELL_MARKER_TYPES.has(special);

  if (requiresExplicitTraits && !subjectKind) {
    errors.push({ code: 'target_status_subject_kind_required', eventIndex, targetIndex, type, special });
  } else if (subjectKind && !STATUS_SUBJECT_KINDS.has(subjectKind)) {
    errors.push({ code: 'target_status_subject_kind_invalid', eventIndex, targetIndex, type, special });
  }
  if (requiresExplicitTraits && !stoneMutation) {
    errors.push({ code: 'target_status_stone_mutation_required', eventIndex, targetIndex, type, special });
  } else if (stoneMutation && !STATUS_STONE_MUTATIONS.has(stoneMutation)) {
    errors.push({ code: 'target_status_stone_mutation_invalid', eventIndex, targetIndex, type, special });
  }

  if (subjectKind === 'cell_marker' && stoneMutation && stoneMutation !== 'preserve') {
    errors.push({ code: 'target_status_cell_marker_must_preserve_stone', eventIndex, targetIndex, type, special });
  }
  if (
    STATUS_SUBJECT_KINDS.has(subjectKind)
    && STATUS_STONE_MUTATIONS.has(stoneMutation)
    && !STATUS_MUTATIONS_BY_SUBJECT[subjectKind].has(stoneMutation)
  ) {
    errors.push({ code: 'target_status_subject_mutation_mismatch', eventIndex, targetIndex, type, special });
  }
  if (requiresExplicitTraits && subjectKind && subjectKind !== 'cell_marker') {
    errors.push({ code: 'target_status_cell_marker_subject_required', eventIndex, targetIndex, type, special });
  }
  if (requiresExplicitTraits && stoneMutation && stoneMutation !== 'preserve') {
    errors.push({ code: 'target_status_cell_marker_preserve_required', eventIndex, targetIndex, type, special });
  }
}

function validatePlaybackEventsForNetworkReplay(events: unknown[]): any[] {
  const errors: any[] = [];
  const list = Array.isArray(events) ? events : [];
  list.forEach((eventValue: any, eventIndex: number) => {
    if (!eventValue || typeof eventValue !== 'object') {
      errors.push({ code: 'event_object_required', eventIndex });
      return;
    }
    const type = String(eventValue.type || '').trim().toLowerCase();
    if (!type) {
      errors.push({ code: 'event_type_required', eventIndex });
    }
    if (!Number.isFinite(Number(eventValue.phase))) {
      errors.push({ code: 'event_phase_required', eventIndex, type });
    }
    if (!BOARD_TARGET_EVENT_TYPES.has(type)) return;
    const targets = Array.isArray(eventValue.targets) ? eventValue.targets : [];
    targets.forEach((targetValue: any, targetIndex: number) => {
      const target = targetValue && typeof targetValue === 'object' ? targetValue : {};
      if (type === 'move') {
        if (!hasCoordinatePair(target.from) || !hasCoordinatePair(target.to)) {
          errors.push({ code: 'target_move_coordinates_required', eventIndex, targetIndex, type });
        }
      } else if (!hasCoordinatePair(target)) {
        errors.push({ code: 'target_coordinates_required', eventIndex, targetIndex, type });
      }
      if (STATUS_TARGET_EVENT_TYPES.has(type)) {
        validateStatusTarget(eventValue, target, eventIndex, targetIndex, type, errors);
      } else {
        const owner = normalizeOwner(target.owner ?? target.player ?? target.ownerAfter ?? target.ownerBefore);
        if (!owner) {
          errors.push({ code: 'target_owner_required', eventIndex, targetIndex, type });
        }
      }
    });
  });
  return errors;
}

const PlaybackEventContract = {
  validatePlaybackEventsForNetworkReplay
};

export = PlaybackEventContract;
