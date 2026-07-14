import * as commentaryFeature from './features/commentary';
import * as cosmeticFeature from './features/cosmetic';
import * as cpuFeature from './features/cpu';
import * as gachaFeature from './features/gacha';
import * as leaderboardFeature from './features/leaderboard';
import * as onnxFeature from './features/onnx';
import type { OptionalFeatureGroup } from './features/feature-registry';
import type { FeatureAdapter } from './optional-feature-loader';

// Keep adapter modules in the stable startup chunk. The heavier feature
// payloads remain self-contained optional bundles, so a failed network import
// can be retried with a fresh URL without inheriting a poisoned child chunk.
export const FEATURE_IMPORTS: Record<OptionalFeatureGroup, () => Promise<FeatureAdapter>> = {
  gacha: () => Promise.resolve(gachaFeature),
  cosmetic: () => Promise.resolve(cosmeticFeature),
  leaderboard: () => Promise.resolve(leaderboardFeature),
  commentary: () => Promise.resolve(commentaryFeature),
  cpu: () => Promise.resolve(cpuFeature),
  onnx: () => Promise.resolve(onnxFeature)
};
