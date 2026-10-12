export const LOGICAL_IMAGE_SOURCE_ATTRIBUTE = 'data-card-reversi-logical-src';

export interface LogicalImageSourceOptions {
  readonly fallbackLogicalPaths?: readonly string[];
  readonly createImage?: () => HTMLImageElement;
  readonly preload?: boolean;
  readonly onLoad?: (deliveredSource: string, logicalPath: string) => void;
  readonly onError?: () => void;
}

interface LogicalImageElementState {
  readonly signature: string;
  readonly generation: number;
}

const deliveredSourcesByDocument = new WeakMap<Document, Map<string, string>>();
const elementStates = new WeakMap<object, LogicalImageElementState>();

function normalizeLogicalPath(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function resolveDocument(element: HTMLImageElement): Document | null {
  if (element.ownerDocument) return element.ownerDocument;
  try {
    if (typeof document !== 'undefined') return document;
  } catch (_error) { /* document is optional in headless callers */ }
  return null;
}

function documentSources(documentRef: Document): Map<string, string> {
  let sources = deliveredSourcesByDocument.get(documentRef);
  if (!sources) {
    sources = new Map<string, string>();
    deliveredSourcesByDocument.set(documentRef, sources);
  }
  return sources;
}

function readDeliveredSource(element: HTMLImageElement): string {
  return String(
    element.currentSrc
    || element.getAttribute?.('src')
    || element.src
    || ''
  ).trim();
}

function absoluteSource(documentRef: Document, source: string): string {
  try {
    return new URL(source, documentRef.baseURI).href;
  } catch (_error) {
    return source;
  }
}

function sourcesMatch(documentRef: Document, left: string, right: string): boolean {
  if (!left || !right) return false;
  return absoluteSource(documentRef, left) === absoluteSource(documentRef, right);
}

function setLogicalAttribute(element: HTMLImageElement, logicalPath: string): void {
  if (element.getAttribute(LOGICAL_IMAGE_SOURCE_ATTRIBUTE) !== logicalPath) {
    element.setAttribute(LOGICAL_IMAGE_SOURCE_ATTRIBUTE, logicalPath);
  }
}

export function captureLogicalImageSource(
  element: HTMLImageElement,
  logicalPath: string
): string {
  const normalizedPath = normalizeLogicalPath(logicalPath);
  if (!element || !normalizedPath) return '';
  const documentRef = resolveDocument(element);
  const deliveredSource = readDeliveredSource(element);
  setLogicalAttribute(element, normalizedPath);
  if (documentRef && deliveredSource) {
    documentSources(documentRef).set(normalizedPath, deliveredSource);
  }
  return deliveredSource;
}

export function resolveLogicalImageSource(
  documentRef: Document | null | undefined,
  logicalPath: string
): string {
  const normalizedPath = normalizeLogicalPath(logicalPath);
  if (!documentRef || !normalizedPath) return normalizedPath;
  return documentSources(documentRef).get(normalizedPath) || normalizedPath;
}

export function setLogicalImageSourceIfChanged(
  element: HTMLImageElement,
  logicalPath: string,
  options: LogicalImageSourceOptions = {}
): boolean {
  if (!element) return false;
  const documentRef = resolveDocument(element);
  const normalizedPrimaryPath = normalizeLogicalPath(logicalPath);
  const candidates = [
    normalizedPrimaryPath,
    ...(options.fallbackLogicalPaths || []).map(normalizeLogicalPath)
  ].filter((value, index, values) => !!value && values.indexOf(value) === index);
  if (!documentRef || candidates.length === 0) {
    options.onError?.();
    return false;
  }

  const existingLogicalPath = normalizeLogicalPath(
    element.getAttribute(LOGICAL_IMAGE_SOURCE_ATTRIBUTE)
  );
  const existingDeliveredSource = readDeliveredSource(element);
  const previous = elementStates.get(element);
  if (!previous && existingLogicalPath && existingDeliveredSource) {
    documentSources(documentRef).set(existingLogicalPath, existingDeliveredSource);
  }

  const signature = candidates.join('\n');
  if (previous && previous.signature === signature) return false;
  const state = Object.freeze({
    signature,
    generation: (previous?.generation || 0) + 1
  });
  elementStates.set(element, state);
  setLogicalAttribute(element, normalizedPrimaryPath);

  const isCurrent = (): boolean => elementStates.get(element)?.generation === state.generation;
  const applyDeliveredSource = (candidate: string, deliveredSource: string): void => {
    if (!isCurrent()) return;
    documentSources(documentRef).set(candidate, deliveredSource);
    setLogicalAttribute(element, candidate);
    // currentSrc can still show the previous image while a new src is pending.
    // Compare the requested src so a quick switch back cancels that request.
    const requestedSource = String(element.getAttribute('src') || element.src || '').trim();
    if (!sourcesMatch(documentRef, requestedSource, deliveredSource)) {
      element.src = deliveredSource;
    }
    options.onLoad?.(deliveredSource, candidate);
  };

  let candidateIndex = 0;
  const tryCandidate = (): void => {
    if (!isCurrent()) return;
    const candidate = candidates[candidateIndex];
    const cachedSource = documentSources(documentRef).get(candidate);
    if (cachedSource) {
      applyDeliveredSource(candidate, cachedSource);
      return;
    }
    if (existingLogicalPath === candidate && existingDeliveredSource) {
      applyDeliveredSource(candidate, existingDeliveredSource);
      return;
    }
    if (options.preload === false) {
      applyDeliveredSource(candidate, candidate);
      return;
    }

    const loader = options.createImage
      ? options.createImage()
      : new (documentRef.defaultView?.Image || Image)();
    loader.onload = () => {
      if (!isCurrent()) return;
      applyDeliveredSource(candidate, readDeliveredSource(loader));
    };
    loader.onerror = () => {
      if (!isCurrent()) return;
      candidateIndex += 1;
      if (candidateIndex < candidates.length) {
        tryCandidate();
        return;
      }
      options.onError?.();
    };
    loader.src = candidate;
  };

  tryCandidate();
  return true;
}

const LogicalImageSource = {
  LOGICAL_IMAGE_SOURCE_ATTRIBUTE,
  captureLogicalImageSource,
  resolveLogicalImageSource,
  setLogicalImageSourceIfChanged
};

export default LogicalImageSource;
