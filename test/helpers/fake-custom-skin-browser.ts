export type FakeCustomSkinWriteOutcome =
  // Requests succeed and the transaction commits (default).
  | 'commit'
  // Every request succeeds, then the transaction aborts before commit (for example a quota failure).
  | 'abort-after-request'
  // The request fails; the error bubbles to the transaction, which then aborts.
  | 'request-error'
  // Requests succeed but the transaction never completes (until the test calls settle).
  | 'pending';

export interface FakeCustomSkinBrowser {
  readonly createdUrls: string[];
  readonly revokedUrls: string[];
  readonly records: Map<string, any>;
  /** Outcome applied to the next readwrite transactions, consumed one per transaction. */
  readonly writeOutcomes: FakeCustomSkinWriteOutcome[];
  /** Completes (commit) or aborts every transaction that was left pending. */
  settlePendingWrites(outcome: 'commit' | 'abort'): void;
}

function createAsyncRequest<T>(operation: () => T, onSettled?: (ok: boolean) => void): any {
  const request: any = {};
  Promise.resolve().then(() => {
    try {
      request.result = operation();
      if (typeof request.onsuccess === 'function') request.onsuccess();
      if (onSettled) onSettled(true);
    } catch (error) {
      request.error = error;
      if (typeof request.onerror === 'function') request.onerror();
      if (onSettled) onSettled(false);
    }
  });
  return request;
}

export function installFakeCustomSkinBrowser(root: Window): FakeCustomSkinBrowser {
  // Committed data. Writes are staged per transaction and only applied on commit, like IndexedDB.
  const records = new Map<string, any>();
  const createdUrls: string[] = [];
  const revokedUrls: string[] = [];
  const writeOutcomes: FakeCustomSkinWriteOutcome[] = [];
  const pendingTransactions: Array<(outcome: 'commit' | 'abort') => void> = [];
  let nextUrlId = 1;

  function createTransaction(mode: string): any {
    const outcome: FakeCustomSkinWriteOutcome = mode === 'readwrite' ? (writeOutcomes.shift() || 'commit') : 'commit';
    const staged: Array<() => void> = [];
    const transaction: any = {
      error: null,
      oncomplete: null,
      onerror: null,
      onabort: null,
      abort: () => finish('abort')
    };
    let finished = false;
    let outstanding = 0;
    function finish(result: 'commit' | 'abort'): void {
      if (finished) return;
      finished = true;
      if (result === 'commit') {
        staged.forEach((apply) => apply());
        Promise.resolve().then(() => {
          if (typeof transaction.oncomplete === 'function') transaction.oncomplete();
        });
      } else {
        if (!transaction.error) {
          transaction.error = Object.assign(new Error('The transaction was aborted'), { name: 'AbortError' });
        }
        Promise.resolve().then(() => {
          if (typeof transaction.onabort === 'function') transaction.onabort();
        });
      }
    }
    function requestSettled(ok: boolean): void {
      outstanding -= 1;
      if (!ok) {
        transaction.error = Object.assign(new Error('The request failed'), { name: 'UnknownError' });
        if (typeof transaction.onerror === 'function') transaction.onerror();
        finish('abort');
        return;
      }
      if (outstanding > 0) return;
      if (outcome === 'commit') finish('commit');
      else if (outcome === 'abort-after-request') {
        transaction.error = Object.assign(new Error('Quota exceeded'), { name: 'QuotaExceededError' });
        finish('abort');
      } else if (outcome === 'pending') {
        pendingTransactions.push(finish);
      }
    }
    function track<T>(operation: () => T): any {
      outstanding += 1;
      return createAsyncRequest(() => {
        if (outcome === 'request-error') throw Object.assign(new Error('write failed'), { name: 'UnknownError' });
        return operation();
      }, requestSettled);
    }
    transaction.objectStore = () => ({
      getAll: () => createAsyncRequest(() => Array.from(records.values())),
      put: (record: any) => track(() => {
        staged.push(() => records.set(String(record.id), record));
        return record.id;
      }),
      delete: (skinId: string) => track(() => {
        staged.push(() => records.delete(String(skinId)));
        return undefined;
      })
    });
    return transaction;
  }

  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    transaction: (_storeName: string, mode = 'readonly') => createTransaction(mode),
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
  return {
    createdUrls,
    revokedUrls,
    records,
    writeOutcomes,
    settlePendingWrites(outcome: 'commit' | 'abort') {
      pendingTransactions.splice(0).forEach((finish) => finish(outcome));
    }
  };
}
