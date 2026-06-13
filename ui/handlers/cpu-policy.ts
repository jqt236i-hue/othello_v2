'use strict';

declare var _require: any;
declare var loadLvMaxModels: any;
declare var CpuPolicy: any;
declare var cpuSmartness: any;
declare var mccfrPolicy: any;
declare var addLog: any;

function _isDebugEnabled(): boolean {
  try {
    const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
    if (/[?&]debug=1\b/.test(qs) || /[?&]debug=true\b/.test(qs)) return true;
    if (/[?&]specialDebug=1\b/.test(qs) || /[?&]specialDebug=true\b/i.test(qs)) return true;
    if (/[?&]special-debug=1\b/.test(qs) || /[?&]special-debug=true\b/i.test(qs)) return true;
  } catch (e) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && (window as any).DEBUG_UNLIMITED_USAGE === true) return true;
  } catch (e) { /* ignore */ }
  return false;
}

function _debugLog(...args: any[]): void {
  if (!_isDebugEnabled()) return;
  try {
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log.apply(console, args);
    }
  } catch (e) { /* ignore */ }
}

function _uniqueStrings(values: any[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const one of Array.isArray(values) ? values : []) {
    const s = String(one || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function _shouldForceOnnxLoad(): boolean {
  try {
    const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
    if (/[?&]cpuOnnx=1\b/i.test(qs) || /[?&]cpu_onnx=1\b/i.test(qs)) return true;
  } catch (e) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && (window as any).CPU_FORCE_ONNX_POLICY === true) return true;
  } catch (e) { /* ignore */ }
  return false;
}

function _shouldLoadOthelloOnnxByDefault(): boolean {
  try {
    const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
    if (/[?&]othelloOnnx=(?:0|false)\b/i.test(qs) || /[?&]othello_onnx=(?:0|false)\b/i.test(qs)) return false;
  } catch (e) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && (window as any).CPU_DISABLE_OTHELLO_ONNX === true) return false;
  } catch (e) { /* ignore */ }
  try {
    const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
    if (/[?&]othelloOnnx=(?:1|true)\b/i.test(qs) || /[?&]othello_onnx=(?:1|true)\b/i.test(qs)) return true;
  } catch (e) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && (window as any).CPU_FORCE_OTHELLO_ONNX === true) return true;
  } catch (e) { /* ignore */ }
  return true;
}

function _getCpuModelLoadTimeoutMs(): number {
  try {
    if (typeof window !== 'undefined' && Number.isFinite(Number((window as any).CPU_MODEL_LOAD_TIMEOUT_MS))) {
      const n = Math.floor(Number((window as any).CPU_MODEL_LOAD_TIMEOUT_MS));
      if (n >= 1) return n;
    }
  } catch (e) { /* ignore */ }
  try {
    const qs = (typeof location !== 'undefined' && location.search) ? location.search : '';
    const match = qs.match(/[?&]cpuModelLoadTimeoutMs=(\d+)\b/i);
    if (match) {
      const n = Math.floor(Number(match[1]));
      if (n >= 1) return n;
    }
  } catch (e) { /* ignore */ }
  return 15000;
}

function _withLoadTimeout(promise: any, timeoutMs: any, label: string): Promise<any> {
  const ms = Math.max(1, Math.floor(Number(timeoutMs) || 0));
  return new Promise((resolve, reject) => {
    let settled = false;
    const timerId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        reject(err);
      }
    );
  });
}

function _resolveModuleWithRequireLoaders(moduleId: string, readModule: (moduleRef: any) => any): any {
  const loaders = [
    (typeof _require === 'function') ? _require : null,
    (typeof require === 'function') ? require : null
  ];
  for (const loadModule of loaders) {
    if (typeof loadModule !== 'function') continue;
    try {
      const resolved = readModule(loadModule(moduleId));
      if (resolved) return resolved;
    } catch (e) { /* try next loader */ }
  }
  return null;
}

function _resolveCpuLv6SharedProfile(): any {
  const readSharedProfile = (value: any): any => {
    if (!value || typeof value !== 'object') return null;
    if (value.browser && typeof value.browser === 'object') return value;
    const defaultValue = value.default;
    if (defaultValue && typeof defaultValue === 'object' && defaultValue.browser && typeof defaultValue.browser === 'object') {
      return defaultValue;
    }
    return value;
  };
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).CPU_LV6_SHARED_PROFILE && typeof (globalThis as any).CPU_LV6_SHARED_PROFILE === 'object') {
      return readSharedProfile((globalThis as any).CPU_LV6_SHARED_PROFILE);
    }
  } catch (e) { /* ignore */ }
  return _resolveModuleWithRequireLoaders('../../constants/cpu-lv6-shared-profile', readSharedProfile);
}

let _cpuLv6RuntimeCapabilityModule: any = null;

