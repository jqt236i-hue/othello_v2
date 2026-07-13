import { loadOptionalFeatureRegistry, type OptionalFeatureContext } from './feature-registry';

// Commentary remains eager because it is enabled by default. The empty adapter preserves a
// stable group contract for a future first-action shell without changing current speech timing.
export function loadOptionalFeature(context: OptionalFeatureContext): Promise<boolean> {
  return loadOptionalFeatureRegistry('commentary', context);
}
