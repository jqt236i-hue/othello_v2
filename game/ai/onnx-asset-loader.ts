declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function resolveFetch(fetchImpl?: any) {
  if (typeof fetchImpl === 'function') return fetchImpl;
  try {
    if (typeof fetch === 'function') return fetch.bind(globalThis);
  } catch (e) { /* ignore */ }
  return null;
}

function resolveRedirectUrl(sourceUrl: string, redirectUrl: string): string {
  const redirect = String(redirectUrl || '').trim();
  if (!redirect) return '';
  if (/^(?:https?:)?\/\//i.test(redirect) || redirect.startsWith('/') || redirect.startsWith('./') || redirect.startsWith('../')) {
    return redirect;
  }
  const source = String(sourceUrl || '').trim();
  if (source.startsWith('./')) return `./${redirect.replace(/^\/+/, '')}`;
  return redirect;
}

function isWhitespaceByte(value: number) {
  return value === 9 || value === 10 || value === 13 || value === 32;
}

function looksLikeJsonPayload(bytes: Uint8Array) {
  if (!(bytes instanceof Uint8Array) || bytes.length <= 0) return false;
  for (let i = 0; i < Math.min(bytes.length, 64); i += 1) {
    const value = bytes[i];
    if (isWhitespaceByte(value)) continue;
    return value === 123 || value === 91;
  }
  return false;
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder('utf-8').decode(bytes);
}

function parseManifestPayload(bytes: Uint8Array) {
  if (!looksLikeJsonPayload(bytes)) return null;
  try {
    const payload = JSON.parse(decodeUtf8(bytes));
    return payload && typeof payload === 'object' ? payload : null;
  } catch (e) {
    return null;
  }
}

async function readBytesViaFetch(fetchFn: any, url: string): Promise<Uint8Array> {
  const response = await fetchFn(url, { cache: 'no-store' });
  if (!response || response.ok !== true || typeof response.arrayBuffer !== 'function') {
    throw new Error(`failed to fetch ONNX asset: ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function readBytesViaFs(url: string): Uint8Array | null {
  const target = String(url || '').trim();
  if (!target || /^(?:https?:)?\/\//i.test(target)) return null;
  try {
    const fs = _require('fs');
    if (!fs || typeof fs.readFileSync !== 'function') return null;
    const raw = fs.readFileSync(target);
    return raw ? new Uint8Array(raw) : null;
  } catch (e) {
    return null;
  }
}

async function loadRawBytes(url: string, fetchImpl?: any): Promise<Uint8Array | null> {
  const fetchFn = resolveFetch(fetchImpl);
  if (fetchFn) return readBytesViaFetch(fetchFn, url);
  return readBytesViaFs(url);
}

function concatByteArrays(chunks: Uint8Array[], totalBytes?: number) {
  const size = Number.isFinite(Number(totalBytes))
    ? Math.max(0, Math.floor(Number(totalBytes)))
    : chunks.reduce((sum, one) => sum + (one ? one.length : 0), 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    if (!(chunk instanceof Uint8Array) || chunk.length <= 0) continue;
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return offset === out.length ? out : out.subarray(0, offset);
}

async function inflateGzipBytes(compressed: Uint8Array): Promise<Uint8Array> {
  try {
    const zlib = _require('zlib');
    if (zlib && typeof zlib.gunzipSync === 'function') {
      return new Uint8Array(zlib.gunzipSync(Buffer.from(compressed)));
    }
  } catch (e) { /* ignore */ }
  if (typeof DecompressionStream === 'function') {
    const arrayBuffer = compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength
    ) as ArrayBuffer;
    const stream = new Blob([arrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error('gzip ONNX asset requires zlib or DecompressionStream support');
}

async function resolveManifestBytes(manifestUrl: string, payload: any, fetchImpl?: any): Promise<Uint8Array> {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`invalid ONNX asset manifest: ${manifestUrl}`);
  }
  if (payload.assetType === 'policy_table.chunks.v1') {
    if (!Array.isArray(payload.chunks) || payload.chunks.length <= 0) {
      throw new Error(`empty ONNX chunk manifest: ${manifestUrl}`);
    }
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    for (const chunk of payload.chunks) {
      const chunkUrl = resolveRedirectUrl(manifestUrl, chunk && chunk.url);
      if (!chunkUrl) throw new Error(`invalid ONNX chunk manifest: ${manifestUrl}`);
      const bytes = await loadRawBytes(chunkUrl, fetchImpl);
      if (!(bytes instanceof Uint8Array)) throw new Error(`failed to load ONNX chunk: ${chunkUrl}`);
      chunks.push(bytes);
      totalBytes += bytes.length;
    }
    const sourceBytes = Number.isFinite(Number(payload.sourceBytes)) ? Number(payload.sourceBytes) : totalBytes;
    return concatByteArrays(chunks, sourceBytes);
  }
  if (payload.assetType === 'policy_table.redirect.v1') {
    if (payload.compression !== 'gzip' || typeof payload.url !== 'string' || !payload.url.trim()) {
      throw new Error(`unsupported ONNX redirect manifest: ${manifestUrl}`);
    }
    const compressedUrl = resolveRedirectUrl(manifestUrl, payload.url);
    const compressed = await loadRawBytes(compressedUrl, fetchImpl);
    if (!(compressed instanceof Uint8Array)) throw new Error(`failed to load compressed ONNX asset: ${compressedUrl}`);
    return inflateGzipBytes(compressed);
  }
  throw new Error(`unsupported ONNX asset manifest: ${manifestUrl}`);
}

async function loadOnnxAssetSource(modelUrl: string, fetchImpl?: any): Promise<string | Uint8Array> {
  const target = String(modelUrl || '').trim();
  if (!target) return target;
  const raw = await loadRawBytes(target, fetchImpl);
  if (!(raw instanceof Uint8Array)) {
    return target;
  }
  const payload = parseManifestPayload(raw);
  if (!payload || typeof payload.assetType !== 'string') {
    return raw;
  }
  return resolveManifestBytes(target, payload, fetchImpl);
}

export = {
  loadOnnxAssetSource
};
