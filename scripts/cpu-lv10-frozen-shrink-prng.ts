/** Align the captured browser's real shrink actions with the shared canonical
 * RNG repair. Its CPU search/model and hypothetical evaluations stay intact. */
export function installFrozenShrinkActionPrng(): void {
    const root = window as any;
    const shrink = root.require('game/logic/cards/shrink');
    for (const name of ['applyBoardShrinkWill', 'applyBoardShrinkGod']) {
        const original = shrink[name];
        if (typeof original !== 'function') throw new Error(`Frozen shrink runtime missing ${name}`);
        shrink[name] = function(cs: any, gs: any, player: any, row: any, col: any, deps: any) {
            const attempt = root.__frozenLv9Oracle?.canonicalAttempt;
            const random = cs?._boardOpsRandomSource;
            if (attempt && random && typeof random.random === 'function') {
                attempt.shrinkActionPrngInjected = true;
                return original.call(this, cs, gs, player, row, col, { ...deps, random });
            }
            return original.call(this, cs, gs, player, row, col, deps);
        };
    }
}
