import { chromium, type Browser } from 'playwright';

import { isExplicitSoftwareWebGlRenderer } from '../shared/webgl-renderer-classification';

export interface DesktopGraphicsEnvironment {
  readonly hardwareAccelerated: boolean;
  readonly glRenderer: string;
  readonly glVendor: string;
  readonly displayType: string;
  readonly gpuCompositing: string;
  readonly webgl: string;
  readonly devices: readonly Readonly<{
    vendorId: number;
    deviceId: number;
    deviceString: string;
    driverVendor: string;
    driverVersion: string;
  }>[];
}

export function createDesktopChromiumLaunchOptions(
  platform = process.platform
): Parameters<typeof chromium.launch>[0] {
  return platform === 'win32'
    ? { headless: true, args: ['--use-gl=angle', '--use-angle=d3d11'] }
    : { headless: true };
}

export function normalizeChromiumGraphicsInfo(value: any): DesktopGraphicsEnvironment {
  const gpu = value?.gpu || {};
  const auxiliary = gpu.auxAttributes || {};
  const featureStatus = gpu.featureStatus || {};
  const glRenderer = String(auxiliary.glRenderer || '');
  const glVendor = String(auxiliary.glVendor || '');
  const displayType = String(auxiliary.displayType || '');
  const gpuCompositing = String(featureStatus.gpu_compositing || '');
  const webgl = String(featureStatus.webgl || '');
  const hardwareAccelerated = glRenderer.length > 0
    && !isExplicitSoftwareWebGlRenderer(glRenderer, glVendor)
    && /^enabled/.test(gpuCompositing)
    && /^enabled/.test(webgl);
  const devices = Array.isArray(gpu.devices)
    ? gpu.devices.map((device: any) => Object.freeze({
      vendorId: Number(device?.vendorId) || 0,
      deviceId: Number(device?.deviceId) || 0,
      deviceString: String(device?.deviceString || ''),
      driverVendor: String(device?.driverVendor || ''),
      driverVersion: String(device?.driverVersion || '')
    }))
    : [];
  return Object.freeze({
    hardwareAccelerated,
    glRenderer,
    glVendor,
    displayType,
    gpuCompositing,
    webgl,
    devices: Object.freeze(devices)
  });
}

export async function readDesktopGraphicsEnvironment(
  browser: Browser
): Promise<DesktopGraphicsEnvironment> {
  const session = await browser.newBrowserCDPSession();
  try {
    return normalizeChromiumGraphicsInfo(await session.send('SystemInfo.getInfo'));
  } finally {
    await session.detach();
  }
}

export function assertHardwareAcceleratedGraphics(
  graphics: DesktopGraphicsEnvironment
): void {
  if (graphics.hardwareAccelerated) return;
  throw new Error(
    `Desktop performance capture requires hardware-accelerated WebGL; renderer=${graphics.glRenderer || 'unknown'}`
  );
}
