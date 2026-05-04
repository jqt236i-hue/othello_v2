declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file timer-service.js
 * Timer abstraction for game/ layer to avoid direct browser API dependency.
 */

class TimerService {
  mode: any;

  constructor(mode: any = 'browser') {
    this.mode = mode;
  }

  setTimeout(callback: any, delay: any): any {
    if (this.mode === 'browser') {
      return setTimeout(callback, delay);
    }
    // headlessモード: 即時実行
    const id = { _immediate: true };
    if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
      process.nextTick(callback);
    } else {
      try { callback(); } catch (e) { /* ignore */ }
    }
    return id;
  }

  clearTimeout(id: any): void {
    if (this.mode === 'browser') {
      clearTimeout(id);
    }
    // headlessモードでは即時実行なのでクリア不要
  }

  setInterval(callback: any, delay: any): any {
    if (this.mode === 'browser') {
      return setInterval(callback, delay);
    }
    // headlessモード: 一度だけ即時実行
    if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
      process.nextTick(callback);
    } else {
      try { callback(); } catch (e) { /* ignore */ }
    }
    return { _immediate: true };
  }

  clearInterval(id: any): void {
    if (this.mode === 'browser') {
      clearInterval(id);
    }
  }
}

function createTimerService(mode: any): TimerService {
  return new TimerService(mode);
}

module.exports = { TimerService, createTimerService };

export {};
