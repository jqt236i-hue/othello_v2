import { loadOptionalFeatureRegistry, type OptionalFeatureContext } from './feature-registry';

export function loadOptionalFeature(context: OptionalFeatureContext): Promise<boolean> {
  return loadOptionalFeatureRegistry('onnx', context, [
    'game/ai/othello-onnx-runtime',
    'game/ai/policy-onnx-runtime'
  ]);
}
