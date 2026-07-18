import TextureManager = require('../ui/pixi/texture-manager');

interface FakeBitmap {
  width: number;
  height: number;
  label: string;
  close: jest.Mock<void, []>;
}

function makeBitmap(width: number, height: number, label: string): FakeBitmap {
  return { width, height, label, close: jest.fn() };
}

function createRuntime(options: {
  failUrls?: readonly string[];
  failProcedural?: boolean;
  customWidth?: number;
  customHeight?: number;
  failDerivative?: boolean;
  maxTextureSize?: number;
  events?: string[];
} = {}) {
  const events = options.events || [];
  let nextTextureId = 1;
  const uploads: any[] = [];
  const bitmaps: FakeBitmap[] = [];
  const destroyed: any[] = [];
  const closed: FakeBitmap[] = [];
  const loadTexture = jest.fn(async (url: string, purpose: string) => {
    if ((options.failUrls || []).some((candidate) => url.includes(candidate))) {
      throw new Error(`load-failed:${url}`);
    }
    const texture = { id: nextTextureId++, url, purpose };
    uploads.push(texture);
    return {
      texture,
      width: 64,
      height: 64,
      destroy: () => {
        events.push(`destroy:${url}`);
        destroyed.push(texture);
      }
    };
  });
  const createTextureFromBitmap = jest.fn(async (bitmap: FakeBitmap, purpose: string) => {
    const texture = { id: nextTextureId++, bitmap, purpose };
    uploads.push(texture);
    return { texture, width: bitmap.width, height: bitmap.height };
  });
  const createProceduralTexture = jest.fn(async (purpose: string, fallbackId: string) => {
    if (options.failProcedural) throw new Error(`procedural-failed:${purpose}`);
    const texture = { id: nextTextureId++, procedural: fallbackId, purpose };
    uploads.push(texture);
    return { texture, width: 1, height: 1 };
  });
  const createImageBitmap = jest.fn(async (source: Blob | FakeBitmap, resize?: any) => {
    if (resize && options.failDerivative) throw new Error('derivative-failed');
    const bitmap = resize
      ? makeBitmap(resize.resizeWidth, resize.resizeHeight, 'derived')
      : makeBitmap(options.customWidth || 64, options.customHeight || 64, 'decoded');
    bitmaps.push(bitmap);
    return bitmap;
  });
  const runtime: TextureManager.PixiTextureManagerRuntime = {
    loadTexture,
    createTextureFromBitmap: createTextureFromBitmap as any,
    createProceduralTexture,
    createImageBitmap: createImageBitmap as any,
    destroyTexture: (texture: any) => {
      events.push(`destroy:${texture.id}`);
      destroyed.push(texture);
    },
    closeImageBitmap: (bitmap: TextureManager.PixiTextureBitmap) => {
      const fake = bitmap as FakeBitmap;
      events.push(`close:${fake.label}`);
      fake.close();
      closed.push(fake);
    },
    getMaxTextureSize: () => options.maxTextureSize || 4096
  };
  return {
    runtime,
    events,
    uploads,
    bitmaps,
    destroyed,
    closed,
    loadTexture,
    createTextureFromBitmap,
    createProceduralTexture,
    createImageBitmap
  };
}

function documentAt(baseURI = 'https://example.test/game/index.html') {
  return { baseURI, createElement: jest.fn() } as any;
}

