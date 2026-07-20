import {
  classifyWebGlRenderer,
  isExplicitSoftwareWebGlRenderer,
  normalizeWebGlRendererText
} from '../shared/webgl-renderer-classification';

describe('WebGL renderer classification', () => {
  test.each([
    ['ANGLE (Google, Vulkan 1.3 SwiftShader Device)', 'Google Inc.'],
    ['llvmpipe (LLVM 17.0.0, 256 bits)', 'Mesa'],
    ['softpipe', 'Mesa'],
    ['Microsoft Basic Render Driver', 'Microsoft']
  ])('classifies explicit software renderer %s', (renderer, vendor) => {
    expect(classifyWebGlRenderer(renderer, vendor)).toMatchObject({
      renderer,
      vendor,
      kind: 'explicit-software',
      explicitSoftware: true
    });
    expect(isExplicitSoftwareWebGlRenderer(renderer, vendor)).toBe(true);
  });

  test.each([
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 2070, D3D11)', 'Google Inc. (NVIDIA)'],
    ['', ''],
    [null, undefined],
    ['WebKit WebGL', 'WebKit']
  ])('does not guess that hardware or unknown renderer %p is software', (renderer, vendor) => {
    expect(classifyWebGlRenderer(renderer, vendor)).toMatchObject({
      kind: 'other-or-unknown',
      explicitSoftware: false
    });
  });

  test('normalizes disclosure text without retaining unbounded input', () => {
    expect(normalizeWebGlRendererText('  NVIDIA  ')).toBe('NVIDIA');
    expect(normalizeWebGlRendererText('x'.repeat(600))).toHaveLength(512);
  });
});
