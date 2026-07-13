import { loadOptionalFeatureRegistry, type OptionalFeatureContext } from './feature-registry';

export function loadOptionalFeature(context: OptionalFeatureContext): Promise<boolean> {
  return loadOptionalFeatureRegistry('gacha', context, [
    'ui/gacha/gacha-overlay-controller',
    'ui/gacha/gacha-overlay-view'
  ]);
}
