import { loadOptionalFeatureRegistry, type OptionalFeatureContext } from './feature-registry';

export function loadOptionalFeature(context: OptionalFeatureContext): Promise<boolean> {
  return loadOptionalFeatureRegistry('cosmetic', context, [
    'ui/background-skin/controller',
    'ui/font-skin/controller',
    'ui/hand-skin/controller'
  ]);
}
