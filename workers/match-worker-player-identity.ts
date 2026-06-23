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

type IdentityStore = {
    version: 1;
    records: Record<string, IdentityRecord>;
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

    async function loadStore(): Promise<IdentityStore> {
        const raw = await cfg.storage.get(cfg.storageKey);
        const source = raw && typeof raw === 'object' ? raw as Partial<IdentityStore> : {};
        return {
            version: 1,
            records: source.records && typeof source.records === 'object' ? source.records : {}
        };
    }

    async function saveStore(store: IdentityStore): Promise<void> {
        await cfg.storage.put(cfg.storageKey, store);
    }

    async function handleCreate(): Promise<Response> {
        const store = await loadStore();
        let playerId = makePlayerId(cryptoLike);
        while (store.records[playerId]) playerId = makePlayerId(cryptoLike);

        const playerToken = makePlayerToken(cryptoLike);
        const recoveryCode = makeRecoveryCode(cryptoLike);
        const timestamp = now();
        store.records[playerId] = {
            playerId,
            tokenHash: await sha256Hex(playerToken, cryptoLike),
            recoveryHash: await sha256Hex(recoveryCode, cryptoLike),
            createdAt: timestamp,
            updatedAt: timestamp,
            lastSeenAt: timestamp
        };
        await saveStore(store);
        return cfg.jsonResponse(200, { ok: true, playerId, playerToken, recoveryCode, serverTime: timestamp });
    }

    async function handleVerify(body: Record<string, unknown>): Promise<Response> {
        const playerId = Contract.normalizePlayerId(body.playerId);
        const playerToken = Contract.normalizePlayerToken(body.playerToken);
        if (!playerId || !playerToken) return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });

        const store = await loadStore();
        const record = store.records[playerId];
        const tokenHash = await sha256Hex(playerToken, cryptoLike);
        if (!record || !equalHex(record.tokenHash, tokenHash)) {
            return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        }
        record.lastSeenAt = now();
        record.updatedAt = record.lastSeenAt;
        await saveStore(store);
        return cfg.jsonResponse(200, { ok: true, playerId, serverTime: record.lastSeenAt });
    }

    async function handleRecover(body: Record<string, unknown>): Promise<Response> {
        const recoveryCode = Contract.normalizeRecoveryCode(body.recoveryCode);
        if (!recoveryCode) return cfg.jsonResponse(403, { ok: false, reason: 'RECOVERY_CODE_INVALID' });

        const recoveryHash = await sha256Hex(recoveryCode, cryptoLike);
        const store = await loadStore();
        const record = Object.values(store.records).find((entry) => equalHex(entry.recoveryHash, recoveryHash));
        if (!record) return cfg.jsonResponse(403, { ok: false, reason: 'RECOVERY_CODE_INVALID' });

        const playerToken = makePlayerToken(cryptoLike);
        const nextRecoveryCode = makeRecoveryCode(cryptoLike);
        record.tokenHash = await sha256Hex(playerToken, cryptoLike);
        record.recoveryHash = await sha256Hex(nextRecoveryCode, cryptoLike);
        record.updatedAt = now();
        record.lastSeenAt = record.updatedAt;
        await saveStore(store);
        return cfg.jsonResponse(200, {
            ok: true,
            playerId: record.playerId,
            playerToken,
            recoveryCode: nextRecoveryCode,
            serverTime: record.updatedAt
        });
    }

    return {
        handleCreate,
        handleVerify,
        handleRecover
    };
}
