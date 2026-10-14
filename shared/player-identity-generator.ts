// Player identity credential generation shared by the Worker and the local match server.
// Charsets, lengths, and formats live here together with an unbiased (rejection-sampling) mapping
// from cryptographic random bytes to characters. Each runtime injects its own CSPRNG
// (Node `crypto.randomBytes`, Web Crypto `getRandomValues`); persistence stays in the adapters.
// Never feed this from Math.random.

export const PLAYER_ID_TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
export const RECOVERY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ234567';
export const PLAYER_ID_RANDOM_LENGTH = 26;
export const PLAYER_TOKEN_RANDOM_LENGTH = 43;
export const RECOVERY_CODE_RANDOM_LENGTH = 25;
const RECOVERY_CODE_GROUP_LENGTH = 5;
const MIN_RANDOM_BATCH = 16;

/** Returns `count` cryptographically secure random bytes. */
export type RandomByteSource = (count: number) => ArrayLike<number>;

/** Largest byte value (exclusive) that maps uniformly onto `charsetLength` characters. */
export function unbiasedByteLimit(charsetLength: number): number {
    return Math.floor(256 / charsetLength) * charsetLength;
}

export function randomStringFromBytes(chars: string, length: number, nextBytes: RandomByteSource): string {
    if (!chars || !Number.isInteger(length) || length <= 0) return '';
    if (chars.length > 256) throw new Error('randomStringFromBytes charset must contain at most 256 characters.');
    if (typeof nextBytes !== 'function') throw new Error('randomStringFromBytes requires a cryptographic byte source.');
    const limit = unbiasedByteLimit(chars.length);
    let out = '';
    while (out.length < length) {
        const bytes = nextBytes(Math.max(MIN_RANDOM_BATCH, length - out.length));
        if (!bytes || bytes.length <= 0) throw new Error('randomStringFromBytes byte source returned no bytes.');
        for (let index = 0; index < bytes.length && out.length < length; index += 1) {
            const byte = Number(bytes[index]);
            // Bytes at or above the limit would over-represent the first characters; discard them.
            if (byte >= limit) continue;
            out += chars[byte % chars.length];
        }
    }
    return out;
}

export function makePlayerId(nextBytes: RandomByteSource): string {
    return `p_${randomStringFromBytes(PLAYER_ID_TOKEN_CHARS, PLAYER_ID_RANDOM_LENGTH, nextBytes)}`;
}

export function makePlayerToken(nextBytes: RandomByteSource): string {
    return `pt_${randomStringFromBytes(PLAYER_ID_TOKEN_CHARS, PLAYER_TOKEN_RANDOM_LENGTH, nextBytes)}`;
}

export function makeRecoveryCode(nextBytes: RandomByteSource): string {
    const raw = randomStringFromBytes(RECOVERY_CODE_CHARS, RECOVERY_CODE_RANDOM_LENGTH, nextBytes);
    const groups: string[] = [];
    for (let index = 0; index < raw.length; index += RECOVERY_CODE_GROUP_LENGTH) {
        groups.push(raw.slice(index, index + RECOVERY_CODE_GROUP_LENGTH));
    }
    return `CR-${groups.join('-')}`;
}