function _resolveCpuLv6RuntimeCapabilityModule(): any {
  const readCapabilityModule = (moduleRef: any): any => {
    if (moduleRef && typeof moduleRef.resolveCpuLv6BrowserRuntimeCapability === 'function') return moduleRef;
    const defaultValue = moduleRef && typeof moduleRef === 'object' ? moduleRef.default : null;
    if (defaultValue && typeof defaultValue.resolveCpuLv6BrowserRuntimeCapability === 'function') return defaultValue;
    return null;
  };
  if (
    _cpuLv6RuntimeCapabilityModule &&
    typeof _cpuLv6RuntimeCapabilityModule.resolveCpuLv6BrowserRuntimeCapability === 'function'
  ) {
    return _cpuLv6RuntimeCapabilityModule;
  }
  try {
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as any).CpuLv6RuntimeCapability &&
      typeof (globalThis as any).CpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability === 'function'
    ) {
      _cpuLv6RuntimeCapabilityModule = (globalThis as any).CpuLv6RuntimeCapability;
      return _cpuLv6RuntimeCapabilityModule;
    }
  } catch (e) { /* ignore */ }
  const resolved = _resolveModuleWithRequireLoaders('../../shared/cpu-lv6-runtime-capability', readCapabilityModule);
  if (resolved) {
    _cpuLv6RuntimeCapabilityModule = resolved;
    return _cpuLv6RuntimeCapabilityModule;
  }
  return null;
}

function _resolveCpuLv6BrowserRuntimeCapability(): any {
  const moduleRef = _resolveCpuLv6RuntimeCapabilityModule();
  const shared = _resolveCpuLv6SharedProfile();
  if (!moduleRef || typeof moduleRef.resolveCpuLv6BrowserRuntimeCapability !== 'function') return null;
  return moduleRef.resolveCpuLv6BrowserRuntimeCapability(shared, {
    forcePrimaryOnnx: _shouldForceOnnxLoad()
  });
}

function _resolveBrowserPolicyRuntime(globalName: string, moduleIds: string[]): any {
  try {
    if (typeof window !== 'undefined' && (window as any)[globalName]) {
      const runtime = (window as any)[globalName];
      if (runtime && typeof runtime.loadFromUrl === 'function') return runtime;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof _require !== 'function') return null;
    for (const oneId of moduleIds) {
      try {
        const moduleRef = _require(oneId);
        if (moduleRef && typeof moduleRef.loadFromUrl === 'function') return moduleRef;
        const defaultValue = moduleRef && typeof moduleRef === 'object' ? moduleRef.default : null;
        if (defaultValue && typeof defaultValue.loadFromUrl === 'function') return defaultValue;
      } catch (e) { /* try next candidate */ }
    }
  } catch (e) { /* ignore */ }
  return null;
}

function _resolvePolicyOnnxRuntime(): any {
  return _resolveBrowserPolicyRuntime('CpuPolicyOnnxRuntime', [
    '../../game/ai/policy-onnx-runtime',
    '../../game/ai/policy-onnx-runtime.js'
  ]);
}

function _resolvePolicyTableRuntime(): any {
  return _resolveBrowserPolicyRuntime('CpuPolicyTableRuntime', [
    '../../game/ai/policy-table-runtime',
    '../../game/ai/policy-table-runtime.js'
  ]);
}

function _resolveOthelloOnnxRuntime(): any {
  return _resolveBrowserPolicyRuntime('OthelloOnnxRuntime', [
    '../../game/ai/othello-onnx-runtime',
    '../../game/ai/othello-onnx-runtime.js'
  ]);
}

function _shouldLoadBrowserOnnxRuntime(): boolean {
  const capability = _resolveCpuLv6BrowserRuntimeCapability();
  if (capability && typeof capability.shouldLoadPrimaryOnnxRuntime === 'boolean') {
    return capability.shouldLoadPrimaryOnnxRuntime;
  }
  if (_shouldForceOnnxLoad()) return true;

  const shared = _resolveCpuLv6SharedProfile();
  const browserProfile = shared && shared.browser && typeof shared.browser === 'object'
    ? shared.browser
    : null;
  if (!browserProfile) return true;

  const capabilityModule = _resolveCpuLv6RuntimeCapabilityModule();
  if (
    capabilityModule &&
    typeof capabilityModule.shouldUseCpuLv6OnnxMoveDecision === 'function'
  ) {
    return capabilityModule.shouldUseCpuLv6OnnxMoveDecision(shared, { forcePrimaryOnnx: _shouldForceOnnxLoad() });
  }
  return true;
}

function _getCpuModelLoadStatusStore(): any {
  try {
    if (typeof window === 'undefined') return null;
    if (!(window as any).__CPU_MODEL_LOAD_STATUS__ || typeof (window as any).__CPU_MODEL_LOAD_STATUS__ !== 'object') {
      (window as any).__CPU_MODEL_LOAD_STATUS__ = {
        onnx: {
          loaded: false,
          sourceUrl: '',
          metaUrl: '',
          triedRoots: [],
          lastError: ''
        },
        table: {
          loaded: false,
          sourceUrl: '',
          triedRoots: [],
          lastError: ''
        },
        othelloTable: {
          loaded: false,
          valueLoaded: false,
          sourceUrl: '',
          valueSourceUrl: '',
          triedRoots: [],
          lastError: ''
        },
        othelloOnnx: {
          loaded: false,
          sourceUrl: '',
          metaUrl: '',
          triedRoots: [],
          lastError: ''
        }
      };
    }
    return (window as any).__CPU_MODEL_LOAD_STATUS__;
  } catch (e) {
    return null;
  }
}

