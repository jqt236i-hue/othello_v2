/** Opt-in compression of WebSocket stream frames.
 *
 * Cloudflare Workers WebSockets do not negotiate permessage-deflate, so a
 * client that can decompress asks for it with the `frameCompression` query
 * parameter. The Worker then sends every stream event (the same SSE envelope
 * text, one event per frame) as a raw-deflate binary frame; health responses
 * stay text. Clients that do not ask keep the uncompressed text frames. */

export const MATCH_STREAM_FRAME_COMPRESSION = 'deflate-raw' as const;
export type MatchStreamFrameCompression = typeof MATCH_STREAM_FRAME_COMPRESSION;

export function normalizeMatchStreamFrameCompression(value: unknown): MatchStreamFrameCompression | null {
    return value === MATCH_STREAM_FRAME_COMPRESSION ? MATCH_STREAM_FRAME_COMPRESSION : null;
}

type StreamRoot = {
    CompressionStream?: new (format: string) => any;
    DecompressionStream?: new (format: string) => any;
    Response?: typeof Response;
    Blob?: typeof Blob;
};

function readRoot(root?: StreamRoot | null): StreamRoot {
    return root || (globalThis as unknown as StreamRoot);
}

function supports(ctor: (new (format: string) => any) | undefined): boolean {
    if (typeof ctor !== 'function') return false;
    try {
        // Older engines expose the constructor without the raw deflate format.
        new ctor(MATCH_STREAM_FRAME_COMPRESSION);
        return true;
    } catch (_error) {
        return false;
    }
}

export function canDecompressMatchStreamFrames(root?: StreamRoot | null): boolean {
    const scope = readRoot(root);
    return supports(scope.DecompressionStream) && typeof scope.Response === 'function' && typeof scope.Blob === 'function';
}

export function canCompressMatchStreamFrames(root?: StreamRoot | null): boolean {
    const scope = readRoot(root);
    return supports(scope.CompressionStream) && typeof scope.Response === 'function' && typeof scope.Blob === 'function';
}

async function transform(bytes: BufferSource, stream: any, root: StreamRoot): Promise<ArrayBuffer> {
    const source = new root.Blob!([bytes]).stream().pipeThrough(stream);
    return new root.Response!(source).arrayBuffer();
}

export async function compressMatchStreamFrame(bytes: Uint8Array, root?: StreamRoot | null): Promise<ArrayBuffer> {
    const scope = readRoot(root);
    return transform(bytes as BufferSource, new scope.CompressionStream!(MATCH_STREAM_FRAME_COMPRESSION), scope);
}

export async function decompressMatchStreamFrame(frame: ArrayBuffer | ArrayBufferView, root?: StreamRoot | null): Promise<string> {
    const scope = readRoot(root);
    const bytes = await transform(frame as BufferSource, new scope.DecompressionStream!(MATCH_STREAM_FRAME_COMPRESSION), scope);
    return new TextDecoder().decode(bytes);
}
