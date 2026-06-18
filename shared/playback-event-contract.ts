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
      const row = target.r ?? target.row;
      const col = target.col ?? target.c;
      if (!hasFiniteCoordinate(row) || !hasFiniteCoordinate(col)) {
        errors.push({ code: 'target_coordinates_required', eventIndex, targetIndex, type });
      }
      const owner = normalizeOwner(target.owner ?? target.player);
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
