import type { DurableObjectStateLike } from './match-worker-types';

const Contract = require('../shared/player-identity-contract');

type IdentityRecord = {
    playerId: string;
    tokenHash: string;
    recoveryHash: string;
    createdAt: number;
    updatedAt: number;
    lastSeenAt: number;
};

type IdentityControllerConfig = {
    storage: DurableObjectStateLike['storage'];
    storageKey: string;
    jsonResponse: (statusCode: number, payload: unknown) => Response;
    now?: () => number;
    crypto?: Crypto;
};

const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const RECOVERY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ234567';

function randomFromChars(chars: string, length: number, cryptoLike: Crypto): string {
    const bytes = new Uint8Array(length);
    cryptoLike.getRandomValues(bytes);
    return Array.from(bytes).map((byte) => chars[byte % chars.length]).join('');
}

async function sha256Hex(value: string, cryptoLike: Crypto): Promise<string> {
    const data = new TextEncoder().encode(value);
    const digest = await cryptoLike.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function equalHex(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let i = 0; i < left.length; i += 1) {
        diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
    }
    return diff === 0;
}

function makePlayerId(cryptoLike: Crypto): string {
    return `p_${randomFromChars(TOKEN_CHARS, 26, cryptoLike)}`;
}

function makePlayerToken(cryptoLike: Crypto): string {
    return `pt_${randomFromChars(TOKEN_CHARS, 43, cryptoLike)}`;
}

function makeRecoveryCode(cryptoLike: Crypto): string {
    const raw = randomFromChars(RECOVERY_CHARS, 25, cryptoLike);
    return `CR-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}-${raw.slice(20, 25)}`;
}

