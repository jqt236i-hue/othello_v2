import {
  assertHardwareAcceleratedGraphics,
  createDesktopChromiumLaunchOptions,
  normalizeChromiumGraphicsInfo
} from '../scripts/browser-performance-environment';

describe('desktop browser performance environment', () => {
  test('requests D3D11 on Windows without forcing unsupported flags elsewhere', () => {
    expect(createDesktopChromiumLaunchOptions('win32')).toEqual({
      headless: true,
      args: ['--use-gl=angle', '--use-angle=d3d11']
    });
    expect(createDesktopChromiumLaunchOptions('linux')).toEqual({ headless: true });
  });

  test('requires both a non-software renderer and enabled GPU features', () => {
    const hardware = normalizeChromiumGraphicsInfo({
      gpu: {
        auxAttributes: {
          glRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2070, D3D11)',
          glVendor: 'Google Inc. (NVIDIA)',
          displayType: 'ANGLE_D3D11'
        },
        featureStatus: { gpu_compositing: 'enabled', webgl: 'enabled_on' },
        devices: [{ vendorId: 4318, deviceId: 7815, deviceString: 'RTX', driverVendor: 'NVIDIA', driverVersion: '1' }]
      }
    });
    expect(hardware).toMatchObject({ hardwareAccelerated: true, displayType: 'ANGLE_D3D11' });
    expect(() => assertHardwareAcceleratedGraphics(hardware)).not.toThrow();

    const software = normalizeChromiumGraphicsInfo({
      gpu: {
        auxAttributes: {
          glRenderer: 'ANGLE (Google, Vulkan SwiftShader Device)',
          glVendor: 'Google Inc.'
        },
        featureStatus: { gpu_compositing: 'enabled', webgl: 'enabled' }
      }
    });
    expect(software.hardwareAccelerated).toBe(false);
    expect(() => assertHardwareAcceleratedGraphics(software)).toThrow(/SwiftShader/);
  });
});
