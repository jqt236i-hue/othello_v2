/**
 * @file action-log.ts
 * @description UI-side storage adapter for ActionManager.
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function canUseStorage(): boolean {
  try { return typeof localStorage !== 'undefined'; } catch (e) { return false; }
}

function save(key: string, payload: unknown): boolean {
  if (!canUseStorage()) return false;
  localStorage.setItem(key, JSON.stringify(payload, null, 2));
  return true;
}

function load(key: string): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(key);
}

function clear(key: string): boolean {
  if (!canUseStorage()) return false;
  localStorage.removeItem(key);
  return true;
}

export = {
  save,
  load,
  clear
};
