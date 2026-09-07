/** Limit the production safeguard to one seat for a paired comparison. */
export function installTacticalSafetyExperiment(options: { color: string }) {
    const root = window as any, safety = root.require('game/ai/cpu-tactical-safety');
    root.__cardHoldEvents = [];
    for (const name of ['avoidTacticalBlunder', 'shouldHoldTacticallyUnsafeCard']) {
        const original = safety[name];
        safety[name] = (input: any) => {
            if (input.playerKey !== options.color) return { selected: input.selected, changed: false, hold: false, reason: 'comparison_baseline' };
            const before = JSON.stringify({ gs: root.gameState, cs: root.cardState, rng: root.require('card-system').getGamePrng().getState() });
            const start = performance.now(), result = original(input);
            const after = JSON.stringify({ gs: root.gameState, cs: root.cardState, rng: root.require('card-system').getGamePrng().getState() });
            root.__cardHoldEvents.push({ player: input.playerKey, kind: name, changed: result.changed || result.hold, result,
                ...(result.changed || result.hold ? { before: JSON.parse(before) } : {}),
                liveUnchanged: before === after, extraMs: performance.now() - start });
            return result;
        };
    }
}
