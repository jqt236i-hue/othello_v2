export const NETWORK_AUTO_TURN_ACTION = 'auto_turn';

type MatchAutoRecord = Record<string, any>;

function asRecord(value: any): MatchAutoRecord {
  return value && typeof value === 'object' ? value : {};
}

function normalizeActionType(value: any): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'usecard') return 'use_card';
  return normalized;
}

export function isMatchAutoTurnPublishBody(bodyValue: any): boolean {
  const body = asRecord(bodyValue);
  const action = asRecord(body.action);
  return normalizeActionType(body.actionType || action.type || action.actionType) === NETWORK_AUTO_TURN_ACTION;
}

export function resolveMatchAutoTurnPublishBody(optionsValue: any): any {
  const options = asRecord(optionsValue);
  const body = asRecord(options.body);
  if (!isMatchAutoTurnPublishBody(body)) {
    return { ok: true, requested: false, body };
  }
  const snapshot = asRecord(options.snapshot);
  const cardState = asRecord(snapshot.cardState);
  const actorPlayerKey = String(options.playerKey || '').trim().toLowerCase() === 'white'
    ? 'white'
    : 'black';
  const planningPlayerKey = String(
    options.planningPlayerKey || actorPlayerKey
  ).trim().toLowerCase() === 'white'
    ? 'white'
    : 'black';
  const planner = options.CpuNetworkCommandPlanner;
  if (!planner || typeof planner.planCanonicalCpuNetworkCommand !== 'function') {
    return { ok: false, requested: true, rejectedReason: 'AUTO_COMMAND_PLANNER_UNAVAILABLE' };
  }
  const requestAction = asRecord(body.action);
  const preferredAction = asRecord(
    requestAction.preferredAction || body.preferredAction
  );
  const preferredActionType = normalizeActionType(
    requestAction.preferredActionType
    || body.preferredActionType
    || preferredAction.type
    || preferredAction.actionType
  );
  const planned = planner.planCanonicalCpuNetworkCommand({
    snapshot,
    playerKey: planningPlayerKey,
    preferredAction,
    preferredActionType,
    CoreLogic: options.CoreLogic,
    CardLogic: options.CardLogic,
    PendingCoordinator: options.PendingCoordinator,
    PendingSelectionRegistry: options.PendingSelectionRegistry,
    SubPlacementContinuation: options.SubPlacementContinuation
  });
  const plannedAction = asRecord(planned && planned.action);
  const plannedActionType = normalizeActionType(
    planned && planned.actionType || plannedAction.type || plannedAction.actionType
  );
  if (!plannedActionType || !plannedAction.type) {
    return { ok: false, requested: true, rejectedReason: 'AUTO_COMMAND_REQUIRED' };
  }
  const currentTurnIndex = Number.isFinite(Number(cardState.turnIndex))
    ? Math.trunc(Number(cardState.turnIndex))
    : 0;
  return {
    ok: true,
    requested: true,
    actionType: plannedActionType,
    action: plannedAction,
    body: {
      ...body,
      actionType: plannedActionType,
      actor: actorPlayerKey,
      playerKey: actorPlayerKey,
      params: plannedAction,
      action: plannedAction,
      turnIndex: currentTurnIndex
    }
  };
}