function _setCpuModelLoadStatus(kind: string, patch: any): void {
  const store = _getCpuModelLoadStatusStore();
  if (!store || !store[kind]) return;
  store[kind] = Object.assign({}, store[kind], patch || {});
}

function _reportCriticalModelLoadIssue(kind: string, message: string, extra?: any): void {
  const normalizedKind = kind === 'table' || kind === 'othelloTable' ? kind : 'onnx';
  const errorMessage = String(message || '').trim() || 'unknown error';
  const details = Object.assign({}, extra || {}, {
    loaded: false,
    lastError: errorMessage
  });
  _setCpuModelLoadStatus(normalizedKind, details);
  try {
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error(
        `[CPU] ${normalizedKind} model unavailable: ${errorMessage}`,
        extra || {}
      );
    }
  } catch (e) { /* ignore */ }
}

function _candidateAssetRoots(): string[] {
  const roots = ['', './', '/', '../', '../../'];
  try {
    const pathname = (typeof location !== 'undefined' && typeof location.pathname === 'string')
      ? location.pathname
      : '';
    const baseDir = pathname
      ? (pathname.endsWith('/') ? pathname : pathname.replace(/[^/]*$/, ''))
      : '';
    if (baseDir && baseDir !== '/') {
      roots.push(baseDir);
      const parentDir = baseDir.replace(/[^/]+\/$/, '/');
      if (parentDir && parentDir !== baseDir) roots.push(parentDir);
    }
  } catch (e) { /* ignore */ }
  return _uniqueStrings(roots);
}

function _joinAssetUrl(root: string, relativePath: string): string {
  const cleanPath = String(relativePath || '').replace(/^\/+/, '');
  const cleanRoot = String(root || '');
  if (!cleanRoot) return cleanPath;
  if (cleanRoot === '/') return `/${cleanPath}`;
  return `${cleanRoot}${cleanPath}`.replace(/\/{2,}/g, '/');
}

function _deriveResolvedRootFromUrl(resolvedUrl: string, relativePath: string): string {
  const url = String(resolvedUrl || '').trim();
  const rel = String(relativePath || '').replace(/^\/+/, '');
  if (!url || !rel) return '';
  const idx = url.lastIndexOf(rel);
  if (idx >= 0) return url.slice(0, idx);
  const slash = url.lastIndexOf('/');
  if (slash >= 0) return url.slice(0, slash + 1);
  return '';
}

async function _probeUrl(fetchImpl: any, url: string): Promise<boolean> {
  if (!fetchImpl || !url) return false;
  try {
    const headRes = await fetchImpl(url, { method: 'HEAD', cache: 'no-store' });
    if (headRes && headRes.ok) return true;
    const status = headRes ? Number(headRes.status || 0) : 0;
    if (status !== 405 && status !== 501) return false;
  } catch (e) {
    return false;
  }
  try {
    const getRes = await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Range: 'bytes=0-0' }
    });
    return !!(getRes && getRes.ok);
  } catch (e) {
    return false;
  }
}

async function _resolveAssetPair(fetchImpl: any, primaryRelativePath: string, secondaryRelativePath: string): Promise<any> {
  const roots = _candidateAssetRoots();
  for (const root of roots) {
    const primaryUrl = _joinAssetUrl(root, primaryRelativePath);
    const secondaryUrl = _joinAssetUrl(root, secondaryRelativePath);
    const primaryOk = await _probeUrl(fetchImpl, primaryUrl);
    if (!primaryOk) continue;
    const secondaryOk = await _probeUrl(fetchImpl, secondaryUrl);
    if (!secondaryOk) continue;
    return { primaryUrl, secondaryUrl, triedRoots: roots };
  }
  return null;
}

async function _resolveSingleAsset(fetchImpl: any, relativePath: string): Promise<any> {
  const roots = _candidateAssetRoots();
  for (const root of roots) {
    const url = _joinAssetUrl(root, relativePath);
    const ok = await _probeUrl(fetchImpl, url);
    if (ok) return { url, triedRoots: roots };
  }
  return null;
}

async function _resolveOptionalAssetPair(fetchImpl: any, primaryRelativePath: string, secondaryRelativePath: string, preferredRoot: string): Promise<any> {
  const preferred = String(preferredRoot || '').trim();
  if (preferred) {
    const primaryUrl = _joinAssetUrl(preferred, primaryRelativePath);
    const secondaryUrl = _joinAssetUrl(preferred, secondaryRelativePath);
    const primaryOk = await _probeUrl(fetchImpl, primaryUrl);
    const secondaryOk = primaryOk ? await _probeUrl(fetchImpl, secondaryUrl) : false;
    if (primaryOk && secondaryOk) {
      return { primaryUrl, secondaryUrl };
    }
  }
  return _resolveAssetPair(fetchImpl, primaryRelativePath, secondaryRelativePath);
}

