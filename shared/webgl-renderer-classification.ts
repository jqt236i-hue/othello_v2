export type WebGlRendererKind = 'explicit-software' | 'other-or-unknown';

export interface WebGlRendererClassification {
  readonly renderer: string;
  readonly vendor: string;
  readonly kind: WebGlRendererKind;
  readonly explicitSoftware: boolean;
}

const SOFTWARE_WEBGL_RENDERER_PATTERN = /swiftshader|llvmpipe|softpipe|software(?:\s+rasterizer)?|microsoft basic render driver/i;
const MAX_RENDERER_TEXT_LENGTH = 512;

export function normalizeWebGlRendererText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim().slice(0, MAX_RENDERER_TEXT_LENGTH);
}

export function classifyWebGlRenderer(
  rendererValue: unknown,
  vendorValue: unknown
): WebGlRendererClassification {
  const renderer = normalizeWebGlRendererText(rendererValue);
  const vendor = normalizeWebGlRendererText(vendorValue);
  const explicitSoftware = SOFTWARE_WEBGL_RENDERER_PATTERN.test(`${renderer} ${vendor}`);
  return Object.freeze({
    renderer,
    vendor,
    kind: explicitSoftware ? 'explicit-software' : 'other-or-unknown',
    explicitSoftware
  });
}

export function isExplicitSoftwareWebGlRenderer(
  rendererValue: unknown,
  vendorValue: unknown
): boolean {
  return classifyWebGlRenderer(rendererValue, vendorValue).explicitSoftware;
}
