import { createMatchPublishController } from '../utils/match-publish-controller';

export function createMatchWorkerPublishController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  return createMatchPublishController(Object.assign({
    allowFateWillOwnerAction: true,
    includePreviousSnapshotForChargeDelta: true
  }, cfg));
}
