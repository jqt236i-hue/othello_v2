import distModule from '../dist/workers/match-worker.js';

const defaultWorker = distModule && distModule.default && typeof distModule.default.fetch === 'function'
  ? distModule.default
  : distModule;

export const MatchRoomDurableObject = distModule.MatchRoomDurableObject;
export default defaultWorker;
