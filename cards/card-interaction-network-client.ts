export {};

function getNetworkMatchClientRoot() {
    if (typeof window !== 'undefined' && window && (window as any).NetworkMatchClient) {
        return window;
    }
    return (typeof globalThis !== 'undefined' && globalThis && (globalThis as any).NetworkMatchClient)
        ? globalThis
        : null;
}

function getActiveNetworkMatchClient() {
    const networkRoot = getNetworkMatchClientRoot();
    const networkClient = networkRoot ? (networkRoot as any).NetworkMatchClient : null;
    if (!networkClient) return null;
    if (typeof networkClient.publishSnapshot !== 'function') return null;
    if (typeof networkClient.isActive !== 'function' || networkClient.isActive() !== true) return null;
    return networkClient;
}

function isNetworkSpectatorActive(): boolean {
    const networkClient = getActiveNetworkMatchClient();
    try {
        return !!(networkClient && typeof networkClient.isSpectator === 'function' && networkClient.isSpectator() === true);
    } catch (e) {
        return false;
    }
}

function publishNetworkDebugFillHand() {
    const networkClient = getActiveNetworkMatchClient();
    if (!networkClient) return null;
    try {
        return networkClient.publishSnapshot({
            actionType: 'debug_fill_hand',
            playbackEvents: [],
            action: { type: 'debug_fill_hand' }
        });
    } catch (e) {
        return Promise.reject(e);
    }
}

module.exports = {
    getNetworkMatchClientRoot,
    getActiveNetworkMatchClient,
    isNetworkSpectatorActive,
    publishNetworkDebugFillHand
};
