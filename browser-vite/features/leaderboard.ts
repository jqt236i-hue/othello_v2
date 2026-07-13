import { loadOptionalFeatureRegistry, type OptionalFeatureContext } from './feature-registry';

export function loadOptionalFeature(context: OptionalFeatureContext): Promise<boolean> {
  return loadOptionalFeatureRegistry('leaderboard', context, ['ui/leaderboard-client']);
}
