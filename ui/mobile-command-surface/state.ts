import type {
  MobileCommandLayer,
  MobileNativePanelId,
} from './config';

type MobilePanelOrigin = 'mobile' | 'external';

type MobileSurfaceState =
  | { kind: 'idle' }
  | { kind: 'layer'; layer: MobileCommandLayer }
  | { kind: 'panel-pending'; panelId: MobileNativePanelId }
  | { kind: 'panel-open'; panelId: MobileNativePanelId; origin: MobilePanelOrigin };

type MobileSurfaceEvent =
  | { type: 'OPEN_LAYER'; layer: MobileCommandLayer }
  | { type: 'CLOSE_LAYER' }
  | { type: 'BEGIN_PANEL'; panelId: MobileNativePanelId }
  | { type: 'CANCEL_PENDING' }
  | { type: 'SYNC_PANEL'; panelId: MobileNativePanelId | null };

const IDLE_MOBILE_SURFACE_STATE: MobileSurfaceState = { kind: 'idle' };

function reduceMobileSurfaceState(
  state: MobileSurfaceState,
  event: MobileSurfaceEvent,
): MobileSurfaceState {
  switch (event.type) {
    case 'OPEN_LAYER':
      return { kind: 'layer', layer: event.layer };
    case 'CLOSE_LAYER':
      return state.kind === 'layer' ? IDLE_MOBILE_SURFACE_STATE : state;
    case 'BEGIN_PANEL':
      return { kind: 'panel-pending', panelId: event.panelId };
    case 'CANCEL_PENDING':
      return state.kind === 'panel-pending' ? IDLE_MOBILE_SURFACE_STATE : state;
    case 'SYNC_PANEL':
      if (event.panelId === null) {
        return state.kind === 'panel-open' ? IDLE_MOBILE_SURFACE_STATE : state;
      }
      if (state.kind === 'panel-pending' && state.panelId === event.panelId) {
        return { kind: 'panel-open', panelId: event.panelId, origin: 'mobile' };
      }
      if (state.kind === 'panel-open' && state.panelId === event.panelId) {
        return state;
      }
      return { kind: 'panel-open', panelId: event.panelId, origin: 'external' };
    default:
      return state;
  }
}

function getActiveLayer(state: MobileSurfaceState): MobileCommandLayer | null {
  return state.kind === 'layer' ? state.layer : null;
}

function getActivePanelId(state: MobileSurfaceState): MobileNativePanelId | null {
  return state.kind === 'panel-open' ? state.panelId : null;
}

export {
  IDLE_MOBILE_SURFACE_STATE,
  getActiveLayer,
  getActivePanelId,
  reduceMobileSurfaceState,
};

export type {
  MobilePanelOrigin,
  MobileSurfaceEvent,
  MobileSurfaceState,
};
