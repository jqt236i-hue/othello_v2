import { parseBattleSave, serializeBattleSave, BattleSaveCompatibilityError, type BattleSave } from './save';

/** Each key write must be atomic. The host supplies an exclusive lock covering all
 * writers (Web Locks in the browser, a single owner/file lock on desktop). */
export interface BattleStoragePort {
    read(key: string): string | null | Promise<string | null>;
    write(key: string, value: string): void | Promise<void>;
    exclusive<T>(key: string, work: () => Promise<T>): Promise<T>;
}
export type StorageResult<T> = { ok: true; value: T; recovered?: boolean } | { ok: false; error: string };
type Manifest = { version: 1; current: 'a' | 'b'; previous: 'a' | 'b' | null };

export function createBattleStorage(port: BattleStoragePort, prefix: string) {
    if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(prefix)) throw new Error('Invalid save slot key');
    if (!port || typeof port.exclusive !== 'function') throw new Error('An exclusive save owner is required');
    const readManifest = async (): Promise<Manifest | null> => {
        const text = await port.read(`${prefix}:manifest`);
        if (text === null) return null;
        const value = JSON.parse(text);
        if (value?.version !== 1 || !['a', 'b'].includes(value.current)
            || (value.previous !== null && (!['a', 'b'].includes(value.previous) || value.current === value.previous))) throw new Error('Invalid save manifest');
        return value;
    };
    return {
        async save(value: BattleSave): Promise<StorageResult<BattleSave>> {
            try {
                const serialized = serializeBattleSave(value);
                return await port.exclusive(prefix, async () => {
                    const previous = await readManifest();
                    let validSlot: 'a' | 'b' | null = null;
                    if (previous) {
                        for (const candidate of [previous.current, previous.previous]) {
                            if (!candidate) continue;
                            const existing = await port.read(`${prefix}:${candidate}`);
                            try { if (existing !== null) { parseBattleSave(existing); validSlot = candidate; break; } }
                            catch (error) { if (error instanceof BattleSaveCompatibilityError) throw error; }
                        }
                        // Do not overwrite an incompatible or wholly damaged save implicitly.
                        if (!validSlot) throw new Error('No compatible save generation; use a new slot');
                    }
                    if (previous && validSlot !== previous.current) {
                        // First repoint the manifest to the recovered generation. Otherwise
                        // overwriting its broken current slot would publish before commit.
                        await port.write(`${prefix}:manifest`, JSON.stringify({ version: 1, current: validSlot, previous: null }));
                    }
                    const slot = validSlot === 'a' ? 'b' : 'a';
                    await port.write(`${prefix}:${slot}`, serialized);
                    if (await port.read(`${prefix}:${slot}`) !== serialized) throw new Error('Save verification failed');
                    await port.write(`${prefix}:manifest`, JSON.stringify({ version: 1, current: slot, previous: validSlot }));
                    return { ok: true as const, value: parseBattleSave(serialized) };
                });
            } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Save failed' }; }
        },
        async load(): Promise<StorageResult<BattleSave | null>> {
            try {
                return await port.exclusive(prefix, async () => {
                    const manifest = await readManifest();
                    if (!manifest) return { ok: true as const, value: null };
                    let failure: unknown;
                    for (const slot of [manifest.current, manifest.previous]) {
                        if (!slot) continue;
                        try {
                            const text = await port.read(`${prefix}:${slot}`);
                            if (text === null) throw new Error('Save data is missing');
                            return { ok: true as const, value: parseBattleSave(text), recovered: slot !== manifest.current };
                        } catch (error) { if (error instanceof BattleSaveCompatibilityError) throw error; failure = error; }
                    }
                    throw failure;
                });
            } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Load failed' }; }
        }
    };
}
