import { JSDOM } from 'jsdom';

import {
  captureLogicalImageSource,
  resolveLogicalImageSource,
  setLogicalImageSourceIfChanged
} from '../ui/assets/logical-image-source';

const HERO_LOGICAL_PATH = 'assets/images/hero/hero.png';

function createDocument(): Document {
  return new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://example.test/'
  }).window.document;
}

test('captures the Vite-delivered URL without mutating or preloading the same logical image', () => {
  const documentRef = createDocument();
  const image = documentRef.createElement('img');
  image.setAttribute('data-card-reversi-logical-src', HERO_LOGICAL_PATH);
  image.setAttribute('src', './vite-dist/assets/hero-HASHED.png');
  documentRef.body.appendChild(image);
  let createdImages = 0;

  expect(captureLogicalImageSource(image, HERO_LOGICAL_PATH)).toBe(
    './vite-dist/assets/hero-HASHED.png'
  );
  expect(resolveLogicalImageSource(documentRef, HERO_LOGICAL_PATH)).toBe(
    './vite-dist/assets/hero-HASHED.png'
  );
  expect(setLogicalImageSourceIfChanged(image, HERO_LOGICAL_PATH, {
    createImage: () => {
      createdImages += 1;
      return documentRef.createElement('img');
    }
  })).toBe(true);
  expect(createdImages).toBe(0);
  expect(image.getAttribute('src')).toBe('./vite-dist/assets/hero-HASHED.png');
});

test('preloads a new logical image once and reuses the captured delivered URL when switching back', () => {
  const documentRef = createDocument();
  const image = documentRef.createElement('img');
  image.setAttribute('data-card-reversi-logical-src', HERO_LOGICAL_PATH);
  image.setAttribute('src', './vite-dist/assets/hero-HASHED.png');
  documentRef.body.appendChild(image);
  captureLogicalImageSource(image, HERO_LOGICAL_PATH);

  const loaders: HTMLImageElement[] = [];
  const createImage = () => {
    const loader = documentRef.createElement('img');
    loaders.push(loader);
    return loader;
  };

  expect(setLogicalImageSourceIfChanged(
    image,
    'assets/images/cpu/level6.png',
    { createImage }
  )).toBe(true);
  expect(loaders).toHaveLength(1);
  expect(loaders[0].getAttribute('src')).toBe('assets/images/cpu/level6.png');
  loaders[0].onload?.(new Event('load'));
  expect(image.src).toBe('https://example.test/assets/images/cpu/level6.png');

  expect(setLogicalImageSourceIfChanged(image, HERO_LOGICAL_PATH, {
    createImage
  })).toBe(true);
  expect(loaders).toHaveLength(1);
  expect(image.src).toBe('https://example.test/vite-dist/assets/hero-HASHED.png');
  expect(image.getAttribute('data-card-reversi-logical-src')).toBe(HERO_LOGICAL_PATH);
});

test('ignores a stale preload completion after the element generation changes', () => {
  const documentRef = createDocument();
  const image = documentRef.createElement('img');
  documentRef.body.appendChild(image);
  const loaders: HTMLImageElement[] = [];
  const createImage = () => {
    const loader = documentRef.createElement('img');
    loaders.push(loader);
    return loader;
  };

  setLogicalImageSourceIfChanged(image, 'assets/images/cpu/level6.png', { createImage });
  setLogicalImageSourceIfChanged(image, 'assets/images/cpu/level7.png', { createImage });
  expect(loaders).toHaveLength(2);
  loaders[0].onload?.(new Event('load'));
  expect(image.getAttribute('src')).toBeNull();
  loaders[1].onload?.(new Event('load'));
  expect(image.src).toBe('https://example.test/assets/images/cpu/level7.png');
});

test('does not cache the previous visible source under a pending logical image', () => {
  const documentRef = createDocument();
  const image = documentRef.createElement('img');
  image.setAttribute('data-card-reversi-logical-src', HERO_LOGICAL_PATH);
  image.setAttribute('src', './vite-dist/assets/hero-HASHED.png');
  documentRef.body.appendChild(image);
  const loaders: HTMLImageElement[] = [];
  const createImage = () => {
    const loader = documentRef.createElement('img');
    loaders.push(loader);
    return loader;
  };

  setLogicalImageSourceIfChanged(image, 'assets/images/cpu/level6.png', { createImage });
  setLogicalImageSourceIfChanged(image, 'assets/images/cpu/level7.png', { createImage });
  setLogicalImageSourceIfChanged(image, 'assets/images/cpu/level6.png', { createImage });

  expect(loaders).toHaveLength(3);
  expect(image.getAttribute('src')).toBe('./vite-dist/assets/hero-HASHED.png');
  loaders[2].onload?.(new Event('load'));
  expect(image.src).toBe('https://example.test/assets/images/cpu/level6.png');
});
