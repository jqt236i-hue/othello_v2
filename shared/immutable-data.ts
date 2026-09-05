// Only objects owned and recursively frozen by this module may be reused.
// Object.isFrozen alone does not prove that nested values are immutable.
const owned = new WeakSet<object>();

export function isOwnedImmutable(value: unknown): value is object {
  return value !== null && typeof value === 'object' && owned.has(value);
}

export function freezeOwnedData<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || owned.has(value) || seen.has(value)) return value;
  const prototype = Object.getPrototypeOf(value);
  // structuredClone in hosts/test VMs can return another realm's Object.
  if (!Array.isArray(value) && prototype !== null
      && (Object.prototype.toString.call(value) !== '[object Object]' || Object.getPrototypeOf(prototype) !== null)) {
    throw new Error('immutable_plain_data_required');
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      freezeOwnedData(descriptor.value, seen);
    } else if (descriptor) throw new Error('immutable_accessor_not_supported');
  }
  Object.freeze(value);
  owned.add(value);
  return value;
}