export function createMatchWorkerPlayerIdentityController(config: IdentityControllerConfig) {
    const cfg = config;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();
    const cryptoLike = cfg.crypto || globalThis.crypto;

    function identityKey(playerId: string): string {
        return `${cfg.storageKey}:identity:${playerId}`;
    }

    function recoveryKey(recoveryHash: string): string {
        return `${cfg.storageKey}:recovery:${recoveryHash}`;
    }

    function normalizeRecord(value: unknown): IdentityRecord | null {
        const source = value && typeof value === 'object' ? value as Partial<IdentityRecord> : {};
        const playerId = Contract.normalizePlayerId(source.playerId);
        const tokenHash = String(source.tokenHash || '').trim();
        const recoveryHash = String(source.recoveryHash || '').trim();
        if (!playerId || !tokenHash || !recoveryHash) return null;
        return {
            playerId,
            tokenHash,
            recoveryHash,
            createdAt: Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : 0,
            updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : 0,
            lastSeenAt: Number.isFinite(Number(source.lastSeenAt)) ? Number(source.lastSeenAt) : 0
        };
    }

    async function loadRecord(playerId: string): Promise<IdentityRecord | null> {
        return normalizeRecord(await cfg.storage.get(identityKey(playerId)));
    }

    async function saveRecord(record: IdentityRecord): Promise<void> {
        await cfg.storage.put(identityKey(record.playerId), record);
    }

    async function saveRecoveryIndex(recoveryHash: string, playerId: string): Promise<void> {
        await cfg.storage.put(recoveryKey(recoveryHash), playerId);
    }

    async function deleteRecoveryIndex(recoveryHash: string): Promise<void> {
        await cfg.storage.delete(recoveryKey(recoveryHash));
    }

    async function loadRecoveryPlayerId(recoveryHash: string): Promise<string | null> {
        const raw = await cfg.storage.get(recoveryKey(recoveryHash));
        return Contract.normalizePlayerId(raw);
    }

    async function handleCreate(): Promise<Response> {
        let playerId = makePlayerId(cryptoLike);
        while (await loadRecord(playerId)) playerId = makePlayerId(cryptoLike);

        const playerToken = makePlayerToken(cryptoLike);
        const recoveryCode = makeRecoveryCode(cryptoLike);
        const timestamp = now();
        const record = {
            playerId,
            tokenHash: await sha256Hex(playerToken, cryptoLike),
            recoveryHash: await sha256Hex(recoveryCode, cryptoLike),
            createdAt: timestamp,
            updatedAt: timestamp,
            lastSeenAt: timestamp
        };
        await saveRecord(record);
        await saveRecoveryIndex(record.recoveryHash, playerId);
        return cfg.jsonResponse(200, { ok: true, playerId, playerToken, recoveryCode, serverTime: timestamp });
    }

    async function handleVerify(body: Record<string, unknown>): Promise<Response> {
        const playerId = Contract.normalizePlayerId(body.playerId);
        const playerToken = Contract.normalizePlayerToken(body.playerToken);
        if (!playerId || !playerToken) return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });

        const record = await loadRecord(playerId);
        const tokenHash = await sha256Hex(playerToken, cryptoLike);
        if (!record || !equalHex(record.tokenHash, tokenHash)) {
            return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        }
        record.lastSeenAt = now();
        record.updatedAt = record.lastSeenAt;
        await saveRecord(record);
        return cfg.jsonResponse(200, { ok: true, playerId, serverTime: record.lastSeenAt });
    }

    async function handleRecover(body: Record<string, unknown>): Promise<Response> {
        const recoveryCode = Contract.normalizeRecoveryCode(body.recoveryCode);
        if (!recoveryCode) return cfg.jsonResponse(403, { ok: false, reason: 'RECOVERY_CODE_INVALID' });

        const recoveryHash = await sha256Hex(recoveryCode, cryptoLike);
        const playerId = await loadRecoveryPlayerId(recoveryHash);
        const record = playerId ? await loadRecord(playerId) : null;
        if (!record || !equalHex(record.recoveryHash, recoveryHash)) {
            return cfg.jsonResponse(403, { ok: false, reason: 'RECOVERY_CODE_INVALID' });
        }

        const playerToken = makePlayerToken(cryptoLike);
        const nextRecoveryCode = makeRecoveryCode(cryptoLike);
        const previousRecoveryHash = record.recoveryHash;
        record.tokenHash = await sha256Hex(playerToken, cryptoLike);
        record.recoveryHash = await sha256Hex(nextRecoveryCode, cryptoLike);
        record.updatedAt = now();
        record.lastSeenAt = record.updatedAt;
        await saveRecord(record);
        await deleteRecoveryIndex(previousRecoveryHash);
        await saveRecoveryIndex(record.recoveryHash, record.playerId);
        return cfg.jsonResponse(200, {
            ok: true,
            playerId: record.playerId,
            playerToken,
            recoveryCode: nextRecoveryCode,
            serverTime: record.updatedAt
        });
    }

    async function handleRegenerateRecovery(body: Record<string, unknown>): Promise<Response> {
        const playerId = Contract.normalizePlayerId(body.playerId);
        const playerToken = Contract.normalizePlayerToken(body.playerToken);
        if (!playerId || !playerToken) {
            return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        }

        const record = await loadRecord(playerId);
        const tokenHash = await sha256Hex(playerToken, cryptoLike);
        if (!record || !equalHex(record.tokenHash, tokenHash)) {
            return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        }

        const previousRecoveryHash = record.recoveryHash;
        const recoveryCode = makeRecoveryCode(cryptoLike);
        record.recoveryHash = await sha256Hex(recoveryCode, cryptoLike);
        record.updatedAt = now();
        record.lastSeenAt = record.updatedAt;
        await saveRecord(record);
        await deleteRecoveryIndex(previousRecoveryHash);
        await saveRecoveryIndex(record.recoveryHash, playerId);
        return cfg.jsonResponse(200, {
            ok: true,
            playerId,
            recoveryCode,
            serverTime: record.updatedAt
        });
    }

    return {
        handleCreate,
        handleVerify,
        handleRecover,
        handleRegenerateRecovery
    };
}
