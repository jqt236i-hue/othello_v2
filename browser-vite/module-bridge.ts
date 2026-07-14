type RuntimeRoot = Window & Record<string, any>;
type ModuleAccessor = () => unknown;

const accessors = new Map<string, ModuleAccessor>();
const aliases = new Map<string, string>();
const registeredGroups = new Set<string>();

const pathBuiltin = Object.freeze({
  join(...parts: unknown[]): string {
    return parts
      .filter((part) => part !== null && part !== undefined)
      .map((part) => String(part).replace(/\\/g, '/'))
      .join('/')
      .replace(/\/+/g, '/');
  },
  resolve(...parts: unknown[]): string {
    return parts.map((part) => String(part)).join('/');
  },
  dirname(value: unknown): string {
    const normalized = String(value || '').replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index >= 0 ? normalized.slice(0, index) : '.';
  },
  sep: '/'
});

function normalizeModuleKey(value: unknown): string {
  let normalized = String(value || '').trim().replace(/\\/g, '/');
  const distIndex = normalized.indexOf('dist/');
  if (distIndex >= 0) normalized = normalized.slice(distIndex + 5);
  normalized = normalized.replace(/^\.\//, '').replace(/\.js$/, '');
  const parts: string[] = [];
  for (const part of normalized.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function resolveModuleKey(requestId: unknown, fromDir = ''): string {
  const raw = String(requestId || '').trim().replace(/\\/g, '/');
  const combined = raw.startsWith('.') ? `${String(fromDir || '').replace(/\/$/, '')}/${raw}` : raw;
  let resolved = normalizeModuleKey(combined);
  const seen = new Set<string>();
  while (aliases.has(resolved) && !seen.has(resolved)) {
    seen.add(resolved);
    resolved = aliases.get(resolved)!;
  }
  return resolved;
}

export function requireBundledModule(requestId: unknown, fromDir = ''): any {
  if (requestId === 'path') return pathBuiltin;
  const resolved = resolveModuleKey(requestId, fromDir);
  const accessor = accessors.get(resolved);
  if (!accessor) {
    const optionalHint = registeredGroups.size > 0
      ? `; loaded optional groups: ${Array.from(registeredGroups).sort().join(', ')}`
      : '';
    throw new Error(`[vite-module-bridge] Module not available: ${resolved || String(requestId)}${optionalHint}`);
  }
  return accessor();
}

export function registerModuleAccessors(
  nextAccessors: Record<string, ModuleAccessor>,
  nextAliases: Record<string, string> = {},
  group = 'startup'
): void {
  for (const [rawKey, accessor] of Object.entries(nextAccessors || {})) {
    const key = normalizeModuleKey(rawKey);
    if (!key || typeof accessor !== 'function') {
      throw new Error(`[vite-module-bridge] invalid accessor in ${group}: ${rawKey}`);
    }
    if (!accessors.has(key)) accessors.set(key, accessor);
  }
  for (const [rawAlias, rawTarget] of Object.entries(nextAliases || {})) {
    const alias = normalizeModuleKey(rawAlias);
    const target = normalizeModuleKey(rawTarget);
    if (!alias || !target || alias === target) continue;
    const current = aliases.get(alias);
    if (current && current !== target) {
      throw new Error(`[vite-module-bridge] conflicting alias ${alias}: ${current} / ${target}`);
    }
    aliases.set(alias, target);
  }
  registeredGroups.add(String(group || 'unknown'));
}

export function installBootModuleMetadata(metadata: Record<string, unknown>): void {
  const rootRef = (typeof window !== 'undefined' ? window : globalThis) as unknown as RuntimeRoot;
  rootRef.__CARD_REVERSI_BOOT_MODULES__ = Object.freeze(metadata);
}

export function installModuleBridge(rootRef: RuntimeRoot = window as RuntimeRoot): void {
  const requireFn = (requestId: unknown, fromDir?: string) => requireBundledModule(requestId, fromDir || '');
  rootRef.require = requireFn;
  rootRef._require = requireFn;
  rootRef.__require = requireFn;
  rootRef.__non_webpack_require__ = requireFn;
  rootRef.__cjsResolvePath = (requestId: unknown, fromDir?: string) => resolveModuleKey(requestId, fromDir || '');
  rootRef.__CARD_REVERSI_REGISTER_VITE_MODULES__ = registerModuleAccessors;
  rootRef.__CARD_REVERSI_VITE_MODULE_BRIDGE__ = Object.freeze({
    require: requireFn,
    has: (moduleKey: unknown) => accessors.has(resolveModuleKey(moduleKey)),
    registeredGroups: () => Array.from(registeredGroups).sort()
  });
}

export function resetModuleBridgeForTests(): void {
  accessors.clear();
  aliases.clear();
  registeredGroups.clear();
}
