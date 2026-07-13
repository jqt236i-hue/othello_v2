import { getCpuWorkerBridge } from './bridge';

/**
 * ESM-only diagnostics surface used by browser verification. Keeping this out
 * of window preserves the explicit module boundary used by the production UI.
 */
export function getCpuWorkerBridgeDiagnostics(
  root: Window & Record<string, any> = window as any
) {
  return getCpuWorkerBridge(root);
}
