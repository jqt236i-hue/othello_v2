import distModule from '../dist/workers/match-worker.js';

const defaultWorker = distModule && distModule.default && typeof distModule.default.fetch === 'function'
  ? distModule.default
  : distModule;

const MatchRoomDurableObjectExport = distModule && typeof distModule.MatchRoomDurableObject === 'function'
  ? distModule.MatchRoomDurableObject
  : distModule && distModule.default && typeof distModule.default.MatchRoomDurableObject === 'function'
    ? distModule.default.MatchRoomDurableObject
    : null;

if (!MatchRoomDurableObjectExport) {
  throw new Error('MatchRoomDurableObject export is unavailable from dist/workers/match-worker.js');
}

export const MatchRoomDurableObject = MatchRoomDurableObjectExport;
export const MatchRoomDurableObjectV2 = MatchRoomDurableObjectExport;
export const MatchRoomDurableObjectV3 = MatchRoomDurableObjectExport;
export default defaultWorker;
