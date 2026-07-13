import { loadOptionalFeatureRegistry, type OptionalFeatureContext } from './feature-registry';

export function loadOptionalFeature(context: OptionalFeatureContext): Promise<boolean> {
  return loadOptionalFeatureRegistry('cpu', context, ['othello-ai/runtime/browser-cpu']);
}