function _resolveModelRedirectUrl(sourceUrl: string, redirectUrl: string): string {
  const redirect = String(redirectUrl || '').trim();
  if (!redirect) return '';
  if (/^(?:https?:)?\/\//i.test(redirect) || redirect.startsWith('/') || redirect.startsWith('./') || redirect.startsWith('../')) {
    return redirect;
  }
  const source = String(sourceUrl || '').trim();
  if (source.startsWith('./')) return `./${redirect.replace(/^\/+/, '')}`;
  return redirect;
}

async function _inflateGzipJsonAsset(fetchImpl: any, url: string): Promise<any> {
  if (!fetchImpl || !url) throw new Error('gzip asset fetch is not available');
  if (typeof DecompressionStream !== 'function') {
    throw new Error('gzip model asset requires DecompressionStream support');
  }
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response || response.ok !== true || typeof response.arrayBuffer !== 'function') {
    throw new Error(`failed to fetch compressed model asset: ${url}`);
  }
  const compressed = await response.arrayBuffer();
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

async function _loadJsonModelWithRedirect(fetchImpl: any, url: string): Promise<any> {
  if (!fetchImpl || !url) throw new Error('model fetch is not available');
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response || response.ok !== true || typeof response.json !== 'function') {
    throw new Error(`failed to fetch model asset: ${url}`);
  }
  const payload = await response.json();
  if (payload && payload.assetType === 'policy_table.redirect.v1') {
    if (payload.compression !== 'gzip' || typeof payload.url !== 'string') {
      throw new Error(`unsupported model redirect manifest: ${url}`);
    }
    const compressedUrl = _resolveModelRedirectUrl(url, payload.url);
    return _inflateGzipJsonAsset(fetchImpl, compressedUrl);
  }
  if (payload && payload.assetType === 'policy_table.chunks.v1') {
    if (!Array.isArray(payload.chunks) || payload.chunks.length <= 0) {
      throw new Error(`empty model chunk manifest: ${url}`);
    }
    let text = '';
    for (const chunk of payload.chunks) {
      const chunkUrl = _resolveModelRedirectUrl(url, chunk && chunk.url);
      if (!chunkUrl) throw new Error(`invalid model chunk manifest: ${url}`);
      const chunkResponse = await fetchImpl(chunkUrl, { cache: 'no-store' });
      if (!chunkResponse || chunkResponse.ok !== true || typeof chunkResponse.text !== 'function') {
        throw new Error(`failed to fetch model chunk: ${chunkUrl}`);
      }
      text += await chunkResponse.text();
    }
    return JSON.parse(text);
  }
  return payload;
}

async function _loadOthelloJsonModel(runtime: any, fetchImpl: any, url: string, setterName: string, loaderName: string): Promise<boolean> {
  if (fetchImpl && runtime && typeof runtime[setterName] === 'function') {
    try {
      const payload = await _loadJsonModelWithRedirect(fetchImpl, url);
      const ok = !!runtime[setterName](payload);
      return ok;
    } catch (e) {
      if (_isDebugEnabled()) console.warn(`[CPU] direct othello model load failed (${url})`, e);
    }
  }
  return !!(runtime && typeof runtime[loaderName] === 'function'
    && await runtime[loaderName](url));
}

async function _loadAuxiliaryPolicyOnnxModels(runtime: any, options: any): Promise<void> {
  const cfg = options && typeof options === 'object' ? options : {};
  if (!runtime || typeof runtime !== 'object') return;

  if (cfg.hasTargetModel && typeof runtime.loadTargetModelFromUrl === 'function') {
    try {
      const targetOk = await _withLoadTimeout(
        runtime.loadTargetModelFromUrl(cfg.targetModelUrl, cfg.targetMetaUrl),
        cfg.loadTimeoutMs,
        'policy-target load'
      );
      _setCpuModelLoadStatus('onnx', {
        targetLoaded: !!targetOk,
        targetSourceUrl: cfg.targetModelUrl,
        targetMetaUrl: cfg.targetMetaUrl
      });
      if (targetOk) {
        _debugLog(`[CPU] policy-target loaded (${cfg.targetModelUrl})`);
      }
    } catch (targetErr) {
      if (_isDebugEnabled()) console.warn('[CPU] policy-target loading failed', targetErr);
    }
  }

  if (cfg.hasValueModel && typeof runtime.loadValueModelFromUrl === 'function') {
    try {
      const valueOk = await _withLoadTimeout(
        runtime.loadValueModelFromUrl(cfg.valueModelUrl, cfg.valueMetaUrl),
        cfg.loadTimeoutMs,
        'policy-value load'
      );
      _setCpuModelLoadStatus('onnx', {
        valueLoaded: !!valueOk,
        valueSourceUrl: cfg.valueModelUrl,
        valueMetaUrl: cfg.valueMetaUrl
      });
      if (valueOk) {
        _debugLog(`[CPU] policy-value loaded (${cfg.valueModelUrl})`);
      }
    } catch (valueErr) {
      if (_isDebugEnabled()) console.warn('[CPU] policy-value loading failed', valueErr);
    }
  }
}

