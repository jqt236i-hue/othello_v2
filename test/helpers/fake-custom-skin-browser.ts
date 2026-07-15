export interface FakeCustomSkinBrowser {
  readonly createdUrls: string[];
  readonly revokedUrls: string[];
  readonly records: Map<string, any>;
}
function createAsyncRequest<T>(operation: () => T): any {
  const request: any = {};
  Promise.resolve().then(() => {
    try {
      request.result = operation();
      if (typeof request.onsuccess === 'function') request.onsuccess();
    } catch (error) {
      request.error = error;
      if (typeof request.onerror === 'function') request.onerror();
    }
  });
  return request;
}

export function installFakeCustomSkinBrowser(root: Window): FakeCustomSkinBrowser {
  const records = new Map<string, any>();
  const createdUrls: string[] = [];
  const revokedUrls: string[] = [];
  let nextUrlId = 1;
  const objectStore = {
    getAll: () => createAsyncRequest(() => Array.from(records.values())),
    put: (record: any) => createAsyncRequest(() => {
      records.set(String(record.id), record);
      return record.id;
    }),
    delete: (skinId: string) => createAsyncRequest(() => {
      records.delete(String(skinId));
      return undefined;
    })
  };
  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => objectStore,
    transaction: () => ({ objectStore: () => objectStore }),
    close: () => undefined
  };
  const indexedDB = {
    open: () => {
      const request: any = { result: database };
      Promise.resolve().then(() => {
        if (typeof request.onsuccess === 'function') request.onsuccess();
      });
      return request;
    }
  };
  Object.defineProperty(root, 'indexedDB', { configurable: true, value: indexedDB });
  Object.defineProperty(root.URL, 'createObjectURL', {
    configurable: true,
    value: (_blob: Blob) => {
      const url = `blob:custom-skin-${nextUrlId++}`;
      createdUrls.push(url);
      return url;
    }
  });
  Object.defineProperty(root.URL, 'revokeObjectURL', {
    configurable: true,
    value: (url: string) => revokedUrls.push(String(url))
  });
  return { createdUrls, revokedUrls, records };
}
