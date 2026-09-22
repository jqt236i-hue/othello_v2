import { createBattleStorage, type BattleStoragePort } from '../../shared/battle/storage';

/** Shared Web Lock protects the commit manifest across tabs. No unsafe fallback. */
export function createBrowserBattleStorage(prefix: string, storage: Storage = localStorage, locks: LockManager = navigator.locks) {
    if (!locks) throw new Error('Exclusive browser save locks are unavailable');
    const port: BattleStoragePort = {
        read: key => storage.getItem(key),
        write: (key, value) => storage.setItem(key, value),
        exclusive: (key, work) => locks.request(`card-reversi:${key}`, work)
    };
    return createBattleStorage(port, prefix);
}
