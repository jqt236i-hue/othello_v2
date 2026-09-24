import { applyLv10Action, enumerateLv10Actions, sampleLv10Position, cloneLv10, currentLv10Player } from '../game/ai/cpu-lv10-position';
import { LV10_SEARCH_CONFIG } from '../game/ai/cpu-lv10-search';
import StateHash = require('../shared/state-hash');

const Pipeline: any = require('../game/turn/turn_pipeline');
const Prng: any = require('../game/schema/prng');

const FIXTURES = ['cpu-lv11-capture-risk', 'cpu-lv11-sparse-endgame', 'cpu-lv12-free-placement', 'cpu-lv12-sparse-card-threat']
    .map((name) => require(`./fixtures/${name}.json`));

/** Search transitions skip the full-state stable hash that the shared pipeline
 * computes for every accepted action. The hash is never returned, so the
 * transition must equal the shared pipeline's, and hashing the reached state
 * must not be a hidden rejection path (the pipeline maps a hashing failure to
 * a rejected action). */
test('hash-free search transitions equal the canonical pipeline and never hide a hashing rejection', () => {
    let compared = 0;
    for (const fixture of FIXTURES) {
        for (const seed of LV10_SEARCH_CONFIG.scenarioSeeds) {
            const position = sampleLv10Position(fixture.observation, seed, fixture.publicRecipes);
            for (const action of enumerateLv10Actions(position).slice(0, 10)) {
                const before = JSON.stringify(position);
                const searched = applyLv10Action(position, action);
                const copy = cloneLv10(position);
                const rng = Prng.fromState(copy.prngState);
                const canonical = Pipeline.applyTurnSafe(copy.cardState, copy.gameState, currentLv10Player(copy), cloneLv10(action), rng,
                    { skipTurnStart: true });
                expect(JSON.stringify(position)).toBe(before);
                expect(searched.ok).toBe(canonical.ok);
                if (!canonical.ok) continue;
                expect(typeof canonical.stateHash).toBe('string');
                expect(() => StateHash.computeStableHash({ gameState: searched.state!.gameState, cardState: searched.state!.cardState })).not.toThrow();
                expect(JSON.stringify(searched.state!.gameState)).toBe(JSON.stringify(canonical.gameState));
                expect(searched.state!.prngState).toEqual(rng.getState());
                compared++;
            }
        }
    }
    expect(compared).toBeGreaterThan(20);
});
