import * as fs from 'fs';
import * as path from 'path';

function readDefaultBgmVolume(filePath: string): number {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/bgmVolume:\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!match) {
    throw new Error(`Could not find default bgmVolume in ${filePath}`);
  }
  return Number(match[1]);
}

function readBgmOutputVolumeScale(filePath: string): number {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/bgmOutputVolumeScale:\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!match) {
    throw new Error(`Could not find bgmOutputVolumeScale in ${filePath}`);
  }
  return Number(match[1]);
}

function readBgmSliderMax(filePath: string): number {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/id="bgmVolSlider"[\s\S]*?max="([0-9]+(?:\.[0-9]+)?)"/);
  if (!match) {
    throw new Error(`Could not find bgmVolSlider max in ${filePath}`);
  }
  return Number(match[1]);
}

function readQuickVolumeSliderMax(filePath: string): number {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/id="seVolSlider"[\s\S]*?max="([0-9]+(?:\.[0-9]+)?)"/);
  if (!match) {
    throw new Error(`Could not find seVolSlider max in ${filePath}`);
  }
  return Number(match[1]);
}

function readBgmTrackSelectMaxWidthPx(filePath: string): number {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/id="bgmTrackSelect"[\s\S]*?style="[^"]*max-width:\s*([0-9]+)px/);
  if (!match) {
    throw new Error(`Could not find bgmTrackSelect max-width in ${filePath}`);
  }
  return Number(match[1]);
}

describe('SoundEngine bundle sync', () => {
  const EXPECTED_BGM_SLIDER_MAX = 1.35;

  test('source, dist, browser registry, and worker mirror share the same default BGM volume', () => {
    const rootDir = path.resolve(__dirname, '..');
    const expected = readDefaultBgmVolume(path.join(rootDir, 'sound-engine.ts'));

    expect(readDefaultBgmVolume(path.join(rootDir, 'dist', 'sound-engine.js'))).toBe(expected);
    expect(readDefaultBgmVolume(path.join(rootDir, 'public', 'module-registry.js'))).toBe(expected);
    expect(readDefaultBgmVolume(path.join(rootDir, 'worker-public', 'public', 'module-registry.js'))).toBe(expected);
  });

  test('source, dist, browser registry, and worker mirror share the same BGM output scale', () => {
    const rootDir = path.resolve(__dirname, '..');
    const expected = readBgmOutputVolumeScale(path.join(rootDir, 'sound-engine.ts'));

    expect(expected).toBe(0.3094);
    expect(readBgmOutputVolumeScale(path.join(rootDir, 'dist', 'sound-engine.js'))).toBe(expected);
    expect(readBgmOutputVolumeScale(path.join(rootDir, 'public', 'module-registry.js'))).toBe(expected);
    expect(readBgmOutputVolumeScale(path.join(rootDir, 'worker-public', 'public', 'module-registry.js'))).toBe(expected);
  });


  test('browser and worker BGM sliders stay in sync and leave headroom above the default BGM volume', () => {
    const rootDir = path.resolve(__dirname, '..');
    const expected = readDefaultBgmVolume(path.join(rootDir, 'sound-engine.ts'));
    const browserMax = readBgmSliderMax(path.join(rootDir, 'index.html'));
    const workerMax = readBgmSliderMax(path.join(rootDir, 'worker-public', 'index.html'));

    expect(browserMax).toBe(workerMax);
    expect(browserMax).toBe(EXPECTED_BGM_SLIDER_MAX);
    expect(browserMax).toBeGreaterThan(expected);
  });

  test('browser and worker quick volume sliders allow 200 percent output', () => {
    const rootDir = path.resolve(__dirname, '..');
    const browserMax = readQuickVolumeSliderMax(path.join(rootDir, 'index.html'));
    const workerMax = readQuickVolumeSliderMax(path.join(rootDir, 'worker-public', 'index.html'));

    expect(browserMax).toBe(workerMax);
    expect(browserMax).toBe(2);
  });

  test('browser and worker BGM track selectors stay narrow enough to avoid clipping the slider thumb', () => {
    const rootDir = path.resolve(__dirname, '..');
    const browserMaxWidth = readBgmTrackSelectMaxWidthPx(path.join(rootDir, 'index.html'));
    const workerMaxWidth = readBgmTrackSelectMaxWidthPx(path.join(rootDir, 'worker-public', 'index.html'));

    expect(browserMaxWidth).toBe(workerMaxWidth);
    expect(browserMaxWidth).toBeLessThanOrEqual(95);
  });
});
