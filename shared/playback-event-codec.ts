// Lossless JSON tree encoding: repeated object keys are stored once.
// Arrays are tagged so event data can never be mistaken for a reference.
export interface PackedPlaybackEvents { keys: string[]; tree: unknown; }
const MAX_NODES = 100000;
const MAX_DEPTH = 64;

export function packPlaybackEvents(events: unknown[]): PackedPlaybackEvents | null {
  const keys: string[] = [];
  const index = new Map<string, number>();
  let nodes = 0;
  function encode(value: unknown, depth: number): unknown {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new Error('playback_codec_limit');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return [1, ...value.map(item => encode(item, depth + 1))];
    if (value && typeof value === 'object' && Object.prototype.toString.call(value) === '[object Object]'
        && (Object.getPrototypeOf(value) === null || Object.getPrototypeOf(Object.getPrototypeOf(value)) === null)) {
      const result: unknown[] = [0];
      for (const [key, item] of Object.entries(value)) {
        let id = index.get(key);
        if (id === undefined) { id = keys.length; keys.push(key); index.set(key, id); }
        result.push(id, encode(item, depth + 1));
      }
      return result;
    }
    throw new Error('playback_codec_non_json');
  }
  try { return { keys, tree: encode(events, 0) }; } catch (_) { return null; }
}

export function unpackPlaybackEvents(value: unknown): unknown[] {
  const packed = value as PackedPlaybackEvents;
  if (!packed || !Array.isArray(packed.keys) || packed.keys.length > MAX_NODES
      || packed.keys.some(key => typeof key !== 'string') || new Set(packed.keys).size !== packed.keys.length) {
    throw new Error('playback_codec_dictionary_invalid');
  }
  let nodes = 0;
  function decode(node: unknown, depth: number): unknown {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new Error('playback_codec_limit');
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return node;
    if (typeof node === 'number' && Number.isFinite(node)) return node;
    if (!Array.isArray(node)) throw new Error('playback_codec_node_invalid');
    if (node[0] === 1) return node.slice(1).map(item => decode(item, depth + 1));
    if (node[0] !== 0 || node.length % 2 !== 1) throw new Error('playback_codec_object_invalid');
    const result: Record<string, unknown> = {};
    for (let i = 1; i < node.length; i += 2) {
      const id = node[i];
      if (!Number.isInteger(id) || id < 0 || id >= packed.keys.length) throw new Error('playback_codec_key_invalid');
      const key = packed.keys[id];
      if (Object.prototype.hasOwnProperty.call(result, key)) throw new Error('playback_codec_duplicate_key');
      Object.defineProperty(result, key, { value: decode(node[i + 1], depth + 1), enumerable: true, writable: true, configurable: true });
    }
    return result;
  }
  const events = decode(packed.tree, 0);
  if (!Array.isArray(events)) throw new Error('playback_codec_events_required');
  return events;
}