describe('Pixi texture manager resource lifecycle', () => {
  test('uses document.baseURI and dedupes one URL upload across purposes and sets', async () => {
    const fixture = createRuntime();
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt()
    });
    const first = await manager.prepare('first', [
      { purpose: 'black-stone', url: 'assets/stone.png', contentFingerprint: 'same' },
      { purpose: 'white-stone', url: 'assets/stone.png', contentFingerprint: 'same' }
    ]);
    const second = await manager.prepare('second', [
      { purpose: 'preview-stone', url: './assets/stone.png', contentFingerprint: 'metadata-changed' }
    ]);

    expect(fixture.loadTexture).toHaveBeenCalledTimes(1);
    expect(fixture.loadTexture).toHaveBeenCalledWith(
      'https://example.test/game/assets/stone.png',
      'black-stone'
    );
    expect(first.get('black-stone')!.texture).toBe(first.get('white-stone')!.texture);
    expect(second.get('preview-stone')!.texture).toBe(first.get('black-stone')!.texture);
    expect(first.get('black-stone')!.key).not.toBe(first.get('white-stone')!.key);
    expect(manager.getDiagnostics()).toMatchObject({
      cacheEntryCount: 1,
      readyResourceCount: 1,
      referenceCount: 3,
      loadStartCount: 1,
      dedupeHitCount: 2
    });

    first.release();
    second.release();
    expect(fixture.destroyed).toHaveLength(0);
    expect(manager.getDiagnostics()).toMatchObject({
      cacheEntryCount: 1,
      referenceCount: 0,
      idleCacheEntryCount: 1,
      idleCachePixelCount: 4096
    });
    manager.destroy();
    expect(fixture.destroyed).toHaveLength(1);
    expect(manager.getDiagnostics()).toMatchObject({ cacheEntryCount: 0, referenceCount: 0 });
    expect(TextureManager.resolvePixiTextureAssetUrl('blob:skin-1', null)).toBe('blob:skin-1');
  });

  test('uses an explicit default texture then a procedural fallback without accepting an empty board', async () => {
    const fixture = createRuntime({ failUrls: ['missing'] });
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt()
    });
    const prepared = await manager.prepare('fallbacks', [
      {
        purpose: 'board',
        url: 'assets/missing-board.png',
        fallback: { kind: 'built-in', url: 'assets/default-board.png' }
      },
      { purpose: 'stone', url: 'assets/missing-stone.png' }
    ]);

    expect(prepared.get('board')).toMatchObject({
      usedFallback: true,
      sourceKind: 'built-in',
      resolvedUrl: 'https://example.test/game/assets/default-board.png'
    });
    expect(prepared.get('stone')).toMatchObject({ usedFallback: true, sourceKind: 'procedural' });
    expect(fixture.createProceduralTexture).toHaveBeenCalledWith('stone', 'stone:procedural-fallback');
    expect(manager.getDiagnostics()).toMatchObject({ fallbackCount: 2, failureCount: 2 });

    manager.commit(prepared);
    expect(manager.getActive()!.resources).toHaveLength(2);
    manager.releaseActive();
  });

  test('rejects when primary and procedural resources both fail and releases the transferred source lease', async () => {
    const fixture = createRuntime({ failUrls: ['missing'], failProcedural: true });
    const sourceLease = { release: jest.fn(() => true) };
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt()
    });

    await expect(manager.prepare('all-fail', [
      { purpose: 'board', url: 'assets/missing.png' }
    ], { sourceLease })).rejects.toThrow('procedural-failed');
    expect(sourceLease.release).toHaveBeenCalledTimes(1);
    expect(manager.getActive()).toBeNull();
    expect(manager.getDiagnostics()).toMatchObject({
      cacheEntryCount: 0,
      referenceCount: 0,
      sourceLeaseCount: 0,
      failureCount: 2
    });
  });

  test('commits all prepared textures atomically and preserves the old set when apply fails', async () => {
    const events: string[] = [];
    const fixture = createRuntime({ events });
    const oldLease = { release: jest.fn(() => { events.push('release:old-url'); return true; }) };
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt()
    });
    const oldSet = await manager.prepare('old', [
      { purpose: 'board', url: 'assets/old.png' }
    ], { sourceLease: oldLease });
    manager.commit(oldSet);
    const nextSet = await manager.prepare('next', [
      { purpose: 'board', url: 'assets/next.png' }
    ]);

    expect(() => manager.commit(nextSet, () => {
      events.push('apply:failed');
      throw new Error('scene-apply-failed');
    })).toThrow('scene-apply-failed');
    expect(manager.getActive()!.id).toBe('old');
    expect(nextSet.state).toBe('prepared');
    expect(oldLease.release).not.toHaveBeenCalled();

    manager.commit(nextSet, (snapshot) => {
      events.push(`apply:${snapshot.id}`);
      expect(snapshot.resources).toHaveLength(1);
      expect(oldLease.release).not.toHaveBeenCalled();
    });
    expect(manager.getActive()!.id).toBe('next');
    expect(events).toEqual([
      'apply:failed',
      'apply:next',
      'release:old-url'
    ]);
    manager.releaseActive();
    manager.destroy();
    expect(events).toEqual([
      'apply:failed',
      'apply:next',
      'release:old-url',
      'destroy:https://example.test/game/assets/old.png',
      'destroy:https://example.test/game/assets/next.png'
    ]);
  });

  test('reuses alternating built-in skins and evicts the oldest idle texture at the bounded cache limit', async () => {
    const fixture = createRuntime();
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt()
    });

    for (let index = 0; index < 14; index += 1) {
      manager.commit(await manager.prepare(`skin-${index}`, [
        { purpose: 'board', url: `assets/skin-${index}.png` }
      ]));
    }
    expect(fixture.loadTexture).toHaveBeenCalledTimes(14);
    expect(manager.getDiagnostics()).toMatchObject({
      readyResourceCount: 13,
      idleCacheEntryCount: 12,
      evictionCount: 1
    });

    manager.commit(await manager.prepare('skin-0-again', [
      { purpose: 'board', url: 'assets/skin-0.png' }
    ]));
    expect(fixture.loadTexture).toHaveBeenCalledTimes(15);
    expect(manager.getDiagnostics()).toMatchObject({ uploadCount: 15, evictionCount: 2 });

    const cached = await manager.prepare('skin-13-again', [
      { purpose: 'board', url: 'assets/skin-13.png' }
    ]);
    expect(fixture.loadTexture).toHaveBeenCalledTimes(15);
    expect(manager.getDiagnostics()).toMatchObject({ uploadCount: 15, evictionCount: 2 });
    cached.release();
    manager.destroy();
  });

  test('keeps old GPU and Blob leases alive until an external texture lease ends', async () => {
    const events: string[] = [];
    const fixture = createRuntime({ events });
    const sourceLease = { release: jest.fn(() => { events.push('release:blob-url'); return true; }) };
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt()
    });
    manager.commit(await manager.prepare('old', [
      { purpose: 'board', url: 'blob:old-board' }
    ], { sourceLease }));
    const textureLease = manager.acquireActive('board');
    manager.commit(await manager.prepare('new', [
      { purpose: 'board', url: 'assets/new-board.png' }
    ]));

    expect(sourceLease.release).not.toHaveBeenCalled();
    expect(fixture.destroyed).toHaveLength(0);
    expect(manager.getDiagnostics().externalLeaseCount).toBe(1);

    expect(textureLease.release()).toBe(true);
    expect(textureLease.release()).toBe(false);
    expect(events.slice(0, 2)).toEqual(['destroy:blob:old-board', 'release:blob-url']);
    expect(manager.getDiagnostics().externalLeaseCount).toBe(0);
    manager.releaseActive();
  });

  test('uploads only an aspect-preserving derivative within physical and WebGL limits', async () => {
    const fixture = createRuntime({ customWidth: 8000, customHeight: 4000, maxTextureSize: 2048 });
    const original = new Blob([new Uint8Array(128)], { type: 'image/png' });
    const originalSize = original.size;
    const originalType = original.type;
    const sourceLease = { release: jest.fn(() => true) };
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt(),
      maxTextureSize: 2048
    });
    const prepared = await manager.prepare('custom', [{
      purpose: 'board',
      kind: 'custom',
      url: 'blob:custom-board',
      sourceBlob: original,
      contentFingerprint: 'blob-v1',
      maxPhysicalWidth: 1000,
      maxPhysicalHeight: 700
    }], { sourceLease });

    expect(fixture.createImageBitmap).toHaveBeenNthCalledWith(1, original);
    expect(fixture.createImageBitmap.mock.calls[1][0]).toBe(fixture.bitmaps[0]);
    expect(fixture.createImageBitmap.mock.calls[1][1]).toMatchObject({
      resizeWidth: 1000,
      resizeHeight: 500,
      resizeQuality: 'high'
    });
    expect(fixture.createTextureFromBitmap).toHaveBeenCalledWith(fixture.bitmaps[1], 'board');
    expect(prepared.get('board')).toMatchObject({
      sourceKind: 'custom', width: 1000, height: 500, downsampled: true, usedFallback: false
    });
    expect(fixture.bitmaps[0].close).toHaveBeenCalledTimes(1);
    expect(fixture.bitmaps[1].close).not.toHaveBeenCalled();
    expect(original.size).toBe(originalSize);
    expect(original.type).toBe(originalType);
    expect(manager.getDiagnostics()).toMatchObject({
      maxTextureSize: 2048,
      derivedBitmapCount: 2,
      downsampledBitmapCount: 1,
      closedBitmapCount: 1
    });

    manager.commit(prepared);
    manager.releaseActive();
    expect(fixture.bitmaps[1].close).toHaveBeenCalledTimes(1);
    expect(sourceLease.release).toHaveBeenCalledTimes(1);
  });

  test('requires an explicit object URL lease for custom Blob uploads and releases leases on validation failure', async () => {
    const fixture = createRuntime();
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt()
    });
    await expect(manager.prepare('missing-lease', [{
      purpose: 'board',
      kind: 'custom',
      url: 'blob:unleased-board',
      sourceBlob: new Blob([new Uint8Array(4)], { type: 'image/png' })
    }])).rejects.toMatchObject({ code: 'texture-custom-source-lease-required' });
    expect(fixture.createImageBitmap).not.toHaveBeenCalled();

    const invalidSetLease = { release: jest.fn(() => true) };
    await expect(manager.prepare('duplicate', [
      { purpose: 'board', url: 'assets/one.png' },
      { purpose: 'board', url: 'assets/two.png' }
    ], { sourceLease: invalidSetLease })).rejects.toMatchObject({ code: 'texture-purpose-duplicate' });
    expect(invalidSetLease.release).toHaveBeenCalledTimes(1);
  });

  test('takes the lower runtime WebGL limit when a larger configured ceiling is supplied', async () => {
    const fixture = createRuntime({ customWidth: 8192, customHeight: 4096, maxTextureSize: 2048 });
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt(),
      maxTextureSize: 8192
    });
    const prepared = await manager.prepare('runtime-limit', [{
      purpose: 'board',
      kind: 'custom',
      url: 'blob:runtime-limited-board',
      sourceBlob: new Blob([new Uint8Array(16)], { type: 'image/png' }),
      maxPhysicalWidth: 9000,
      maxPhysicalHeight: 9000
    }], { sourceLease: { release: () => true } });

    expect(fixture.createImageBitmap.mock.calls[1][1]).toMatchObject({
      resizeWidth: 2048,
      resizeHeight: 1024
    });
    expect(prepared.get('board')).toMatchObject({ width: 2048, height: 1024, downsampled: true });
    expect(manager.getDiagnostics().maxTextureSize).toBe(2048);
    prepared.release();
  });

  test('falls back for a failed custom derivative without mutating its original Blob', async () => {
    const fixture = createRuntime({ customWidth: 6000, customHeight: 3000, failDerivative: true });
    const original = new Blob([new Uint8Array(32)], { type: 'image/webp' });
    const sourceLease = { release: jest.fn(() => true) };
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt(),
      maxTextureSize: 1024
    });
    const prepared = await manager.prepare('custom-fallback', [{
      purpose: 'stone',
      kind: 'custom',
      url: 'blob:custom-stone',
      sourceBlob: original,
      maxPhysicalWidth: 512,
      maxPhysicalHeight: 512,
      fallback: { kind: 'built-in', url: 'assets/default-stone.png' }
    }], { sourceLease });

    expect(prepared.get('stone')).toMatchObject({ usedFallback: true, sourceKind: 'built-in' });
    expect(fixture.bitmaps[0].close).toHaveBeenCalledTimes(1);
    expect(original.size).toBe(32);
    expect(original.type).toBe('image/webp');
    expect(sourceLease.release).not.toHaveBeenCalled();

    prepared.release();
    expect(sourceLease.release).toHaveBeenCalledTimes(1);
  });

  test('prepares during playback/recovery without applying until the selected final commit', async () => {
    const fixture = createRuntime();
    const manager = TextureManager.createPixiTextureManager({
      runtime: fixture.runtime,
      documentRef: documentAt()
    });
    const duringPlayback = await manager.prepare('intermediate', [
      { purpose: 'board', url: 'assets/intermediate.png' }
    ]);
    const latest = await manager.prepare('latest', [
      { purpose: 'board', url: 'assets/latest.png' }
    ]);

    expect(manager.getActive()).toBeNull();
    expect(duringPlayback.state).toBe('prepared');
    expect(latest.state).toBe('prepared');
    duringPlayback.release();
    const applied: string[] = [];
    manager.commit(latest, (snapshot) => applied.push(snapshot.id));

    expect(applied).toEqual(['latest']);
    expect(manager.getActive()!.id).toBe('latest');
    expect(manager.getDiagnostics()).toMatchObject({ preparedSetCount: 0, activeSetId: 'latest', commitCount: 1 });
    manager.destroy();
    manager.destroy();
    expect(manager.getDiagnostics()).toMatchObject({
      state: 'destroyed', cacheEntryCount: 0, referenceCount: 0, activeSetId: null
    });
  });
});
