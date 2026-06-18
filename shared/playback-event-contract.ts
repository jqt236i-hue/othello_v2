'use strict';

const BOARD_TARGET_EVENT_TYPES = new Set([
  'flip',
  'destroy',
  'move',
  'spawn',
  'status_change',
  'place_hand_animation'
]);

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
      const owner = normalizeOwner(target.owner ?? target.player ?? target.ownerAfter ?? target.ownerBefore);
      if (!owner) {
        errors.push({ code: 'target_owner_required', eventIndex, targetIndex, type });
      }
    });
  });
  return errors;
}

const PlaybackEventContract = {
  validatePlaybackEventsForNetworkReplay
};

export = PlaybackEventContract;