async function initLvMaxModels(): Promise<void> {
  if (typeof (loadLvMaxModels as any) === 'undefined') {
    if (_isDebugEnabled()) console.warn('[LvMax] loadLvMaxModels function not available');
    return;
  }

  try {
    _debugLog('[LvMax] Loading Deep CFR models...');
    const success = await (window as any).loadLvMaxModels('/ai/deepcfr/models/final');
    if (success) {
      _debugLog('[LvMax] Models loaded successfully');
    } else {
      console.warn('[LvMax] Model loading failed');
    }
  } catch (err) {
    console.error('[LvMax] Model loading error:', err);
  }
}

async function loadCpuPolicy(): Promise<void> {
  if (typeof (CpuPolicy as any) === 'undefined' || !(CpuPolicy as any).loadPolicyForLevel) {
    if (_isDebugEnabled()) console.warn('CpuPolicy.loadPolicyForLevel not available');
    return;
  }
  try {
    const selectLevel = Number((document.getElementById('smartWhite') as HTMLSelectElement | null)?.value);
    const whiteLevel = Number.isFinite(selectLevel)
      ? Math.max(1, Math.min(6, Math.floor(selectLevel)))
      : (((typeof cpuSmartness !== 'undefined' && cpuSmartness) ? (cpuSmartness as any).white : 3) || 3);
    _debugLog(`Attempting to load policy for level ${whiteLevel}`);
    (mccfrPolicy as any) = await (CpuPolicy as any).loadPolicyForLevel(whiteLevel);
    _debugLog('Policy loaded successfully:', mccfrPolicy);
    addLog(`MCCFRポリシー (レベル ${whiteLevel}) を読み込みました`);
  } catch (err: any) {
    console.error('Policy load failed - Full error:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    addLog(`ポリシー読み込みに失敗しました: ${err.message}`);
  }
}

async function initPolicyOnnxModel(): Promise<void> {
  const runtime = _resolvePolicyOnnxRuntime();
  if (!runtime || typeof runtime.loadFromUrl !== 'function') return;
  const capability = _resolveCpuLv6BrowserRuntimeCapability();
  const shouldLoadPrimaryOnnx = _shouldLoadBrowserOnnxRuntime();
  const shouldLoadAuxiliaryTargetModel = !capability || capability.hasAuxiliaryTargetHead !== false;
  const shouldLoadAuxiliaryValueModel = !capability || capability.hasAuxiliaryValueHead !== false;
  if (!shouldLoadPrimaryOnnx) {
    _setCpuModelLoadStatus('onnx', {
      loaded: false,
      sourceUrl: '',
      metaUrl: '',
      triedRoots: [],
      lastError: '',
      skipped: true,
      skipReason: 'shared-profile-policy-table-parity',
      targetLoaded: false,
      targetSourceUrl: '',
      targetMetaUrl: '',
      valueLoaded: false,
      valueSourceUrl: '',
      valueMetaUrl: ''
    });
  }

  const modelRel = 'data/models/policy-net.onnx';
  const metaRel = 'data/models/policy-net.onnx.meta.json';
  const targetModelRel = 'data/models/policy-target.onnx';
  const targetMetaRel = 'data/models/policy-target.onnx.meta.json';
  const valueModelRel = 'data/models/policy-value.onnx';
  const valueMetaRel = 'data/models/policy-value.onnx.meta.json';
  let modelUrl = modelRel;
  let metaUrl = metaRel;
  let targetModelUrl = targetModelRel;
  let targetMetaUrl = targetMetaRel;
  let valueModelUrl = valueModelRel;
  let valueMetaUrl = valueMetaRel;
  let hasTargetModel = false;
  let hasValueModel = false;
  const loadTimeoutMs = _getCpuModelLoadTimeoutMs();

  const fetchImpl = (typeof window !== 'undefined' && typeof window.fetch === 'function')
    ? window.fetch.bind(window)
    : null;
  if (fetchImpl && shouldLoadPrimaryOnnx) {
    const resolved = await _resolveAssetPair(fetchImpl, modelRel, metaRel);
    if (!resolved) {
      _reportCriticalModelLoadIssue(
        'onnx',
        'missing policy-net assets; Lv6 loses ONNX guidance and falls back to policy-table or heuristic CPU. Serve the repo root so data/models is reachable.',
        { sourceUrl: '', metaUrl: '', triedRoots: _candidateAssetRoots() }
      );
      return;
    }
    modelUrl = resolved.primaryUrl;
    metaUrl = resolved.secondaryUrl;
    _setCpuModelLoadStatus('onnx', {
      loaded: false,
      sourceUrl: modelUrl,
      metaUrl,
      triedRoots: Array.isArray(resolved.triedRoots) ? resolved.triedRoots.slice() : [],
      lastError: ''
    });
  }

  if (fetchImpl && shouldLoadPrimaryOnnx) {
    const resolvedRoot = _deriveResolvedRootFromUrl(modelUrl, modelRel);
    if (resolvedRoot) {
      targetModelUrl = _joinAssetUrl(resolvedRoot, targetModelRel);
      targetMetaUrl = _joinAssetUrl(resolvedRoot, targetMetaRel);
      valueModelUrl = _joinAssetUrl(resolvedRoot, valueModelRel);
      valueMetaUrl = _joinAssetUrl(resolvedRoot, valueMetaRel);
    }
  }

  if (fetchImpl) {
    const resolvedRoot = shouldLoadPrimaryOnnx ? _deriveResolvedRootFromUrl(modelUrl, modelRel) : '';
    const resolvedTarget = shouldLoadAuxiliaryTargetModel
      ? await _resolveOptionalAssetPair(fetchImpl, targetModelRel, targetMetaRel, resolvedRoot)
      : null;
    if (resolvedTarget) {
      targetModelUrl = resolvedTarget.primaryUrl;
      targetMetaUrl = resolvedTarget.secondaryUrl;
      hasTargetModel = true;
    }
    const resolvedValue = shouldLoadAuxiliaryValueModel
      ? await _resolveOptionalAssetPair(fetchImpl, valueModelRel, valueMetaRel, resolvedRoot)
      : null;
    if (resolvedValue) {
      valueModelUrl = resolvedValue.primaryUrl;
      valueMetaUrl = resolvedValue.secondaryUrl;
      hasValueModel = true;
    }
  }

  if (!shouldLoadPrimaryOnnx) {
    _debugLog('[CPU] policy-onnx skipped by shared Lv6 parity profile');
    await _loadAuxiliaryPolicyOnnxModels(runtime, {
      hasTargetModel,
      targetModelUrl,
      targetMetaUrl,
      hasValueModel,
      valueModelUrl,
      valueMetaUrl,
      loadTimeoutMs
    });
    return;
  }

  try {
    if (typeof runtime.configure === 'function') {
      runtime.configure({
        enabled: true,
        minLevel: 6,
        sourceUrl: modelUrl,
        metaUrl: metaUrl,
        targetSourceUrl: targetModelUrl,
        targetMetaUrl: targetMetaUrl,
        valueSourceUrl: valueModelUrl,
        valueMetaUrl: valueMetaUrl,
        enableWebGpuExecution: (typeof globalThis !== 'undefined' && (globalThis as any).ENABLE_ONNX_WEBGPU === true),
        readQuerySearch: () => {
          try {
            return (typeof location !== 'undefined' && location && typeof location.search === 'string') ? location.search : '';
          } catch (e) {
            return '';
          }
        }
      });
    }
    const ok = await _withLoadTimeout(runtime.loadFromUrl(modelUrl, metaUrl), loadTimeoutMs, 'policy-onnx load');
    if (ok) {
      _setCpuModelLoadStatus('onnx', {
        loaded: true,
        sourceUrl: modelUrl,
        metaUrl,
        targetLoaded: false,
        targetSourceUrl: hasTargetModel ? targetModelUrl : '',
        targetMetaUrl: hasTargetModel ? targetMetaUrl : '',
        valueLoaded: false,
        valueSourceUrl: hasValueModel ? valueModelUrl : '',
        valueMetaUrl: hasValueModel ? valueMetaUrl : '',
        lastError: ''
      });
      _debugLog(`[CPU] policy-onnx loaded (${modelUrl})`);
      await _loadAuxiliaryPolicyOnnxModels(runtime, {
        hasTargetModel,
        targetModelUrl,
        targetMetaUrl,
        hasValueModel,
        valueModelUrl,
        valueMetaUrl,
        loadTimeoutMs
      });
    } else {
      const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
      _reportCriticalModelLoadIssue('onnx', status && status.lastError ? status.lastError : 'runtime returned not loaded', {
        sourceUrl: modelUrl,
        metaUrl
      });
      if (_isDebugEnabled()) console.warn('[CPU] policy-onnx not loaded', status && status.lastError ? status.lastError : '');
    }
  } catch (err: any) {
    _reportCriticalModelLoadIssue('onnx', err && err.message ? err.message : 'load failed', {
      sourceUrl: modelUrl,
      metaUrl
    });
    if (_isDebugEnabled()) console.warn('[CPU] policy-onnx loading failed', err);
  }
}

async function initPolicyTableModel(): Promise<void> {
  const runtime = _resolvePolicyTableRuntime();
  if (!runtime || typeof runtime.loadFromUrl !== 'function') return;

  const modelRel = 'data/models/policy-table.json';
  let modelUrl = modelRel;
  const loadTimeoutMs = _getCpuModelLoadTimeoutMs();
  const fetchImpl = (typeof window !== 'undefined' && typeof window.fetch === 'function')
    ? window.fetch.bind(window)
    : null;
  if (fetchImpl) {
    const resolved = await _resolveSingleAsset(fetchImpl, modelRel);
    if (!resolved) {
      _reportCriticalModelLoadIssue(
        'table',
        'missing policy-table asset; Lv6 loses table guidance. ONNX may still load if policy-net assets are reachable.',
        { sourceUrl: '', triedRoots: _candidateAssetRoots() }
      );
      return;
    }
    modelUrl = resolved.url;
    _setCpuModelLoadStatus('table', {
      loaded: false,
      sourceUrl: modelUrl,
      triedRoots: Array.isArray(resolved.triedRoots) ? resolved.triedRoots.slice() : [],
      lastError: ''
    });
  }

  try {
    if (typeof runtime.configure === 'function') {
      runtime.configure({
        enabled: true,
        minLevel: 6,
        sourceUrl: modelUrl
      });
    }
    const ok = await _withLoadTimeout(runtime.loadFromUrl(modelUrl), loadTimeoutMs, 'policy-table load');
    if (ok) {
      _setCpuModelLoadStatus('table', {
        loaded: true,
        sourceUrl: modelUrl,
        lastError: ''
      });
      const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
      const statesCount = status && Number.isFinite(status.statesCount) ? status.statesCount : '?';
      _debugLog(`[CPU] policy-table loaded (states=${statesCount}, url=${modelUrl})`);
    } else {
      const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
      _reportCriticalModelLoadIssue('table', status && status.lastError ? status.lastError : 'runtime returned not loaded', {
        sourceUrl: modelUrl
      });
      if (_isDebugEnabled()) console.warn('[CPU] policy-table not loaded', status && status.lastError ? status.lastError : '');
    }
  } catch (err: any) {
    _reportCriticalModelLoadIssue('table', err && err.message ? err.message : 'load failed', {
      sourceUrl: modelUrl
    });
    if (_isDebugEnabled()) console.warn('[CPU] policy-table loading failed', err);
  }
}

function _resolveOthelloBrowserCpuRuntime(): any {
  try {
    if (typeof window !== 'undefined' && (window as any).OthelloBrowserCpuRuntime) {
      return (window as any).OthelloBrowserCpuRuntime;
    }
  } catch (e) { /* ignore */ }
  return _resolveModuleWithRequireLoaders('othello-ai/runtime/browser-cpu', (moduleRef) => (
    moduleRef && typeof moduleRef.loadFromUrl === 'function' ? moduleRef : null
  ));
}

async function initOthelloOnnxModel(): Promise<void> {
  if (!_shouldLoadOthelloOnnxByDefault()) return;
  const runtime = _resolveOthelloOnnxRuntime();
  if (!runtime || typeof runtime.loadFromUrl !== 'function') return;

  const modelRel = 'data/models/othello/policy-value.onnx';
  const metaRel = 'data/models/othello/policy-value.onnx.meta.json';
  let modelUrl = modelRel;
  let metaUrl = metaRel;
  const loadTimeoutMs = Math.max(_getCpuModelLoadTimeoutMs(), 30000);
  const fetchImpl = (typeof window !== 'undefined' && typeof window.fetch === 'function')
    ? window.fetch.bind(window)
    : null;

  if (fetchImpl) {
    const resolved = await _resolveAssetPair(fetchImpl, modelRel, metaRel);
    if (!resolved) {
      _setCpuModelLoadStatus('othelloOnnx', {
        loaded: false,
        sourceUrl: '',
        metaUrl: '',
        triedRoots: _candidateAssetRoots(),
        lastError: 'missing othello ONNX assets'
      });
      _debugLog('[CPU] othello ONNX assets missing; table fallback remains active');
      return;
    }
    modelUrl = resolved.primaryUrl;
    metaUrl = resolved.secondaryUrl;
    _setCpuModelLoadStatus('othelloOnnx', {
      loaded: false,
      sourceUrl: modelUrl,
      metaUrl,
      triedRoots: Array.isArray(resolved.triedRoots) ? resolved.triedRoots.slice() : [],
      lastError: ''
    });
  }

  try {
    if (typeof runtime.configure === 'function') {
      const ortApi = (typeof window !== 'undefined' && (window as any).ort)
        ? (window as any).ort
        : null;
            runtime.configure({
                enabled: true,
                minLevel: 6,
                useValueRerank: true,
                policyWeight: 0.75,
                topK: 8,
                heuristicRerankWeight: 3.0,
                whiteSafetyMultiplier: 1.45,
                exactSolveEmpties: 10,
                exactSolveMaxMs: 250,
                sourceUrl: modelUrl,
                metaUrl,
                ortApi
            });
    }
    const ok = await _withLoadTimeout(runtime.loadFromUrl(modelUrl, metaUrl), loadTimeoutMs, 'othello ONNX load');
    const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
    _setCpuModelLoadStatus('othelloOnnx', {
      loaded: !!ok,
      sourceUrl: modelUrl,
      metaUrl,
      schemaVersion: status && status.schemaVersion ? status.schemaVersion : undefined,
      inputDim: status && Number.isFinite(status.inputDim) ? status.inputDim : undefined,
      outputDim: status && Number.isFinite(status.outputDim) ? status.outputDim : undefined,
      lastError: ok ? '' : (status && status.lastError ? status.lastError : 'runtime returned not loaded')
    });
    if (ok) _debugLog(`[CPU] othello ONNX loaded (${modelUrl})`);
  } catch (err: any) {
    _setCpuModelLoadStatus('othelloOnnx', {
      loaded: false,
      sourceUrl: modelUrl,
      metaUrl,
      lastError: err && err.message ? err.message : 'load failed'
    });
    if (_isDebugEnabled()) console.warn('[CPU] othello ONNX loading failed', err);
  }
}

async function initOthelloPolicyTableModel(): Promise<void> {
  await initOthelloOnnxModel();
  try {
    const status = _getCpuModelLoadStatusStore();
    if (status && status.othelloOnnx && status.othelloOnnx.loaded === true) {
      _debugLog('[CPU] othello ONNX primary loaded; skip othello policy/value table load');
      return;
    }
  } catch (e) { /* ignore */ }
  const runtime = _resolveOthelloBrowserCpuRuntime();
  if (!runtime || typeof runtime.loadFromUrl !== 'function') return;

  const policyRel = 'data/models/othello/policy-table.json';
  const valueRel = 'data/models/othello/value-table.json';
  let policyUrl = policyRel;
  let valueUrl = valueRel;
  const loadTimeoutMs = Math.max(_getCpuModelLoadTimeoutMs(), 30000);
  const fetchImpl = (typeof window !== 'undefined' && typeof window.fetch === 'function')
    ? window.fetch.bind(window)
    : null;

  if (fetchImpl) {
    const resolvedPolicy = await _resolveSingleAsset(fetchImpl, policyRel);
    const resolvedValue = await _resolveSingleAsset(fetchImpl, valueRel);
    if (!resolvedPolicy || !resolvedValue) {
      _reportCriticalModelLoadIssue(
        'othelloTable',
        'missing othello policy/value table asset; Reversi mode Lv6 falls back to heuristic CPU.',
        {
          sourceUrl: resolvedPolicy ? resolvedPolicy.url : '',
          valueSourceUrl: resolvedValue ? resolvedValue.url : '',
          triedRoots: _candidateAssetRoots()
        }
      );
      return;
    }
    policyUrl = resolvedPolicy.url;
    valueUrl = resolvedValue.url;
    _setCpuModelLoadStatus('othelloTable', {
      loaded: false,
      valueLoaded: false,
      sourceUrl: policyUrl,
      valueSourceUrl: valueUrl,
      triedRoots: Array.isArray(resolvedPolicy.triedRoots) ? resolvedPolicy.triedRoots.slice() : [],
      lastError: ''
    });
  }

  try {
    if (typeof runtime.configure === 'function') {
      runtime.configure({
        enabled: true,
        minLevel: 6,
        sourceUrl: policyUrl,
        valueSourceUrl: valueUrl
      });
    }
    const policyOk = await _withLoadTimeout(
      _loadOthelloJsonModel(runtime, fetchImpl, policyUrl, 'setModel', 'loadFromUrl'),
      loadTimeoutMs,
      'othello policy-table load'
    );
    const valueOk = await _withLoadTimeout(
      _loadOthelloJsonModel(runtime, fetchImpl, valueUrl, 'setValueModel', 'loadValueModelFromUrl'),
      loadTimeoutMs,
      'othello value-table load'
    );
    if (policyOk && valueOk) {
      const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
      _setCpuModelLoadStatus('othelloTable', {
        loaded: true,
        valueLoaded: true,
        sourceUrl: policyUrl,
        valueSourceUrl: valueUrl,
        statesCount: status && Number.isFinite(status.statesCount) ? status.statesCount : undefined,
        valueStatesCount: status && Number.isFinite(status.valueStatesCount) ? status.valueStatesCount : undefined,
        valueAbstractStatesCount: status && Number.isFinite(status.valueAbstractStatesCount) ? status.valueAbstractStatesCount : undefined,
        lastError: ''
      });
      _debugLog(`[CPU] othello policy/value tables loaded (policy=${policyUrl}, value=${valueUrl})`);
      return;
    }
    const status = (typeof runtime.getStatus === 'function') ? runtime.getStatus() : null;
    _reportCriticalModelLoadIssue('othelloTable', status && status.lastError ? status.lastError : 'runtime returned not loaded', {
      sourceUrl: policyUrl,
      valueSourceUrl: valueUrl,
      valueLoaded: !!valueOk
    });
    if (_isDebugEnabled()) console.warn('[CPU] othello policy/value tables not loaded', status && status.lastError ? status.lastError : '');
  } catch (err: any) {
    _reportCriticalModelLoadIssue('othelloTable', err && err.message ? err.message : 'load failed', {
      sourceUrl: policyUrl,
      valueSourceUrl: valueUrl
    });
    if (_isDebugEnabled()) console.warn('[CPU] othello policy/value table loading failed', err);
  }
}

if (typeof window !== 'undefined') {
  (window as any).initLvMaxModels = initLvMaxModels;
  (window as any).loadCpuPolicy = loadCpuPolicy;
  (window as any).initPolicyOnnxModel = initPolicyOnnxModel;
  (window as any).initPolicyTableModel = initPolicyTableModel;
  (window as any).initOthelloOnnxModel = initOthelloOnnxModel;
  (window as any).initOthelloPolicyTableModel = initOthelloPolicyTableModel;
}

const CpuPolicyModule = {
  initLvMaxModels,
  loadCpuPolicy,
  initPolicyOnnxModel,
  initPolicyTableModel,
  initOthelloOnnxModel,
  initOthelloPolicyTableModel
};

export = CpuPolicyModule;
