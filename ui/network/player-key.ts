'use strict';

function defaultNormalizePlayerKey(value: any, fallback?: any): string {
  const normalized = (value === null || typeof value === 'undefined')
    ? ''
    : String(value).trim().toLowerCase();
  const fallbackNormalized = (fallback === null || typeof fallback === 'undefined')
    ? ''
    : String(fallback).trim().toLowerCase();

  if (value === -1 || normalized === 'white' || normalized === '-1') return 'white';
  if (value === 1 || normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
  if (fallback === -1 || fallbackNormalized === 'white' || fallbackNormalized === '-1') return 'white';
  return 'black';
}

function normalizePlayerKey(value: any, fallback?: any, options?: any): string {
  const opts = (options && typeof options === 'object') ? options : {};
  if (typeof opts.override === 'function') {
    try {
      return opts.override(value, fallback);
    } catch (e) { /* ignore */ }
  }
  const schema = opts.schema;
  if (schema && typeof schema.normalizePlayerKey === 'function') {
    return schema.normalizePlayerKey(value, fallback);
  }
  return defaultNormalizePlayerKey(value, fallback);
}

export = {
  defaultNormalizePlayerKey,
  normalizePlayerKey
};
