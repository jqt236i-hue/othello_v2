var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
var init_utils = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/_internal/utils.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    __name(createNotImplementedError, "createNotImplementedError");
    __name(notImplemented, "notImplemented");
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin, _performanceNow, nodeTiming, PerformanceEntry, PerformanceMark, PerformanceMeasure, PerformanceResourceTiming, PerformanceObserverEntryList, Performance, PerformanceObserver, performance;
var init_performance = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_utils();
    _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
    _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
    nodeTiming = {
      name: "node",
      entryType: "node",
      startTime: 0,
      duration: 0,
      nodeStart: 0,
      v8Start: 0,
      bootstrapComplete: 0,
      environment: 0,
      loopStart: 0,
      loopExit: 0,
      idleTime: 0,
      uvMetricsInfo: {
        loopCount: 0,
        events: 0,
        eventsWaiting: 0
      },
      detail: void 0,
      toJSON() {
        return this;
      }
    };
    PerformanceEntry = class {
      static {
        __name(this, "PerformanceEntry");
      }
      __unenv__ = true;
      detail;
      entryType = "event";
      name;
      startTime;
      constructor(name, options) {
        this.name = name;
        this.startTime = options?.startTime || _performanceNow();
        this.detail = options?.detail;
      }
      get duration() {
        return _performanceNow() - this.startTime;
      }
      toJSON() {
        return {
          name: this.name,
          entryType: this.entryType,
          startTime: this.startTime,
          duration: this.duration,
          detail: this.detail
        };
      }
    };
    PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
      static {
        __name(this, "PerformanceMark");
      }
      entryType = "mark";
      constructor() {
        super(...arguments);
      }
      get duration() {
        return 0;
      }
    };
    PerformanceMeasure = class extends PerformanceEntry {
      static {
        __name(this, "PerformanceMeasure");
      }
      entryType = "measure";
    };
    PerformanceResourceTiming = class extends PerformanceEntry {
      static {
        __name(this, "PerformanceResourceTiming");
      }
      entryType = "resource";
      serverTiming = [];
      connectEnd = 0;
      connectStart = 0;
      decodedBodySize = 0;
      domainLookupEnd = 0;
      domainLookupStart = 0;
      encodedBodySize = 0;
      fetchStart = 0;
      initiatorType = "";
      name = "";
      nextHopProtocol = "";
      redirectEnd = 0;
      redirectStart = 0;
      requestStart = 0;
      responseEnd = 0;
      responseStart = 0;
      secureConnectionStart = 0;
      startTime = 0;
      transferSize = 0;
      workerStart = 0;
      responseStatus = 0;
    };
    PerformanceObserverEntryList = class {
      static {
        __name(this, "PerformanceObserverEntryList");
      }
      __unenv__ = true;
      getEntries() {
        return [];
      }
      getEntriesByName(_name, _type) {
        return [];
      }
      getEntriesByType(type) {
        return [];
      }
    };
    Performance = class {
      static {
        __name(this, "Performance");
      }
      __unenv__ = true;
      timeOrigin = _timeOrigin;
      eventCounts = /* @__PURE__ */ new Map();
      _entries = [];
      _resourceTimingBufferSize = 0;
      navigation = void 0;
      timing = void 0;
      timerify(_fn, _options) {
        throw createNotImplementedError("Performance.timerify");
      }
      get nodeTiming() {
        return nodeTiming;
      }
      eventLoopUtilization() {
        return {};
      }
      markResourceTiming() {
        return new PerformanceResourceTiming("");
      }
      onresourcetimingbufferfull = null;
      now() {
        if (this.timeOrigin === _timeOrigin) {
          return _performanceNow();
        }
        return Date.now() - this.timeOrigin;
      }
      clearMarks(markName) {
        this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
      }
      clearMeasures(measureName) {
        this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
      }
      clearResourceTimings() {
        this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
      }
      getEntries() {
        return this._entries;
      }
      getEntriesByName(name, type) {
        return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
      }
      getEntriesByType(type) {
        return this._entries.filter((e) => e.entryType === type);
      }
      mark(name, options) {
        const entry = new PerformanceMark(name, options);
        this._entries.push(entry);
        return entry;
      }
      measure(measureName, startOrMeasureOptions, endMark) {
        let start;
        let end;
        if (typeof startOrMeasureOptions === "string") {
          start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
          end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
        } else {
          start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
          end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
        }
        const entry = new PerformanceMeasure(measureName, {
          startTime: start,
          detail: {
            start,
            end
          }
        });
        this._entries.push(entry);
        return entry;
      }
      setResourceTimingBufferSize(maxSize) {
        this._resourceTimingBufferSize = maxSize;
      }
      addEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.addEventListener");
      }
      removeEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.removeEventListener");
      }
      dispatchEvent(event) {
        throw createNotImplementedError("Performance.dispatchEvent");
      }
      toJSON() {
        return this;
      }
    };
    PerformanceObserver = class {
      static {
        __name(this, "PerformanceObserver");
      }
      __unenv__ = true;
      static supportedEntryTypes = [];
      _callback = null;
      constructor(callback) {
        this._callback = callback;
      }
      takeRecords() {
        return [];
      }
      disconnect() {
        throw createNotImplementedError("PerformanceObserver.disconnect");
      }
      observe(options) {
        throw createNotImplementedError("PerformanceObserver.observe");
      }
      bind(fn) {
        return fn;
      }
      runInAsyncScope(fn, thisArg, ...args) {
        return fn.call(thisArg, ...args);
      }
      asyncId() {
        return 0;
      }
      triggerAsyncId() {
        return 0;
      }
      emitDestroy() {
        return this;
      }
    };
    performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/perf_hooks.mjs
var init_perf_hooks = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/perf_hooks.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_performance();
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
var init_performance2 = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs"() {
    init_perf_hooks();
    globalThis.performance = performance;
    globalThis.Performance = Performance;
    globalThis.PerformanceEntry = PerformanceEntry;
    globalThis.PerformanceMark = PerformanceMark;
    globalThis.PerformanceMeasure = PerformanceMeasure;
    globalThis.PerformanceObserver = PerformanceObserver;
    globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
    globalThis.PerformanceResourceTiming = PerformanceResourceTiming;
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime;
var init_hrtime = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
      const now = Date.now();
      const seconds = Math.trunc(now / 1e3);
      const nanos = now % 1e3 * 1e6;
      if (startTime) {
        let diffSeconds = seconds - startTime[0];
        let diffNanos = nanos - startTime[0];
        if (diffNanos < 0) {
          diffSeconds = diffSeconds - 1;
          diffNanos = 1e9 + diffNanos;
        }
        return [diffSeconds, diffNanos];
      }
      return [seconds, nanos];
    }, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
      return BigInt(Date.now() * 1e6);
    }, "bigint") });
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream;
var init_read_stream = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    ReadStream = class {
      static {
        __name(this, "ReadStream");
      }
      fd;
      isRaw = false;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      setRawMode(mode) {
        this.isRaw = mode;
        return this;
      }
    };
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream;
var init_write_stream = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    WriteStream = class {
      static {
        __name(this, "WriteStream");
      }
      fd;
      columns = 80;
      rows = 24;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      clearLine(dir, callback) {
        callback && callback();
        return false;
      }
      clearScreenDown(callback) {
        callback && callback();
        return false;
      }
      cursorTo(x, y, callback) {
        callback && typeof callback === "function" && callback();
        return false;
      }
      moveCursor(dx, dy, callback) {
        callback && callback();
        return false;
      }
      getColorDepth(env2) {
        return 1;
      }
      hasColors(count, env2) {
        return false;
      }
      getWindowSize() {
        return [this.columns, this.rows];
      }
      write(str, encoding, cb) {
        if (str instanceof Uint8Array) {
          str = new TextDecoder().decode(str);
        }
        try {
          console.log(str);
        } catch {
        }
        cb && typeof cb === "function" && cb();
        return false;
      }
    };
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/tty.mjs
var init_tty = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/tty.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_read_stream();
    init_write_stream();
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION;
var init_node_version = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    NODE_VERSION = "22.14.0";
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";
var Process;
var init_process = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/unenv/dist/runtime/node/internal/process/process.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_tty();
    init_utils();
    init_node_version();
    Process = class _Process extends EventEmitter {
      static {
        __name(this, "Process");
      }
      env;
      hrtime;
      nextTick;
      constructor(impl) {
        super();
        this.env = impl.env;
        this.hrtime = impl.hrtime;
        this.nextTick = impl.nextTick;
        for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
          const value = this[prop];
          if (typeof value === "function") {
            this[prop] = value.bind(this);
          }
        }
      }
      // --- event emitter ---
      emitWarning(warning, type, code) {
        console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
      }
      emit(...args) {
        return super.emit(...args);
      }
      listeners(eventName) {
        return super.listeners(eventName);
      }
      // --- stdio (lazy initializers) ---
      #stdin;
      #stdout;
      #stderr;
      get stdin() {
        return this.#stdin ??= new ReadStream(0);
      }
      get stdout() {
        return this.#stdout ??= new WriteStream(1);
      }
      get stderr() {
        return this.#stderr ??= new WriteStream(2);
      }
      // --- cwd ---
      #cwd = "/";
      chdir(cwd2) {
        this.#cwd = cwd2;
      }
      cwd() {
        return this.#cwd;
      }
      // --- dummy props and getters ---
      arch = "";
      platform = "";
      argv = [];
      argv0 = "";
      execArgv = [];
      execPath = "";
      title = "";
      pid = 200;
      ppid = 100;
      get version() {
        return `v${NODE_VERSION}`;
      }
      get versions() {
        return { node: NODE_VERSION };
      }
      get allowedNodeEnvironmentFlags() {
        return /* @__PURE__ */ new Set();
      }
      get sourceMapsEnabled() {
        return false;
      }
      get debugPort() {
        return 0;
      }
      get throwDeprecation() {
        return false;
      }
      get traceDeprecation() {
        return false;
      }
      get features() {
        return {};
      }
      get release() {
        return {};
      }
      get connected() {
        return false;
      }
      get config() {
        return {};
      }
      get moduleLoadList() {
        return [];
      }
      constrainedMemory() {
        return 0;
      }
      availableMemory() {
        return 0;
      }
      uptime() {
        return 0;
      }
      resourceUsage() {
        return {};
      }
      // --- noop methods ---
      ref() {
      }
      unref() {
      }
      // --- unimplemented methods ---
      umask() {
        throw createNotImplementedError("process.umask");
      }
      getBuiltinModule() {
        return void 0;
      }
      getActiveResourcesInfo() {
        throw createNotImplementedError("process.getActiveResourcesInfo");
      }
      exit() {
        throw createNotImplementedError("process.exit");
      }
      reallyExit() {
        throw createNotImplementedError("process.reallyExit");
      }
      kill() {
        throw createNotImplementedError("process.kill");
      }
      abort() {
        throw createNotImplementedError("process.abort");
      }
      dlopen() {
        throw createNotImplementedError("process.dlopen");
      }
      setSourceMapsEnabled() {
        throw createNotImplementedError("process.setSourceMapsEnabled");
      }
      loadEnvFile() {
        throw createNotImplementedError("process.loadEnvFile");
      }
      disconnect() {
        throw createNotImplementedError("process.disconnect");
      }
      cpuUsage() {
        throw createNotImplementedError("process.cpuUsage");
      }
      setUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
      }
      hasUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
      }
      initgroups() {
        throw createNotImplementedError("process.initgroups");
      }
      openStdin() {
        throw createNotImplementedError("process.openStdin");
      }
      assert() {
        throw createNotImplementedError("process.assert");
      }
      binding() {
        throw createNotImplementedError("process.binding");
      }
      // --- attached interfaces ---
      permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
      report = {
        directory: "",
        filename: "",
        signal: "SIGUSR2",
        compact: false,
        reportOnFatalError: false,
        reportOnSignal: false,
        reportOnUncaughtException: false,
        getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
        writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
      };
      finalization = {
        register: /* @__PURE__ */ notImplemented("process.finalization.register"),
        unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
        registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
      };
      memoryUsage = Object.assign(() => ({
        arrayBuffers: 0,
        rss: 0,
        external: 0,
        heapTotal: 0,
        heapUsed: 0
      }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
      // --- undefined props ---
      mainModule = void 0;
      domain = void 0;
      // optional
      send = void 0;
      exitCode = void 0;
      channel = void 0;
      getegid = void 0;
      geteuid = void 0;
      getgid = void 0;
      getgroups = void 0;
      getuid = void 0;
      setegid = void 0;
      seteuid = void 0;
      setgid = void 0;
      setgroups = void 0;
      setuid = void 0;
      // internals
      _events = void 0;
      _eventsCount = void 0;
      _exiting = void 0;
      _maxListeners = void 0;
      _debugEnd = void 0;
      _debugProcess = void 0;
      _fatalException = void 0;
      _getActiveHandles = void 0;
      _getActiveRequests = void 0;
      _kill = void 0;
      _preload_modules = void 0;
      _rawDebug = void 0;
      _startProfilerIdleNotifier = void 0;
      _stopProfilerIdleNotifier = void 0;
      _tickCallback = void 0;
      _disconnect = void 0;
      _handleQueue = void 0;
      _pendingMessage = void 0;
      _channel = void 0;
      _send = void 0;
      _linkedBinding = void 0;
    };
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess, getBuiltinModule, workerdProcess, unenvProcess, exit, features, platform, _channel, _debugEnd, _debugProcess, _disconnect, _events, _eventsCount, _exiting, _fatalException, _getActiveHandles, _getActiveRequests, _handleQueue, _kill, _linkedBinding, _maxListeners, _pendingMessage, _preload_modules, _rawDebug, _send, _startProfilerIdleNotifier, _stopProfilerIdleNotifier, _tickCallback, abort, addListener, allowedNodeEnvironmentFlags, arch, argv, argv0, assert, availableMemory, binding, channel, chdir, config, connected, constrainedMemory, cpuUsage, cwd, debugPort, disconnect, dlopen, domain, emit, emitWarning, env, eventNames, execArgv, execPath, exitCode, finalization, getActiveResourcesInfo, getegid, geteuid, getgid, getgroups, getMaxListeners, getuid, hasUncaughtExceptionCaptureCallback, hrtime3, initgroups, kill, listenerCount, listeners, loadEnvFile, mainModule, memoryUsage, moduleLoadList, nextTick, off, on, once, openStdin, permission, pid, ppid, prependListener, prependOnceListener, rawListeners, reallyExit, ref, release, removeAllListeners, removeListener, report, resourceUsage, send, setegid, seteuid, setgid, setgroups, setMaxListeners, setSourceMapsEnabled, setuid, setUncaughtExceptionCaptureCallback, sourceMapsEnabled, stderr, stdin, stdout, throwDeprecation, title, traceDeprecation, umask, unref, uptime, version, versions, _process, process_default;
var init_process2 = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_hrtime();
    init_process();
    globalProcess = globalThis["process"];
    getBuiltinModule = globalProcess.getBuiltinModule;
    workerdProcess = getBuiltinModule("node:process");
    unenvProcess = new Process({
      env: globalProcess.env,
      hrtime,
      // `nextTick` is available from workerd process v1
      nextTick: workerdProcess.nextTick
    });
    ({ exit, features, platform } = workerdProcess);
    ({
      _channel,
      _debugEnd,
      _debugProcess,
      _disconnect,
      _events,
      _eventsCount,
      _exiting,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _handleQueue,
      _kill,
      _linkedBinding,
      _maxListeners,
      _pendingMessage,
      _preload_modules,
      _rawDebug,
      _send,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      arch,
      argv,
      argv0,
      assert,
      availableMemory,
      binding,
      channel,
      chdir,
      config,
      connected,
      constrainedMemory,
      cpuUsage,
      cwd,
      debugPort,
      disconnect,
      dlopen,
      domain,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      exitCode,
      finalization,
      getActiveResourcesInfo,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getMaxListeners,
      getuid,
      hasUncaughtExceptionCaptureCallback,
      hrtime: hrtime3,
      initgroups,
      kill,
      listenerCount,
      listeners,
      loadEnvFile,
      mainModule,
      memoryUsage,
      moduleLoadList,
      nextTick,
      off,
      on,
      once,
      openStdin,
      permission,
      pid,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      reallyExit,
      ref,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      send,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setMaxListeners,
      setSourceMapsEnabled,
      setuid,
      setUncaughtExceptionCaptureCallback,
      sourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      throwDeprecation,
      title,
      traceDeprecation,
      umask,
      unref,
      uptime,
      version,
      versions
    } = unenvProcess);
    _process = {
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      hasUncaughtExceptionCaptureCallback,
      setUncaughtExceptionCaptureCallback,
      loadEnvFile,
      sourceMapsEnabled,
      arch,
      argv,
      argv0,
      chdir,
      config,
      connected,
      constrainedMemory,
      availableMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      disconnect,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      exit,
      finalization,
      features,
      getBuiltinModule,
      getActiveResourcesInfo,
      getMaxListeners,
      hrtime: hrtime3,
      kill,
      listeners,
      listenerCount,
      memoryUsage,
      nextTick,
      on,
      off,
      once,
      pid,
      platform,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      setMaxListeners,
      setSourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      title,
      throwDeprecation,
      traceDeprecation,
      umask,
      uptime,
      version,
      versions,
      // @ts-expect-error old API
      domain,
      initgroups,
      moduleLoadList,
      reallyExit,
      openStdin,
      assert,
      binding,
      send,
      exitCode,
      channel,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getuid,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setuid,
      permission,
      mainModule,
      _events,
      _eventsCount,
      _exiting,
      _maxListeners,
      _debugEnd,
      _debugProcess,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _kill,
      _preload_modules,
      _rawDebug,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      _disconnect,
      _handleQueue,
      _pendingMessage,
      _channel,
      _send,
      _linkedBinding
    };
    process_default = _process;
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process"() {
    init_process2();
    globalThis.process = process_default;
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
  }
});

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// cards/catalog.json
var require_catalog = __commonJS({
  "cards/catalog.json"(exports, module) {
    module.exports = {
      version: 1,
      notes: "Source of truth for card display name (ja) <-> code/type. Keep this in sync with SharedConstants/CARD_DEFS.",
      cards: [
        {
          id: "chest_01",
          name_ja: "\u5B9D\u7BB1",
          type: "TREASURE_BOX",
          cost: 0,
          desc_ja: "\u4F7F\u7528\u6642\u306B\u5E03\u77F3\u30921\u301C3\u30E9\u30F3\u30C0\u30E0\u3067\u7372\u5F97\u3059\u308B\u3002"
        },
        {
          id: "free_01",
          name_ja: "\u81EA\u7531\u306E\u610F\u5FD7",
          type: "FREE_PLACEMENT",
          cost: 9,
          desc_ja: "\u53CD\u8EE20\u3067\u3082\u7A7A\u304D\u30DE\u30B9\u306B\u7F6E\u3051\u308B\u3002"
        },
        {
          id: "hard_01",
          name_ja: "\u5F31\u3044\u610F\u5FD7",
          type: "PROTECTED_NEXT_STONE",
          cost: 1,
          desc_ja: "\u6B21\u306B\u7F6E\u304F\u77F3\u306F\u6B21\u306E\u76F8\u624B\u30BF\u30FC\u30F3\u4E2D\u3060\u3051\u53CD\u8EE2\u3055\u308C\u306A\u3044\u3002"
        },
        {
          id: "swap_01",
          name_ja: "\u4EA4\u63DB\u306E\u610F\u5FD7",
          type: "SWAP_WITH_ENEMY",
          cost: 13,
          desc_ja: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u76F8\u624B\u77F31\u3064\u3068\u5165\u308C\u66FF\u3048\u3066\u7F6E\u3051\u308B\u3002"
        },
        {
          id: "position_swap_01",
          name_ja: "\u5165\u66FF\u306E\u610F\u5FD7",
          type: "POSITION_SWAP_WILL",
          cost: 17,
          desc_ja: "\u76E4\u9762\u4E0A\u306E\u77F32\u3064\u3092\u9078\u3073\u3001\u4F4D\u7F6E\u3092\u5165\u308C\u66FF\u3048\u308B\u3002\u901A\u5E38\u77F3\u30FB\u7279\u6B8A\u77F3\u30FB\u7206\u5F3E\u3092\u554F\u308F\u305A\u5BFE\u8C61\u306B\u3067\u304D\u308B\u3002"
        },
        {
          id: "sacrifice_01",
          name_ja: "\u751F\u8D04\u306E\u610F\u5FD7",
          type: "SACRIFICE_WILL",
          cost: 5,
          desc_ja: "\u81EA\u5206\u306E\u77F3\u3092\u6700\u59273\u500B\u307E\u3067\u7834\u58CA\u3057\u30011\u500B\u306B\u3064\u304D\u5E03\u77F3+5\u3002"
        },
        {
          id: "perma_01",
          name_ja: "\u5F37\u3044\u610F\u5FD7",
          type: "PERMA_PROTECT_NEXT_STONE",
          cost: 12,
          desc_ja: "\u6B21\u306B\u7F6E\u304F\u77F3\u306F\u4EE5\u5F8C\u305A\u3063\u3068\u53CD\u8EE2\u3055\u308C\u306A\u3044\u3002"
        },
        {
          id: "strong_wind_01",
          name_ja: "\u5F37\u98A8\u306E\u610F\u5FD7",
          type: "STRONG_WIND_WILL",
          cost: 9,
          desc_ja: "\u76E4\u9762\u306E\u77F31\u3064\u3092\u9078\u3073\u3001\u6700\u3082\u9577\u304F\u9032\u3081\u308B\u4E0A\u4E0B\u5DE6\u53F3\u65B9\u5411\u3078\u98DB\u3070\u3059\uFF08\u540C\u8DDD\u96E2\u306F\u30E9\u30F3\u30C0\u30E0\uFF09\u3002\u79FB\u52D5\u3057\u305F\u30DE\u30B9\u6570\u3076\u3093\u5E03\u77F3\u3092\u5F97\u308B\u3002"
        },
        {
          id: "trap_01",
          name_ja: "\u7F60\u306E\u610F\u5FD7",
          type: "TRAP_WILL",
          cost: 10,
          desc_ja: "\u81EA\u5206\u306E\u77F31\u3064\u3092\u7F60\u77F3\u5316\u3002\u6B21\u306E\u76F8\u624B\u30BF\u30FC\u30F3\u4E2D\u306B\u53CD\u8EE2\u3055\u308C\u308B\u3068\u76F8\u624B\u306E\u5E03\u77F3\u5168\u6CA1\u53CE+\u624B\u672D3\u679A\u6CA1\u53CE\u3002"
        },
        {
          id: "tempt_01",
          name_ja: "\u8A98\u60D1\u306E\u610F\u5FD7",
          type: "TEMPT_WILL",
          cost: 20,
          desc_ja: "\u76F8\u624B\u306E\u7279\u6B8A\u77F31\u3064\u3092\u81EA\u5206\u306E\u77F3\u306B\u3059\u308B\uFF08\u6B8B\u308A\u30BF\u30FC\u30F3\u7B49\u306F\u7DAD\u6301\uFF09\u3002\u5BFE\u8C61\u304C\u7121\u3044\u3068\u4F7F\u3048\u306A\u3044\u3002"
        },
        {
          id: "chain_01",
          name_ja: "\u9023\u9396\u306E\u610F\u5FD7",
          type: "CHAIN_WILL",
          cost: 22,
          desc_ja: "\u3053\u306E\u624B\u3067\u8D77\u304D\u305F\u901A\u5E38\u53CD\u8EE2\u3092\u8D77\u70B9\u306B\u3001\u8FFD\u52A0\u53CD\u8EE2\u3092\u6700\u59272\u56DE\u307E\u3067\u884C\u3046\u3002"
        },
        {
          id: "regen_01",
          name_ja: "\u5FA9\u6D3B\u306E\u610F\u5FD7",
          type: "REGEN_WILL",
          cost: 15,
          desc_ja: "\u6B21\u306B\u7F6E\u304F\u77F3\u306F1\u56DE\u3060\u3051\u518D\u751F\u3002\u53CD\u8EE2\u3055\u308C\u305F\u3089\u5143\u8272\u306B\u623B\u308A\u3001\u305D\u3053\u304B\u3089\u631F\u3081\u308B\u5217\u3092\u53CD\u8EE2\u3059\u308B\u3002"
        },
        {
          id: "destroy_01",
          name_ja: "\u7834\u58CA\u795E",
          type: "DESTROY_ONE_STONE",
          cost: 14,
          desc_ja: "\u76E4\u4E0A\u306E\u77F31\u3064\u3092\u7834\u58CA\u3059\u308B\u3002"
        },
        {
          id: "bomb_01",
          name_ja: "\u6642\u9650\u7206\u5F3E",
          type: "TIME_BOMB",
          cost: 13,
          desc_ja: "\u76E4\u9762\u4E0A\u306E\u81EA\u5206\u306E\u77F31\u3064\u3092\u6642\u9650\u7206\u5F3E\u5316\u30023\u30BF\u30FC\u30F3\u5F8C\u306B\u5468\u56F29\u30DE\u30B9\u3092\u7834\u58CA\u3002\u53CD\u8EE2\u3055\u308C\u308B\u3068\u89E3\u9664\u3002"
        },
        {
          id: "udr_01",
          name_ja: "\u7A76\u6975\u53CD\u8EE2\u9F8D",
          type: "ULTIMATE_REVERSE_DRAGON",
          cost: 30,
          desc_ja: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u9F8D\u5316\u3002\u7F6E\u3044\u305F\u6642\u3068\u81EA\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B\u5468\u56F28\u30DE\u30B9\u3092\u53CD\u8EE2\u30025\u30BF\u30FC\u30F3\u6301\u7D9A\u3002"
        },
        {
          id: "breeding_01",
          name_ja: "\u7E41\u6B96\u306E\u610F\u5FD7",
          type: "BREEDING_WILL",
          cost: 16,
          desc_ja: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u7E41\u6B96\u5316\u3002\u7F6E\u3044\u305F\u6642\u3068\u81EA\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B\u5468\u56F28\u30DE\u30B9\u3078\u30E9\u30F3\u30C0\u30E01\u500B\u751F\u6210\u3002\u4EE5\u5F8C\u306F\u524D\u56DE\u751F\u6210\u77F3\u306E\u5468\u56F2\u3078\u62E1\u6563\u3002\u631F\u3081\u3070\u53CD\u8EE2\u3002\u751F\u6210\u77F3\u304C\u53CD\u8EE2\u3055\u308C\u305F\u5834\u5408\u306F\u89AA\u77F3\u8D77\u70B9\u306B\u623B\u308B\u30023\u30BF\u30FC\u30F3\u6301\u7D9A\u3002"
        },
        {
          id: "cross_bomb_01",
          name_ja: "\u5341\u5B57\u7206\u5F3E",
          type: "CROSS_BOMB",
          cost: 18,
          desc_ja: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u5341\u5B57\u7206\u5F3E\u5316\u3002\u901A\u5E38\u53CD\u8EE2\u5F8C\u306B\u5373\u8D77\u7206\u3057\u3001\u4E2D\u5FC3\u3068\u7E26\u6A2A2\u30DE\u30B9\u306E\u77F3\u3092\u7834\u58CA\u3059\u308B\u3002"
        },
        {
          id: "hyperactive_01",
          name_ja: "\u591A\u52D5\u306E\u610F\u5FD7",
          type: "HYPERACTIVE_WILL",
          cost: 8,
          desc_ja: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u591A\u52D5\u5316\u3002\u4E21\u8005\u306E\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B\u5468\u56F2\u306E\u7A7A\u304D\u30781\u30DE\u30B9\u79FB\u52D5\u3057\u3001\u631F\u3081\u3070\u53CD\u8EE2\u3002"
        },
        {
          id: "sell_01",
          name_ja: "\u58F2\u5374\u306E\u610F\u5FD7",
          type: "SELL_CARD_WILL",
          cost: 8,
          desc_ja: "\u4F7F\u7528\u5F8C\u3001\u624B\u672D\u304B\u30891\u679A\u3092\u58F2\u5374\u3057\u3001\u305D\u306E\u30AB\u30FC\u30C9\u306E\u30B3\u30B9\u30C8\u5206\u3060\u3051\u5E03\u77F3\u3092\u5F97\u308B\u3002"
        },
        {
          id: "plunder_will",
          name_ja: "\u5438\u53CE\u306E\u610F\u5FD7",
          type: "PLUNDER_WILL",
          cost: 4,
          desc_ja: "\u6B21\u306E\u53CD\u8EE2\u679A\u6570\u3060\u3051\u76F8\u624B\u306E\u5E03\u77F3\u3092\u5438\u53CE\u3059\u308B\u3002"
        },
        {
          id: "work_01",
          name_ja: "\u51FA\u7A3C\u304E\u306E\u610F\u5FD7",
          type: "WORK_WILL",
          cost: 11,
          desc_ja: "\u6B21\u306E\u914D\u7F6E\u77F3\u3092\u30A2\u30F3\u30AB\u30FC\u5316\u3002\u81EA\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B1\u21922\u21924\u21928\u219216\u306E\u9806\u3067\u30C1\u30E3\u30FC\u30B8\u7372\u5F97\uFF08\u6700\u592730\uFF09\u3002\u5931\u3046\u3068\u7D42\u4E86\u3002"
        },
        {
          id: "double_01",
          name_ja: "\u4E8C\u9023\u6295\u77F3",
          type: "DOUBLE_PLACE",
          cost: 24,
          desc_ja: "\u3053\u306E\u30BF\u30FC\u30F3\u306F\u77F3\u30922\u56DE\u7F6E\u3051\u308B\u3002"
        },
        {
          id: "heaven_01",
          name_ja: "\u5929\u306E\u6075\u307F",
          type: "HEAVEN_BLESSING",
          cost: 3,
          desc_ja: "\u30E9\u30F3\u30C0\u30E0\u306A\u5019\u88DC5\u679A\u304B\u30891\u679A\u3092\u9078\u3093\u3067\u7372\u5F97\u3059\u308B\u3002"
        },
        {
          id: "condemn_01",
          name_ja: "\u65AD\u7F6A\u306E\u610F\u5FD7",
          type: "CONDEMN_WILL",
          cost: 6,
          desc_ja: "\u76F8\u624B\u624B\u672D\u3092\u516C\u958B\u3057\u30011\u679A\u9078\u3093\u3067\u7834\u58CA\u3059\u308B\u3002"
        },
        {
          id: "gold_stone",
          name_ja: "\u91D1\u306E\u610F\u5FD7",
          type: "GOLD_STONE",
          cost: 6,
          desc_ja: "\u6B21\u306E\u53CD\u8EE2\u3067\u5F97\u308B\u5E03\u77F3\u30924\u500D\u306B\u3059\u308B\u3002\u4F7F\u7528\u5F8C\u305D\u306E\u77F3\u306F\u6D88\u6EC5\u3002"
        },
        {
          id: "silver_stone",
          name_ja: "\u9280\u306E\u610F\u5FD7",
          type: "SILVER_STONE",
          cost: 3,
          desc_ja: "\u6B21\u306E\u53CD\u8EE2\u3067\u5F97\u308B\u5E03\u77F3\u30923\u500D\u306B\u3059\u308B\u3002\u4F7F\u7528\u5F8C\u305D\u306E\u77F3\u306F\u6D88\u6EC5\u3002"
        },
        {
          id: "steal_card_01",
          name_ja: "\u8EE2\u58F2\u306E\u610F\u5FD7",
          type: "STEAL_CARD",
          cost: 7,
          desc_ja: "\u3053\u306E\u624B\u306E\u53CD\u8EE2\u679A\u6570\u3076\u3093\u76F8\u624B\u624B\u672D\u304B\u3089\u30AB\u30FC\u30C9\u3092\u596A\u3063\u3066\u58F2\u5374\u3059\u308B\u3002\u58F2\u5374\u3057\u305F\u30AB\u30FC\u30C91\u679A\u306B\u3064\u304D\u5E03\u77F3\u30922\u7372\u5F97\u3002"
        },
        {
          id: "guard_01",
          name_ja: "\u5B88\u308B\u610F\u5FD7",
          type: "GUARD_WILL",
          cost: 2,
          desc_ja: "\u81EA\u5206\u306E\u77F31\u3064\u306B\u5B8C\u5168\u4FDD\u8B77\u3092\u4ED8\u4E0E\u3059\u308B\u30023\u30BF\u30FC\u30F3\u6301\u7D9A\u3002"
        },
        {
          id: "udg_01",
          name_ja: "\u7A76\u6975\u7834\u58CA\u795E",
          type: "ULTIMATE_DESTROY_GOD",
          cost: 25,
          desc_ja: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u7834\u58CA\u795E\u5316\u3002\u7F6E\u3044\u305F\u6642\u3068\u81EA\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B\u5468\u56F28\u30DE\u30B9\u306E\u6575\u77F3\u3092\u7834\u58CA\u30025\u30BF\u30FC\u30F3\u6301\u7D9A\u3002"
        },
        {
          id: "ultimate_hyperactive_01",
          name_ja: "\u7A76\u6975\u591A\u52D5\u795E",
          type: "ULTIMATE_HYPERACTIVE_GOD",
          cost: 28,
          desc_ja: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u7A76\u6975\u591A\u52D5\u795E\u5316\u3002\u4E21\u8005\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B1\u30DE\u30B9\u79FB\u52D5\u30922\u56DE\u884C\u3044\u3001\u79FB\u52D5\u5F8C\u306B\u631F\u3081\u3070\u53CD\u8EE2\u3002\u79FB\u52D5\u5148\u304C\u7121\u3044\u3068\u6D88\u6EC5\u3057\u3001\u5468\u56F28\u30DE\u30B9\u306E\u6575\u77F3\u3092\u7834\u58CA\u3002"
        }
      ]
    };
  }
});

// shared-constants.js
var require_shared_constants = __commonJS({
  "shared-constants.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory();
      } else {
        root.SharedConstants = factory();
      }
    })(typeof self !== "undefined" ? self : exports, function() {
      const BLACK = 1;
      const WHITE = -1;
      const EMPTY = 0;
      const DIRECTIONS = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1]
      ];
      const BOARD_SIZE = 8;
      const HAND_LIMIT = 5;
      const CHARGE_LIMIT = 3;
      const DRAW_PERIOD = 1;
      const DEFAULT_DECK = [
        // Minimal example deck structure; real deck is defined elsewhere (cards/catalog.json)
        { id: "free_01", count: 1 },
        { id: "hard_01", count: 1 },
        { id: "swap_01", count: 1 }
      ];
      let catalogCards = null;
      try {
        if (typeof window !== "undefined" && window.CardCatalog && Array.isArray(window.CardCatalog.cards)) {
          catalogCards = window.CardCatalog.cards.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            cost: c.cost,
            desc: c.desc,
            enabled: c.enabled
          }));
        }
      } catch (e) {
      }
      try {
        if (!catalogCards && typeof module === "object" && module.exports) {
          const json = require_catalog();
          if (json && Array.isArray(json.cards)) {
            catalogCards = json.cards.map((c) => ({
              id: c.id,
              name: c.name_ja,
              type: c.type,
              cost: c.cost,
              desc: c.desc_ja,
              enabled: c.enabled
            }));
          }
        }
      } catch (e) {
      }
      const CARD_DEFS_FALLBACK = [
        // TREASURE_BOX (宝箱) - 1 card, cost: 0
        { id: "chest_01", name: "\u5B9D\u7BB1", type: "TREASURE_BOX", cost: 0, desc: "\u4F7F\u7528\u6642\u306B\u5E03\u77F3\u30921\u301C3\u30E9\u30F3\u30C0\u30E0\u3067\u7372\u5F97\u3059\u308B\u3002" },
        // FREE_PLACEMENT (自由の意志) - 1 card, cost: 9
        { id: "free_01", name: "\u81EA\u7531\u306E\u610F\u5FD7", type: "FREE_PLACEMENT", cost: 9, desc: "\u53CD\u8EE2\u3067\u304D\u306A\u304F\u3066\u3082\u3001\u7A7A\u3044\u3066\u3044\u308B\u30DE\u30B9\u306A\u3089\u3069\u3053\u306B\u3067\u3082\u77F3\u3092\u7F6E\u3051\u308B" },
        // PROTECTED_NEXT_STONE (弱い意志) - 1 card, cost: 1
        { id: "hard_01", name: "\u5F31\u3044\u610F\u5FD7", type: "PROTECTED_NEXT_STONE", cost: 1, desc: "\u6B21\u306B\u7F6E\u3044\u305F\u77F3\u306F\u3001\u6B21\u306E\u76F8\u624B\u30BF\u30FC\u30F3\u306E\u9593\u3001\u53CD\u8EE2\u3055\u308C\u306A\u3044" },
        // SWAP_WITH_ENEMY (交換の意志) - 1 card, cost: 13
        { id: "swap_01", name: "\u4EA4\u63DB\u306E\u610F\u5FD7", type: "SWAP_WITH_ENEMY", cost: 13, desc: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u3001\u76F8\u624B\u306E\u77F31\u3064\u3068\u5165\u308C\u66FF\u3048\u3066\u914D\u7F6E\u3067\u304D\u308B" },
        // POSITION_SWAP_WILL (入替の意志) - 1 card, cost: 17
        { id: "position_swap_01", name: "\u5165\u66FF\u306E\u610F\u5FD7", type: "POSITION_SWAP_WILL", cost: 17, desc: "\u76E4\u9762\u4E0A\u306E\u77F32\u3064\u3092\u9078\u3073\u3001\u4F4D\u7F6E\u3092\u5165\u308C\u66FF\u3048\u308B\u3002\u901A\u5E38\u77F3\u30FB\u7279\u6B8A\u77F3\u30FB\u7206\u5F3E\u3092\u554F\u308F\u305A\u5BFE\u8C61\u306B\u3067\u304D\u308B\u3002" },
        // SACRIFICE_WILL (生贄の意志) - 1 card, cost: 5
        { id: "sacrifice_01", name: "\u751F\u8D04\u306E\u610F\u5FD7", type: "SACRIFICE_WILL", cost: 5, desc: "\u76E4\u9762\u4E0A\u306E\u81EA\u5206\u306E\u77F3\u3092\u6700\u59273\u3064\u307E\u3067\u9078\u3093\u3067\u7834\u58CA\u3057\u30011\u3064\u306B\u3064\u304D\u5E03\u77F3\u30925\u7372\u5F97\u3059\u308B\u3002" },
        // PERMA_PROTECT_NEXT_STONE (強い意志) - 1 card, cost: 12
        { id: "perma_01", name: "\u5F37\u3044\u610F\u5FD7", type: "PERMA_PROTECT_NEXT_STONE", cost: 12, desc: "\u6B21\u306B\u7F6E\u3044\u305F\u77F3\u306F\u3001\u305A\u3063\u3068\u53CD\u8EE2\u3055\u308C\u306A\u3044\u3002" },
        // STRONG_WIND_WILL (強風の意志) - 1 card, cost: 9
        { id: "strong_wind_01", name: "\u5F37\u98A8\u306E\u610F\u5FD7", type: "STRONG_WIND_WILL", cost: 9, desc: "\u76E4\u9762\u306E\u77F31\u3064\u3092\u9078\u3073\u3001\u6700\u3082\u9577\u304F\u9032\u3081\u308B\u4E0A\u4E0B\u5DE6\u53F3\u65B9\u5411\u3078\u98DB\u3070\u3059\uFF08\u540C\u8DDD\u96E2\u306F\u30E9\u30F3\u30C0\u30E0\uFF09\u3002\u79FB\u52D5\u3057\u305F\u30DE\u30B9\u6570\u3076\u3093\u5E03\u77F3\u3092\u5F97\u308B\u3002" },
        { id: "trap_01", name: "\u7F60\u306E\u610F\u5FD7", type: "TRAP_WILL", cost: 10, desc: "\u81EA\u5206\u306E\u77F3\u30921\u3064\u7F60\u77F3\u306B\u3059\u308B\u3002\u6B21\u306E\u76F8\u624B\u30BF\u30FC\u30F3\u4E2D\u306B\u53CD\u8EE2\u3055\u308C\u308B\u3068\u3001\u76F8\u624B\u306E\u5E03\u77F3\u5168\u6CA1\u53CE\uFF0B\u624B\u672D3\u679A\u6CA1\u53CE\u3002" },
        { id: "chain_01", name: "\u9023\u9396\u306E\u610F\u5FD7", type: "CHAIN_WILL", cost: 22, desc: "\u3053\u306E\u30BF\u30FC\u30F3\u306E\u914D\u7F6E\u3067\u767A\u751F\u3057\u305F\u901A\u5E38\u53CD\u8EE2\u3092\u8D77\u70B9\u306B\u3001\u8FFD\u52A0\u53CD\u8EE2\u3092\u6700\u59272\u56DE\u307E\u3067\u884C\u3046\u3002" },
        { id: "regen_01", name: "\u5FA9\u6D3B\u306E\u610F\u5FD7", type: "REGEN_WILL", cost: 15, desc: "\u6B21\u306B\u7F6E\u3044\u305F\u77F3\u306F1\u56DE\u3060\u3051\u518D\u751F\u3057\u3001\u53CD\u8EE2\u3055\u308C\u305F\u3089\u5143\u306E\u8272\u306B\u623B\u308B\u3002\u623B\u3063\u305F\u7D50\u679C\u3001\u305D\u306E\u30DE\u30B9\u3092\u8D77\u70B9\u306B\u631F\u3081\u308B\u5217\u304C\u3042\u308C\u3070\u6210\u7ACB\u3059\u308B\u65B9\u5411\u306E\u77F3\u3092\u53CD\u8EE2\u3059\u308B\u3002" },
        // DESTROY_ONE_STONE (破壊神) - 1 card, cost: 14
        { id: "destroy_01", name: "\u7834\u58CA\u795E", type: "DESTROY_ONE_STONE", cost: 14, desc: "\u76E4\u4E0A\u306E\u77F3\u30921\u3064\u9078\u3073\u3001\u7834\u58CA\u3059\u308B\u3002" },
        // TIME_BOMB (時限爆弾) - 1 card, cost: 13
        { id: "bomb_01", name: "\u6642\u9650\u7206\u5F3E", type: "TIME_BOMB", cost: 13, desc: "\u76E4\u9762\u4E0A\u306E\u81EA\u5206\u306E\u77F31\u3064\u3092\u6642\u9650\u7206\u5F3E\u5316\u30023\u30BF\u30FC\u30F3\u5F8C\u306B\u5468\u56F29\u30DE\u30B9\u3092\u7834\u58CA\u3002\u53CD\u8EE2\u3055\u308C\u308B\u3068\u89E3\u9664\u3002" },
        // ULTIMATE_REVERSE_DRAGON (究極反転龍) - 1 card, cost: 30
        { id: "udr_01", name: "\u7A76\u6975\u53CD\u8EE2\u9F8D", type: "ULTIMATE_REVERSE_DRAGON", cost: 30, desc: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u9F8D\u5316\u3002\u914D\u7F6E\u30BF\u30FC\u30F3\u5373\u6642\uFF0B\u81EA\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u3001\u5468\u56F28\u30DE\u30B9\u306E\u76F8\u624B\u77F3\u3092\u81EA\u5206\u8272\u306B\u53CD\u8EE2\uFF08\u53CD\u8EE2\u6570\u306F\u30C1\u30E3\u30FC\u30B8\u5BFE\u8C61\uFF09\u3002\u6301\u7D9A5\u30BF\u30FC\u30F3\uFF08\u914D\u7F6E\u30BF\u30FC\u30F3\u542B\u3081\u6700\u59276\u56DE\u767A\u52D5\uFF09\u3067\u6D88\u6EC5\u3002" },
        // BREEDING_WILL (繁殖の意志) - 1 card, cost: 16
        { id: "breeding_01", name: "\u7E41\u6B96\u306E\u610F\u5FD7", type: "BREEDING_WILL", cost: 16, desc: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u7E41\u6B96\u77F3\u5316\u3002\u914D\u7F6E\u6642\u3068\u81EA\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B\u5468\u56F28\u30DE\u30B9\u3078\u30E9\u30F3\u30C0\u30E01\u500B\u751F\u6210\u3002\u4EE5\u5F8C\u306F\u524D\u56DE\u751F\u6210\u77F3\u306E\u5468\u56F2\u3078\u62E1\u6563\u3002\u751F\u6210\u77F3\u304C\u53CD\u8EE2/\u6D88\u6EC5\u3057\u305F\u5834\u5408\u306F\u89AA\u77F3\u8D77\u70B9\u306B\u623B\u308B\u3002\u6301\u7D9A3\u30BF\u30FC\u30F3\u3002" },
        { id: "cross_bomb_01", name: "\u5341\u5B57\u7206\u5F3E", type: "CROSS_BOMB", cost: 18, desc: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u5341\u5B57\u7206\u5F3E\u5316\u3002\u901A\u5E38\u53CD\u8EE2\u5F8C\u306B\u5373\u8D77\u7206\u3057\u3001\u4E2D\u5FC3\u3068\u7E26\u6A2A2\u30DE\u30B9\u306E\u77F3\u3092\u7834\u58CA\u3059\u308B\u3002" },
        // HYPERACTIVE_WILL (多動の意志) - 1 card, cost: 8
        { id: "hyperactive_01", name: "\u591A\u52D5\u306E\u610F\u5FD7", type: "HYPERACTIVE_WILL", cost: 8, desc: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u591A\u52D5\u77F3\u5316\u3002\u4E21\u8005\u306E\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B\u3001\u5468\u56F28\u30DE\u30B9\u306E\u7A7A\u304D\u3078\u30E9\u30F3\u30C0\u30E0\u306B1\u30DE\u30B9\u79FB\u52D5\u3057\u3001\u79FB\u52D5\u5F8C\u306B\u631F\u3081\u308B\u5834\u5408\u306F\u901A\u5E38\u53CD\u8EE2\u3002" },
        // SELL_CARD_WILL (売却の意志) - 1 card, cost: 8
        { id: "sell_01", name: "\u58F2\u5374\u306E\u610F\u5FD7", type: "SELL_CARD_WILL", cost: 8, desc: "\u30AB\u30FC\u30C9\u4F7F\u7528\u5F8C\u3001\u81EA\u5206\u306E\u624B\u672D\u304B\u30891\u679A\u3092\u58F2\u5374\u3057\u3001\u305D\u306E\u30AB\u30FC\u30C9\u306E\u30B3\u30B9\u30C8\u5206\u306E\u5E03\u77F3\u3092\u7372\u5F97\u3059\u308B\u3002" },
        // PLUNDER_WILL (吸収の意志) - 1 card, cost: 4
        { id: "plunder_will", name: "\u5438\u53CE\u306E\u610F\u5FD7", type: "PLUNDER_WILL", cost: 4, desc: "\u6B21\u306E\u53CD\u8EE2\u6570\u3060\u3051\u76F8\u624B\u306E\u5E03\u77F3\u3092\u5438\u53CE\u3059\u308B\u3002" },
        { id: "work_01", name: "\u51FA\u7A3C\u304E\u306E\u610F\u5FD7", type: "WORK_WILL", cost: 11, desc: "\u6B21\u306E\u914D\u7F6E\u3092\u30A2\u30F3\u30AB\u30FC\u306B\u3057\u3066\u3001\u305D\u306E\u77F3\u304C\u3042\u308B\u9650\u308A\u81EA\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B1,2,4,8,16\u306E\u9806\u3067\u30C1\u30E3\u30FC\u30B8\u3092\u5F97\u308B\uFF08\u6700\u592730\uFF09\u3002\u77F3\u304C\u76F8\u624B\u306B\u53D6\u3089\u308C\u308B\u304B\u7834\u58CA\u3055\u308C\u308B\u3068\u52B9\u679C\u306F\u7D42\u4E86\u3059\u308B\u3002" },
        // DOUBLE_PLACE (二連投石) - 1 card, cost: 24
        { id: "double_01", name: "\u4E8C\u9023\u6295\u77F3", type: "DOUBLE_PLACE", cost: 24, desc: "\u3053\u306E\u30BF\u30FC\u30F3\u3001\u77F3\u30922\u56DE\u7F6E\u3051\u308B\u3002" },
        // HEAVEN_BLESSING (天の恵み) - 1 card, cost: 3
        { id: "heaven_01", name: "\u5929\u306E\u6075\u307F", type: "HEAVEN_BLESSING", cost: 3, desc: "\u30E9\u30F3\u30C0\u30E0\u306A\u5019\u88DC5\u679A\u304B\u30891\u679A\u3092\u9078\u3093\u3067\u7372\u5F97\u3059\u308B\u3002" },
        // CONDEMN_WILL (断罪の意志) - 1 card, cost: 6
        { id: "condemn_01", name: "\u65AD\u7F6A\u306E\u610F\u5FD7", type: "CONDEMN_WILL", cost: 6, desc: "\u76F8\u624B\u624B\u672D\u3092\u516C\u958B\u3057\u30011\u679A\u9078\u3093\u3067\u7834\u58CA\u3059\u308B\u3002" },
        // GOLD_STONE (金の意志) - 1 card, cost: 6
        { id: "gold_stone", name: "\u91D1\u306E\u610F\u5FD7", type: "GOLD_STONE", cost: 6, desc: "\u6B21\u306E\u53CD\u8EE2\u3067\u5F97\u308B\u5E03\u77F3\u304C4\u500D\u3002\u4F7F\u7528\u5F8C\u305D\u306E\u77F3\u306F\u6D88\u6EC5\u3059\u308B\u3002" },
        // STEAL_CARD (転売の意志) - 1 card, cost: 7
        { id: "steal_card_01", name: "\u8EE2\u58F2\u306E\u610F\u5FD7", type: "STEAL_CARD", cost: 7, desc: "\u3053\u306E\u624B\u306E\u53CD\u8EE2\u679A\u6570\u3076\u3093\u76F8\u624B\u624B\u672D\u304B\u3089\u30AB\u30FC\u30C9\u3092\u596A\u3063\u3066\u58F2\u5374\u3059\u308B\u3002\u58F2\u5374\u3057\u305F\u30AB\u30FC\u30C91\u679A\u306B\u3064\u304D\u5E03\u77F3\u30922\u7372\u5F97\u3002" },
        // GUARD_WILL (守る意志) - 1 card, cost: 2
        { id: "guard_01", name: "\u5B88\u308B\u610F\u5FD7", type: "GUARD_WILL", cost: 2, desc: "\u81EA\u5206\u306E\u77F31\u3064\u306B\u5B8C\u5168\u4FDD\u8B77\u3092\u4ED8\u4E0E\u3059\u308B\u30023\u30BF\u30FC\u30F3\u6301\u7D9A\u3002" },
        // ULTIMATE_DESTROY_GOD (究極破壊神) - 1 card, cost: 25
        { id: "udg_01", name: "\u7A76\u6975\u7834\u58CA\u795E", type: "ULTIMATE_DESTROY_GOD", cost: 25, desc: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u7A76\u6975\u7834\u58CA\u795E\u5316\u3002\u914D\u7F6E\u30BF\u30FC\u30F3\u5373\u6642\uFF0B\u81EA\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u3001\u5468\u56F28\u30DE\u30B9\u306E\u6575\u77F3\u3092\u7834\u58CA\u3002\u6301\u7D9A5\u30BF\u30FC\u30F3\uFF08\u914D\u7F6E\u30BF\u30FC\u30F3\u542B\u3081\u6700\u59276\u56DE\uFF09\u3002" },
        // ULTIMATE_HYPERACTIVE_GOD (究極多動神) - 1 card, cost: 28
        { id: "ultimate_hyperactive_01", name: "\u7A76\u6975\u591A\u52D5\u795E", type: "ULTIMATE_HYPERACTIVE_GOD", cost: 28, desc: "\u6B21\u306B\u7F6E\u304F\u77F3\u3092\u7A76\u6975\u591A\u52D5\u795E\u5316\u3002\u4E21\u8005\u30BF\u30FC\u30F3\u958B\u59CB\u6642\u306B1\u30DE\u30B9\u79FB\u52D5\u30922\u56DE\u884C\u3044\u3001\u79FB\u52D5\u5F8C\u306B\u631F\u3081\u3070\u53CD\u8EE2\u3002\u79FB\u52D5\u5148\u304C\u7121\u3044\u3068\u6D88\u6EC5\u3057\u3001\u5468\u56F28\u30DE\u30B9\u306E\u6575\u77F3\u3092\u7834\u58CA\u3002" }
      ];
      const CARD_DEFS = catalogCards && catalogCards.length ? catalogCards : CARD_DEFS_FALLBACK;
      const CARD_TYPE_BY_ID = CARD_DEFS.reduce((map, card) => {
        map[card.id] = card.type;
        return map;
      }, {});
      const CARD_TYPES = [
        "TREASURE_BOX",
        "FREE_PLACEMENT",
        "PROTECTED_NEXT_STONE",
        "SWAP_WITH_ENEMY",
        "POSITION_SWAP_WILL",
        "SACRIFICE_WILL",
        "PERMA_PROTECT_NEXT_STONE",
        "STRONG_WIND_WILL",
        "TRAP_WILL",
        "TEMPT_WILL",
        "CHAIN_WILL",
        "REGEN_WILL",
        "DESTROY_ONE_STONE",
        "TIME_BOMB",
        "ULTIMATE_REVERSE_DRAGON",
        "BREEDING_WILL",
        "CROSS_BOMB",
        "DOUBLE_PLACE",
        "HEAVEN_BLESSING",
        "CONDEMN_WILL",
        "PLUNDER_WILL",
        "WORK_WILL",
        "GOLD_STONE",
        "SILVER_STONE",
        "STEAL_CARD",
        "GUARD_WILL",
        "ULTIMATE_DESTROY_GOD",
        "ULTIMATE_HYPERACTIVE_GOD",
        "HYPERACTIVE_WILL",
        "SELL_CARD_WILL"
      ];
      const DEBUG_MODE = {
        TURBO_AI_BATTLE: false,
        // レベル1同士の超高速対局（モーションなし）
        SKIP_ANIMATIONS: false
        // アニメーションをスキップ
      };
      const TIME_BOMB_TURNS = 3;
      const DESTROY_FADE_MS = 500;
      const exports2 = {
        // Board constants
        BLACK,
        WHITE,
        EMPTY,
        DIRECTIONS,
        BOARD_SIZE,
        HAND_LIMIT,
        CHARGE_LIMIT,
        DRAW_PERIOD,
        DEFAULT_DECK,
        // Card definitions
        CARD_DEFS,
        CARD_TYPE_BY_ID,
        CARD_TYPES,
        // Card info
        MAX_SWAP_TARGETS: 6,
        MAX_DESTROY_TARGETS: 8,
        TIME_BOMB_TURNS,
        DESTROY_FADE_MS
      };
      if (typeof window !== "undefined") {
        window.BLACK = BLACK;
        window.WHITE = WHITE;
        window.EMPTY = EMPTY;
        window.DIRECTIONS = DIRECTIONS;
        window.CARD_DEFS = CARD_DEFS;
        window.CARD_TYPE_BY_ID = CARD_TYPE_BY_ID;
        window.CARD_TYPES = CARD_TYPES;
        window.DEBUG_MODE = DEBUG_MODE;
        window.TIME_BOMB_TURNS = TIME_BOMB_TURNS;
        window.DESTROY_FADE_MS = DESTROY_FADE_MS;
        window.BOARD_SIZE = BOARD_SIZE;
        window.HAND_LIMIT = HAND_LIMIT;
        window.CHARGE_LIMIT = CHARGE_LIMIT;
        window.DRAW_PERIOD = DRAW_PERIOD;
        window.DEFAULT_DECK = DEFAULT_DECK;
      }
      return exports2;
    });
  }
});

// game/logic/core.js
var require_core = __commonJS({
  "game/logic/core.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        const core = factory(root.SharedConstants);
        root.CoreLogic = core;
        if (typeof root.Core === "undefined") {
          root.Core = core;
        }
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { BLACK, WHITE, EMPTY, DIRECTIONS } = SharedConstants || {};
      if (BLACK === void 0) {
        throw new Error("SharedConstants not loaded");
      }
      function createGameState() {
        const board = [];
        for (let i = 0; i < 8; i++) {
          board.push([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
        }
        board[3][3] = WHITE;
        board[3][4] = BLACK;
        board[4][3] = BLACK;
        board[4][4] = WHITE;
        return {
          board,
          currentPlayer: BLACK,
          consecutivePasses: 0,
          turnNumber: 0
        };
      }
      __name(createGameState, "createGameState");
      function copyGameState(state) {
        const newBoard = state.board.map((row) => row.slice());
        return {
          board: newBoard,
          currentPlayer: state.currentPlayer,
          consecutivePasses: state.consecutivePasses,
          turnNumber: state.turnNumber || 0
        };
      }
      __name(copyGameState, "copyGameState");
      function getFlipsWithContext(state, row, col, player, context = {}) {
        if (state.board[row][col] !== EMPTY) return [];
        const protectedStones = context.protectedStones || [];
        const permaProtectedStones = context.permaProtectedStones || [];
        const protectedSet = protectedStones.length ? new Set(protectedStones.map((p) => `${p.row},${p.col}`)) : null;
        const permaSet = permaProtectedStones.length ? new Set(permaProtectedStones.map((p) => `${p.row},${p.col}`)) : null;
        const allFlips = [];
        for (const [dr, dc] of DIRECTIONS) {
          const flips = [];
          let r = row + dr;
          let c = col + dc;
          while (r >= 0 && r < 8 && c >= 0 && c < 8 && state.board[r][c] === -player) {
            if (protectedSet && protectedSet.has(`${r},${c}`) || permaSet && permaSet.has(`${r},${c}`)) {
              flips.length = 0;
              break;
            }
            flips.push([r, c]);
            r += dr;
            c += dc;
          }
          if (flips.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && state.board[r][c] === player) {
            allFlips.push(...flips);
          }
        }
        return allFlips;
      }
      __name(getFlipsWithContext, "getFlipsWithContext");
      function applyMove(state, move) {
        const newState = copyGameState(state);
        newState.board[move.row][move.col] = state.currentPlayer;
        for (const [r, c] of move.flips) {
          newState.board[r][c] = state.currentPlayer;
        }
        newState.currentPlayer = -state.currentPlayer;
        newState.consecutivePasses = 0;
        newState.turnNumber = (state.turnNumber || 0) + 1;
        return newState;
      }
      __name(applyMove, "applyMove");
      function applyPass(state) {
        const newState = copyGameState(state);
        newState.currentPlayer = -newState.currentPlayer;
        newState.consecutivePasses = state.consecutivePasses + 1;
        newState.turnNumber = (state.turnNumber || 0) + 1;
        return newState;
      }
      __name(applyPass, "applyPass");
      function isGameOver(state) {
        if (state.consecutivePasses >= 2) return true;
        let emptyCount = 0;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (state.board[r][c] === EMPTY) emptyCount++;
          }
        }
        return emptyCount === 0;
      }
      __name(isGameOver, "isGameOver");
      function countDiscs(state) {
        let black = 0, white = 0;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (state.board[r][c] === BLACK) black++;
            else if (state.board[r][c] === WHITE) white++;
          }
        }
        return { black, white };
      }
      __name(countDiscs, "countDiscs");
      function getLegalMoves(state, player, context = {}) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (state.board[r][c] === EMPTY) {
              const flips = getFlipsWithContext(state, r, c, player, context);
              if (flips.length > 0) {
                moves.push({ row: r, col: c, flips });
              }
            }
          }
        }
        return moves;
      }
      __name(getLegalMoves, "getLegalMoves");
      function getFreePlacementMoves(state, player, context = {}) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (state.board[r][c] === EMPTY) {
              const flips = getFlipsWithContext(state, r, c, player, context);
              moves.push({ row: r, col: c, flips });
            }
          }
        }
        return moves;
      }
      __name(getFreePlacementMoves, "getFreePlacementMoves");
      function hasLegalMove(state, player, context = {}) {
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (state.board[r][c] === EMPTY) {
              const flips = getFlipsWithContext(state, r, c, player, context);
              if (flips.length > 0) return true;
            }
          }
        }
        return false;
      }
      __name(hasLegalMove, "hasLegalMove");
      return {
        // Constants
        BLACK,
        WHITE,
        EMPTY,
        DIRECTIONS,
        // State management
        createGameState,
        copyGameState,
        // Move logic
        getFlipsWithContext,
        applyMove,
        applyPass,
        // Game status
        isGameOver,
        countDiscs,
        // Move generation
        getLegalMoves,
        getFreePlacementMoves,
        hasLegalMove
      };
    });
  }
});

// game/logic/cards/costs.js
var require_costs = __commonJS({
  "game/logic/cards/costs.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardCosts = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { CARD_DEFS } = SharedConstants || {};
      if (!CARD_DEFS) {
        throw new Error("SharedConstants not loaded");
      }
      function getCardDef(cardId) {
        return CARD_DEFS.find((c) => c.id === cardId) || null;
      }
      __name(getCardDef, "getCardDef");
      function getCardCost(cardId) {
        const def = getCardDef(cardId);
        return def ? def.cost : 0;
      }
      __name(getCardCost, "getCardCost");
      return {
        getCardCost
      };
    });
  }
});

// game/logic/cards/defs.js
var require_defs = __commonJS({
  "game/logic/cards/defs.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardDefs = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { CARD_DEFS, CARD_TYPE_BY_ID } = SharedConstants || {};
      if (!CARD_DEFS) {
        throw new Error("SharedConstants not loaded");
      }
      const CARD_DEF_BY_ID = CARD_DEFS.reduce((map, def) => {
        map[def.id] = def;
        return map;
      }, {});
      const CARD_ID_BY_NAME = CARD_DEFS.reduce((map, def) => {
        if (def.name) {
          map[def.name] = def.id;
        }
        return map;
      }, {});
      function getCardDef(cardId) {
        return CARD_DEF_BY_ID[cardId] || null;
      }
      __name(getCardDef, "getCardDef");
      function getCardType(cardId) {
        return CARD_TYPE_BY_ID[cardId] || null;
      }
      __name(getCardType, "getCardType");
      function getCardDisplayName(cardId) {
        const def = getCardDef(cardId);
        return def ? def.name : "";
      }
      __name(getCardDisplayName, "getCardDisplayName");
      function getCardCodeName(displayName) {
        return CARD_ID_BY_NAME[displayName] || null;
      }
      __name(getCardCodeName, "getCardCodeName");
      return {
        getCardDef,
        getCardType,
        getCardDisplayName,
        getCardCodeName
      };
    });
  }
});

// game/logic/markers_adapter.js
var require_markers_adapter = __commonJS({
  "game/logic/markers_adapter.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory();
      } else {
        root.MarkersAdapter = factory();
      }
    })(typeof self !== "undefined" ? self : exports, function() {
      "use strict";
      const MARKER_KINDS = {
        SPECIAL_STONE: "specialStone",
        BOMB: "bomb"
      };
      function fromSpecialStone(stone, id) {
        return {
          id,
          row: stone.row,
          col: stone.col,
          kind: MARKER_KINDS.SPECIAL_STONE,
          owner: stone.owner,
          createdSeq: typeof stone.createdSeq === "number" ? stone.createdSeq : id,
          data: {
            type: stone.type,
            remainingOwnerTurns: stone.remainingOwnerTurns,
            expiresForPlayer: stone.expiresForPlayer,
            autoRemove: stone.autoRemove,
            hyperactiveSeq: stone.hyperactiveSeq,
            regenRemaining: stone.regenRemaining,
            ownerColor: stone.ownerColor,
            chainPriority: stone.chainPriority
          }
        };
      }
      __name(fromSpecialStone, "fromSpecialStone");
      function fromBomb(bomb, id) {
        return {
          id,
          row: bomb.row,
          col: bomb.col,
          kind: MARKER_KINDS.BOMB,
          owner: bomb.owner,
          createdSeq: typeof bomb.createdSeq === "number" ? bomb.createdSeq : id,
          data: {
            remainingTurns: bomb.remainingTurns,
            placedTurn: bomb.placedTurn
          }
        };
      }
      __name(fromBomb, "fromBomb");
      function toSpecialStone(marker) {
        if (marker.kind !== MARKER_KINDS.SPECIAL_STONE) return null;
        return {
          row: marker.row,
          col: marker.col,
          type: marker.data.type,
          owner: marker.owner,
          remainingOwnerTurns: marker.data.remainingOwnerTurns,
          expiresForPlayer: marker.data.expiresForPlayer,
          autoRemove: marker.data.autoRemove,
          hyperactiveSeq: marker.data.hyperactiveSeq,
          regenRemaining: marker.data.regenRemaining,
          ownerColor: marker.data.ownerColor,
          chainPriority: marker.data.chainPriority,
          createdSeq: marker.createdSeq
        };
      }
      __name(toSpecialStone, "toSpecialStone");
      function toBomb(marker) {
        if (marker.kind !== MARKER_KINDS.BOMB) return null;
        return {
          row: marker.row,
          col: marker.col,
          remainingTurns: marker.data.remainingTurns,
          owner: marker.owner,
          placedTurn: marker.data.placedTurn,
          createdSeq: marker.createdSeq
        };
      }
      __name(toBomb, "toBomb");
      function markersToSpecialStones(markers) {
        return markers.filter((m) => m.kind === MARKER_KINDS.SPECIAL_STONE).map(toSpecialStone);
      }
      __name(markersToSpecialStones, "markersToSpecialStones");
      function markersToBombs(markers) {
        return markers.filter((m) => m.kind === MARKER_KINDS.BOMB).map(toBomb);
      }
      __name(markersToBombs, "markersToBombs");
      function toMarkers(specialStones, bombs, startId = 1) {
        let id = startId;
        const markers = [];
        for (const stone of specialStones || []) {
          markers.push(fromSpecialStone(stone, id++));
        }
        for (const bomb of bombs || []) {
          markers.push(fromBomb(bomb, id++));
        }
        return { markers, nextId: id };
      }
      __name(toMarkers, "toMarkers");
      function syncMarkersToLegacy(cardState2) {
        if (!cardState2.markers) return;
        cardState2.specialStones = markersToSpecialStones(cardState2.markers);
        cardState2.bombs = markersToBombs(cardState2.markers);
      }
      __name(syncMarkersToLegacy, "syncMarkersToLegacy");
      function syncLegacyToMarkers(cardState2) {
        const result = toMarkers(
          cardState2.specialStones,
          cardState2.bombs,
          cardState2._nextMarkerId || 1
        );
        cardState2.markers = result.markers;
        cardState2._nextMarkerId = result.nextId;
      }
      __name(syncLegacyToMarkers, "syncLegacyToMarkers");
      function ensureMarkers(cardState2) {
        if (!cardState2) return;
        if (!Array.isArray(cardState2.markers)) cardState2.markers = [];
        if (typeof cardState2._nextMarkerId !== "number") cardState2._nextMarkerId = 1;
        if (typeof cardState2._nextCreatedSeq !== "number") cardState2._nextCreatedSeq = 1;
      }
      __name(ensureMarkers, "ensureMarkers");
      function getMarkers(cardState2) {
        return cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
      }
      __name(getMarkers, "getMarkers");
      function getSpecialMarkers(cardState2) {
        return getMarkers(cardState2).filter((m) => m.kind === MARKER_KINDS.SPECIAL_STONE);
      }
      __name(getSpecialMarkers, "getSpecialMarkers");
      function getBombMarkers(cardState2) {
        return getMarkers(cardState2).filter((m) => m.kind === MARKER_KINDS.BOMB);
      }
      __name(getBombMarkers, "getBombMarkers");
      function findSpecialMarkerAt(cardState2, row, col, type, owner) {
        return getMarkers(cardState2).find((m) => m.kind === MARKER_KINDS.SPECIAL_STONE && m.row === row && m.col === col && (type ? m.data && m.data.type === type : true) && (owner ? m.owner === owner : true));
      }
      __name(findSpecialMarkerAt, "findSpecialMarkerAt");
      function findBombMarkerAt(cardState2, row, col) {
        return getMarkers(cardState2).find((m) => m.kind === MARKER_KINDS.BOMB && m.row === row && m.col === col);
      }
      __name(findBombMarkerAt, "findBombMarkerAt");
      function removeMarkers(cardState2, predicate) {
        if (!cardState2 || !Array.isArray(cardState2.markers)) return;
        cardState2.markers = cardState2.markers.filter((m) => !predicate(m));
      }
      __name(removeMarkers, "removeMarkers");
      function removeMarkersAt(cardState2, row, col, options) {
        const opts = options || {};
        removeMarkers(cardState2, (m) => {
          if (m.row !== row || m.col !== col) return false;
          if (opts.kind && m.kind !== opts.kind) return false;
          if (opts.type && (!m.data || m.data.type !== opts.type)) return false;
          if (opts.owner && m.owner !== opts.owner) return false;
          return true;
        });
      }
      __name(removeMarkersAt, "removeMarkersAt");
      return {
        MARKER_KINDS,
        fromSpecialStone,
        fromBomb,
        toSpecialStone,
        toBomb,
        markersToSpecialStones,
        markersToBombs,
        toMarkers,
        syncMarkersToLegacy,
        syncLegacyToMarkers,
        ensureMarkers,
        getMarkers,
        getSpecialMarkers,
        getBombMarkers,
        findSpecialMarkerAt,
        findBombMarkerAt,
        removeMarkers,
        removeMarkersAt
      };
    });
  }
});

// game/logic/cards/utils.js
var require_utils = __commonJS({
  "game/logic/cards/utils.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardUtils = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { BLACK, WHITE, EMPTY } = SharedConstants || {};
      const MarkersAdapter2 = (() => {
        if (typeof __require === "function") {
          try {
            return require_markers_adapter();
          } catch (e) {
            return null;
          }
        }
        const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
        return globalScope.MarkersAdapter || null;
      })();
      const MARKER_KINDS = MarkersAdapter2 && MarkersAdapter2.MARKER_KINDS;
      if (BLACK === void 0 || WHITE === void 0 || EMPTY === void 0) {
        throw new Error("SharedConstants not loaded");
      }
      function getSpecialMarkerAt(cardState2, row, col) {
        const markers = cardState2 && cardState2.markers ? cardState2.markers : [];
        const special = markers.find((m) => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone") && m.row === row && m.col === col);
        if (special) return { kind: "specialStone", marker: special };
        const bomb = markers.find((m) => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb") && m.row === row && m.col === col);
        if (bomb) return { kind: "bomb", marker: bomb };
        return null;
      }
      __name(getSpecialMarkerAt, "getSpecialMarkerAt");
      function isSpecialStoneAt(cardState2, row, col) {
        return !!getSpecialMarkerAt(cardState2, row, col);
      }
      __name(isSpecialStoneAt, "isSpecialStoneAt");
      function getSpecialOwnerAt(cardState2, row, col) {
        const entry = getSpecialMarkerAt(cardState2, row, col);
        if (!entry) return null;
        return entry.marker && entry.marker.owner ? entry.marker.owner : null;
      }
      __name(getSpecialOwnerAt, "getSpecialOwnerAt");
      function isNormalStoneForPlayer(cardState2, gameState, playerKey, row, col) {
        const playerVal = playerKey === "black" ? BLACK : WHITE;
        if (gameState.board[row][col] !== playerVal) return false;
        const markers = cardState2 && cardState2.markers ? cardState2.markers : [];
        if (markers.some((m) => m.row === row && m.col === col && m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone"))) return false;
        if (markers.some((m) => m.row === row && m.col === col && m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb"))) return false;
        return true;
      }
      __name(isNormalStoneForPlayer, "isNormalStoneForPlayer");
      function normalizePlayerKey2(playerKey) {
        if (playerKey === "black" || playerKey === BLACK || playerKey === 1 || playerKey === "1") return "black";
        if (playerKey === "white" || playerKey === WHITE || playerKey === -1 || playerKey === "-1") return "white";
        return null;
      }
      __name(normalizePlayerKey2, "normalizePlayerKey");
      function ensureChargeState(cardState2) {
        if (!cardState2) return;
        if (!cardState2.charge) cardState2.charge = { black: 0, white: 0 };
        if (!Array.isArray(cardState2.chargeDeltaEvents)) cardState2.chargeDeltaEvents = [];
        if (typeof cardState2._nextChargeDeltaSeq !== "number") cardState2._nextChargeDeltaSeq = 1;
      }
      __name(ensureChargeState, "ensureChargeState");
      function enqueueChargeDelta(cardState2, playerKey, before, after, reason) {
        if (!cardState2) return;
        const normalized = normalizePlayerKey2(playerKey);
        if (!normalized) return;
        const delta = after - before;
        if (!Number.isFinite(delta) || delta === 0) return;
        ensureChargeState(cardState2);
        cardState2.chargeDeltaEvents.push({
          seq: cardState2._nextChargeDeltaSeq++,
          player: normalized,
          delta,
          before,
          after,
          reason: reason || null
        });
      }
      __name(enqueueChargeDelta, "enqueueChargeDelta");
      function setChargeWithDelta(cardState2, playerKey, nextValue, reason) {
        const normalized = normalizePlayerKey2(playerKey);
        if (!cardState2 || !normalized) return { changed: false, before: 0, after: 0, delta: 0 };
        ensureChargeState(cardState2);
        const beforeRaw = Number(cardState2.charge[normalized] || 0);
        const safeBefore = Number.isFinite(beforeRaw) ? beforeRaw : 0;
        const requested = Number(nextValue);
        const safeRequested = Number.isFinite(requested) ? requested : safeBefore;
        const after = Math.max(0, Math.min(30, safeRequested));
        cardState2.charge[normalized] = after;
        enqueueChargeDelta(cardState2, normalized, safeBefore, after, reason);
        return {
          changed: after !== safeBefore,
          before: safeBefore,
          after,
          delta: after - safeBefore
        };
      }
      __name(setChargeWithDelta, "setChargeWithDelta");
      function addChargeWithDelta(cardState2, playerKey, amount, reason) {
        const normalized = normalizePlayerKey2(playerKey);
        if (!cardState2 || !normalized) return { changed: false, before: 0, after: 0, delta: 0 };
        ensureChargeState(cardState2);
        const beforeRaw = Number(cardState2.charge[normalized] || 0);
        const safeBefore = Number.isFinite(beforeRaw) ? beforeRaw : 0;
        const add = Number(amount);
        const safeAdd = Number.isFinite(add) ? add : 0;
        return setChargeWithDelta(cardState2, normalized, safeBefore + safeAdd, reason);
      }
      __name(addChargeWithDelta, "addChargeWithDelta");
      return {
        getSpecialMarkerAt,
        isSpecialStoneAt,
        getSpecialOwnerAt,
        isNormalStoneForPlayer,
        normalizePlayerKey: normalizePlayerKey2,
        setChargeWithDelta,
        addChargeWithDelta
      };
    });
  }
});

// game/logic/cards/selectors.js
var require_selectors = __commonJS({
  "game/logic/cards/selectors.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants(), require_utils());
      } else {
        root.CardSelectors = factory(root.SharedConstants, root.CardUtils);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants, CardUtils) {
      "use strict";
      const { EMPTY } = SharedConstants || {};
      if (EMPTY === void 0) {
        throw new Error("SharedConstants not loaded");
      }
      function getDestroyTargets(cardState2, gameState) {
        const res = [];
        const markers = cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] === EMPTY) continue;
            const guarded = markers.some(
              (m) => m && m.kind === "specialStone" && m.row === r && m.col === c && m.data && m.data.type === "GUARD"
            );
            if (guarded) continue;
            res.push({ row: r, col: c });
          }
        }
        return res;
      }
      __name(getDestroyTargets, "getDestroyTargets");
      function getSwapTargets(cardState2, gameState, playerKey) {
        const res = [];
        const opVal = playerKey === "black" ? SharedConstants.WHITE : SharedConstants.BLACK;
        const markers = cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
        const isHiddenTrapForPlayer = /* @__PURE__ */ __name((m) => m && m.kind === "specialStone" && m.data && m.data.type === "TRAP" && m.owner && m.owner !== playerKey, "isHiddenTrapForPlayer");
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] !== opVal) continue;
            const hasSpecialOrBomb = markers.some((m) => {
              if (!m || m.row !== r || m.col !== c) return false;
              if (m.kind === "bomb") return true;
              if (m.kind !== "specialStone") return false;
              if (isHiddenTrapForPlayer(m)) return false;
              return true;
            });
            if (hasSpecialOrBomb) continue;
            res.push({ row: r, col: c });
          }
        }
        return res;
      }
      __name(getSwapTargets, "getSwapTargets");
      function getPositionSwapTargets(cardState2, gameState, playerKey, pending) {
        const res = [];
        const first = pending && pending.firstTarget ? pending.firstTarget : null;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] === EMPTY) continue;
            if (first && first.row === r && first.col === c) continue;
            res.push({ row: r, col: c });
          }
        }
        return res;
      }
      __name(getPositionSwapTargets, "getPositionSwapTargets");
      function getSacrificeTargets(cardState2, gameState, playerKey) {
        const res = [];
        const playerVal = playerKey === "black" ? SharedConstants.BLACK : SharedConstants.WHITE;
        const markers = cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] === playerVal) {
              const guarded = markers.some(
                (m) => m && m.kind === "specialStone" && m.row === r && m.col === c && m.data && m.data.type === "GUARD"
              );
              if (guarded) continue;
              res.push({ row: r, col: c });
            }
          }
        }
        return res;
      }
      __name(getSacrificeTargets, "getSacrificeTargets");
      function _getStrongWindDirectionDestination(gameState, row, col, dr, dc) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return null;
        if (gameState.board[nr][nc] !== EMPTY) return null;
        let tr = nr;
        let tc = nc;
        while (true) {
          const rr = tr + dr;
          const cc = tc + dc;
          if (rr < 0 || rr >= 8 || cc < 0 || cc >= 8) break;
          if (gameState.board[rr][cc] !== EMPTY) break;
          tr = rr;
          tc = cc;
        }
        return { row: tr, col: tc };
      }
      __name(_getStrongWindDirectionDestination, "_getStrongWindDirectionDestination");
      function getStrongWindTargets(cardState2, gameState) {
        const dirs = [
          { dr: -1, dc: 0 },
          { dr: 1, dc: 0 },
          { dr: 0, dc: -1 },
          { dr: 0, dc: 1 }
        ];
        const res = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] === EMPTY) continue;
            let movable = false;
            for (const d of dirs) {
              if (_getStrongWindDirectionDestination(gameState, r, c, d.dr, d.dc)) {
                movable = true;
                break;
              }
            }
            if (movable) res.push({ row: r, col: c });
          }
        }
        return res;
      }
      __name(getStrongWindTargets, "getStrongWindTargets");
      function getTrapTargets(cardState2, gameState, playerKey) {
        const res = [];
        const playerVal = playerKey === "black" ? SharedConstants.BLACK : SharedConstants.WHITE;
        const markers = cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] !== playerVal) continue;
            const hasBomb = markers.some((m) => m && m.row === r && m.col === c && m.kind === "bomb");
            if (hasBomb) continue;
            const hasOwnTrap = markers.some((m) => m && m.row === r && m.col === c && m.kind === "specialStone" && m.owner === playerKey && m.data && m.data.type === "TRAP");
            if (hasOwnTrap) continue;
            res.push({ row: r, col: c });
          }
        }
        return res;
      }
      __name(getTrapTargets, "getTrapTargets");
      function getGuardTargets(cardState2, gameState, playerKey) {
        const res = [];
        const playerVal = playerKey === "black" ? SharedConstants.BLACK : SharedConstants.WHITE;
        const markers = cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] !== playerVal) continue;
            const hasBomb = markers.some((m) => m && m.row === r && m.col === c && m.kind === "bomb");
            if (hasBomb) continue;
            res.push({ row: r, col: c });
          }
        }
        return res;
      }
      __name(getGuardTargets, "getGuardTargets");
      function getTimeBombTargets(cardState2, gameState, playerKey) {
        return getGuardTargets(cardState2, gameState, playerKey);
      }
      __name(getTimeBombTargets, "getTimeBombTargets");
      return {
        getDestroyTargets,
        getSwapTargets,
        getPositionSwapTargets,
        getSacrificeTargets,
        getStrongWindTargets,
        getTrapTargets,
        getGuardTargets,
        getTimeBombTargets
      };
    });
  }
});

// game/logic/board_ops.js
var require_board_ops = __commonJS({
  "game/logic/board_ops.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.BoardOps = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { EMPTY } = SharedConstants || {};
      const MarkersAdapter2 = (() => {
        if (typeof __require === "function") {
          try {
            return require_markers_adapter();
          } catch (e) {
            return null;
          }
        }
        const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
        return globalScope.MarkersAdapter || null;
      })();
      const MARKER_KINDS = MarkersAdapter2 && MarkersAdapter2.MARKER_KINDS;
      function isBoardOpsDebugEnabled(cardState2) {
        if (cardState2 && cardState2.debugBoardOpsLog === true) return true;
        try {
          if (typeof globalThis !== "undefined" && globalThis.DEBUG_BOARDOPS_LOG === true) return true;
        } catch (e) {
        }
        return false;
      }
      __name(isBoardOpsDebugEnabled, "isBoardOpsDebugEnabled");
      function _ensureCardState(cardState2) {
        if (!cardState2.presentationEvents) cardState2.presentationEvents = [];
        if (cardState2._nextStoneId === void 0 || cardState2._nextStoneId === null) cardState2._nextStoneId = 1;
        if (MarkersAdapter2 && typeof MarkersAdapter2.ensureMarkers === "function") {
          MarkersAdapter2.ensureMarkers(cardState2);
        } else if (!Array.isArray(cardState2.markers)) {
          cardState2.markers = [];
        }
      }
      __name(_ensureCardState, "_ensureCardState");
      function allocateStoneId(cardState2) {
        _ensureCardState(cardState2);
        return "s" + String(cardState2._nextStoneId++);
      }
      __name(allocateStoneId, "allocateStoneId");
      function _getSpecialVisualMeta(cardState2, row, col) {
        let special = null;
        let timer = null;
        let owner = null;
        if (cardState2 && Array.isArray(cardState2.markers)) {
          const s = MarkersAdapter2 && typeof MarkersAdapter2.findSpecialMarkerAt === "function" ? MarkersAdapter2.findSpecialMarkerAt(cardState2, row, col) : cardState2.markers.find((m) => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone") && m.row === row && m.col === col);
          if (s) {
            special = s.data && s.data.type || null;
            timer = s.data && typeof s.data.remainingOwnerTurns === "number" ? s.data.remainingOwnerTurns : null;
            owner = s.owner !== void 0 && s.owner !== null ? s.owner : null;
            return { special, timer, owner };
          }
          const b = MarkersAdapter2 && typeof MarkersAdapter2.findBombMarkerAt === "function" ? MarkersAdapter2.findBombMarkerAt(cardState2, row, col) : cardState2.markers.find((m) => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb") && m.row === row && m.col === col);
          if (b) {
            special = "TIME_BOMB";
            timer = b.data && typeof b.data.remainingTurns === "number" ? b.data.remainingTurns : null;
            owner = b.owner !== void 0 && b.owner !== null ? b.owner : null;
            return { special, timer, owner };
          }
        }
        return { special: null, timer: null, owner: null };
      }
      __name(_getSpecialVisualMeta, "_getSpecialVisualMeta");
      function emitPresentationEvent(cardState2, ev) {
        _ensureCardState(cardState2);
        const metaSource = cardState2._currentActionMeta || {};
        const actionId = ev.actionId !== void 0 && ev.actionId !== null ? ev.actionId : metaSource.actionId || null;
        const turnIndex = ev.turnIndex !== void 0 && ev.turnIndex !== null ? ev.turnIndex : typeof metaSource.turnIndex === "number" ? metaSource.turnIndex : cardState2.turnIndex || 0;
        const plyIndex = ev.plyIndex !== void 0 && ev.plyIndex !== null ? ev.plyIndex : typeof metaSource.plyIndex === "number" ? metaSource.plyIndex : null;
        const out = Object.assign({}, ev, { actionId, turnIndex, plyIndex });
        cardState2.presentationEvents.push(out);
        if (!cardState2._presentationEventsPersist) cardState2._presentationEventsPersist = [];
        cardState2._presentationEventsPersist.push(out);
        if (isBoardOpsDebugEnabled(cardState2)) {
          try {
            if (typeof console !== "undefined" && console.log) console.log("[BOARDOPS] emitPresentationEvent pushed, persist len", cardState2._presentationEventsPersist.length);
          } catch (e) {
          }
        }
        if (metaSource && typeof metaSource.plyIndex === "number") {
          metaSource.plyIndex = metaSource.plyIndex + 1;
        }
      }
      __name(emitPresentationEvent, "emitPresentationEvent");
      function spawnAt(cardState2, gameState, row, col, ownerKey, cause, reason, meta = {}) {
        _ensureCardState(cardState2);
        const ownerVal = ownerKey === "black" ? SharedConstants.BLACK || 1 : SharedConstants.WHITE || -1;
        gameState.board[row][col] = ownerVal;
        const stoneId = allocateStoneId(cardState2);
        if (!cardState2.stoneIdMap) cardState2.stoneIdMap = Array(8).fill(null).map(() => Array(8).fill(null));
        cardState2.stoneIdMap[row][col] = stoneId;
        const metaOut = Object.assign({}, meta);
        if (metaOut.special === void 0 || metaOut.special === null) {
          const visual = _getSpecialVisualMeta(cardState2, row, col);
          if (visual.special !== null) metaOut.special = visual.special;
          if (visual.timer !== null) metaOut.timer = visual.timer;
          if (visual.owner !== null) metaOut.owner = visual.owner;
        }
        emitPresentationEvent(cardState2, {
          type: "SPAWN",
          stoneId,
          row,
          col,
          ownerAfter: ownerKey,
          cause: cause || null,
          reason: reason || null,
          meta: metaOut
        });
        return { stoneId };
      }
      __name(spawnAt, "spawnAt");
      function destroyAt(cardState2, gameState, row, col, cause, reason, meta = {}) {
        _ensureCardState(cardState2);
        const prev = gameState.board[row][col];
        if (prev === EMPTY) return { destroyed: false };
        const guardMarker = Array.isArray(cardState2.markers) ? cardState2.markers.find((m) => m && m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone") && m.row === row && m.col === col && m.data && m.data.type === "GUARD") : null;
        if (guardMarker) return { destroyed: false, reason: "guard_protected" };
        let stoneId = null;
        if (cardState2.stoneIdMap) {
          stoneId = cardState2.stoneIdMap[row][col];
          cardState2.stoneIdMap[row][col] = null;
        }
        gameState.board[row][col] = EMPTY;
        if (MarkersAdapter2 && typeof MarkersAdapter2.removeMarkersAt === "function") {
          MarkersAdapter2.removeMarkersAt(cardState2, row, col);
        } else if (Array.isArray(cardState2.markers)) {
          cardState2.markers = cardState2.markers.filter((m) => !(m.row === row && m.col === col));
        }
        emitPresentationEvent(cardState2, {
          type: "DESTROY",
          stoneId,
          row,
          col,
          ownerBefore: prev === (SharedConstants.BLACK || 1) ? "black" : "white",
          cause: cause || null,
          reason: reason || null,
          meta
        });
        return { destroyed: true };
      }
      __name(destroyAt, "destroyAt");
      function changeAt(cardState2, gameState, row, col, ownerAfterKey, cause, reason, meta = {}) {
        _ensureCardState(cardState2);
        const prev = gameState.board[row][col];
        const ownerAfterVal = ownerAfterKey === "black" ? SharedConstants.BLACK || 1 : SharedConstants.WHITE || -1;
        if (prev === ownerAfterVal) return { changed: false };
        const stoneId = cardState2.stoneIdMap ? cardState2.stoneIdMap[row][col] : null;
        gameState.board[row][col] = ownerAfterVal;
        const metaOut = Object.assign({}, meta);
        if (metaOut.special === void 0 || metaOut.special === null) {
          const visual = _getSpecialVisualMeta(cardState2, row, col);
          if (visual.special !== null) metaOut.special = visual.special;
          if (visual.timer !== null) metaOut.timer = visual.timer;
          if (visual.owner !== null) metaOut.owner = visual.owner;
        }
        emitPresentationEvent(cardState2, {
          type: "CHANGE",
          stoneId,
          row,
          col,
          ownerBefore: prev === (SharedConstants.BLACK || 1) ? "black" : "white",
          ownerAfter: ownerAfterKey,
          cause: cause || null,
          reason: reason || null,
          meta: metaOut
        });
        return { changed: true };
      }
      __name(changeAt, "changeAt");
      function moveAt(cardState2, gameState, fromRow, fromCol, toRow, toCol, cause, reason, meta = {}) {
        _ensureCardState(cardState2);
        const prev = gameState.board[fromRow][fromCol];
        if (prev === EMPTY) return { moved: false };
        if (gameState.board[toRow][toCol] !== EMPTY) return { moved: false, reason: "dest_not_empty" };
        const stoneId = cardState2.stoneIdMap ? cardState2.stoneIdMap[fromRow][fromCol] : null;
        if (cardState2.stoneIdMap) {
          cardState2.stoneIdMap[fromRow][fromCol] = null;
          cardState2.stoneIdMap[toRow][toCol] = stoneId;
        }
        gameState.board[fromRow][fromCol] = EMPTY;
        gameState.board[toRow][toCol] = prev;
        const metaOut = Object.assign({}, meta);
        if (metaOut.special === void 0 || metaOut.special === null) {
          const visual = _getSpecialVisualMeta(cardState2, toRow, toCol);
          if (visual.special !== null) metaOut.special = visual.special;
          if (visual.timer !== null) metaOut.timer = visual.timer;
          if (visual.owner !== null) metaOut.owner = visual.owner;
        }
        emitPresentationEvent(cardState2, {
          type: "MOVE",
          stoneId,
          row: toRow,
          col: toCol,
          prevRow: fromRow,
          prevCol: fromCol,
          ownerBefore: prev === (SharedConstants.BLACK || 1) ? "black" : "white",
          ownerAfter: prev === (SharedConstants.BLACK || 1) ? "black" : "white",
          cause: cause || null,
          reason: reason || null,
          meta: metaOut
        });
        return { moved: true };
      }
      __name(moveAt, "moveAt");
      function setActionContext(cardState2, meta) {
        _ensureCardState(cardState2);
        cardState2._currentActionMeta = meta;
      }
      __name(setActionContext, "setActionContext");
      function clearActionContext(cardState2) {
        if (cardState2 && cardState2._currentActionMeta !== void 0) delete cardState2._currentActionMeta;
      }
      __name(clearActionContext, "clearActionContext");
      return {
        spawnAt,
        destroyAt,
        changeAt,
        moveAt,
        allocateStoneId,
        emitPresentationEvent,
        setActionContext,
        clearActionContext
      };
    });
  }
});

// game/logic/presentation.js
var require_presentation = __commonJS({
  "game/logic/presentation.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    var BoardOpsModule = null;
    var __presentation_warned_no_boardops = false;
    if (typeof globalThis !== "undefined" && globalThis.BoardOps) {
      BoardOpsModule = globalThis.BoardOps;
    } else {
      BoardOpsModule = null;
    }
    try {
      if (typeof globalThis !== "undefined" && !globalThis.PresentationHelper) {
        globalThis.PresentationHelper = { emitPresentationEvent };
      }
    } catch (e) {
    }
    try {
      if (typeof global !== "undefined" && !global.PresentationHelper) {
        global.PresentationHelper = {
          emitPresentationEvent: /* @__PURE__ */ __name(function() {
            try {
              return emitPresentationEvent.apply(null, arguments);
            } catch (e) {
            }
            return false;
          }, "emitPresentationEvent")
        };
      }
    } catch (e) {
    }
    try {
      if (typeof global !== "undefined" && !global.PresentationHelper) {
        global.PresentationHelper = { emitPresentationEvent };
      }
    } catch (e) {
    }
    try {
      if (typeof globalThis !== "undefined" && !globalThis.PresentationHelper) {
        globalThis.PresentationHelper = { emitPresentationEvent };
      }
    } catch (e) {
    }
    function emitPresentationEvent(cardState2, ev) {
      try {
        if (typeof globalThis !== "undefined" && globalThis.BoardOps && typeof globalThis.BoardOps.emitPresentationEvent === "function") {
          globalThis.BoardOps.emitPresentationEvent(cardState2, ev);
          return true;
        }
      } catch (e) {
      }
      try {
        if (!__presentation_warned_no_boardops) {
          console.warn("[presentation] BoardOps.emitPresentationEvent not available (events will be persisted)");
          __presentation_warned_no_boardops = true;
        }
      } catch (e) {
      }
      try {
        if (cardState2 && Array.isArray(cardState2._presentationEventsPersist)) {
          cardState2._presentationEventsPersist.push(ev);
        } else if (cardState2) {
          cardState2._presentationEventsPersist = [ev];
        }
      } catch (e) {
      }
      try {
        if (typeof global !== "undefined" && !global.PresentationHelper) {
          global.PresentationHelper = { emitPresentationEvent };
        }
      } catch (e) {
      }
      try {
        if (typeof globalThis !== "undefined" && !globalThis.PresentationHelper) {
          globalThis.PresentationHelper = { emitPresentationEvent };
        }
      } catch (e) {
      }
      return false;
    }
    __name(emitPresentationEvent, "emitPresentationEvent");
    function flushPersistedEvents() {
      try {
        if (!(typeof globalThis !== "undefined" && globalThis.BoardOps && typeof globalThis.BoardOps.emitPresentationEvent === "function")) return false;
        let flushedCount = 0;
        if (typeof CardLogic !== "undefined" && typeof CardLogic.flushPresentationEvents === "function") {
          try {
            const events = CardLogic.flushPresentationEvents(cardState) || [];
            for (const ev of events) {
              try {
                globalThis.BoardOps.emitPresentationEvent(cardState, ev);
              } catch (e) {
              }
            }
            flushedCount += events.length;
          } catch (e) {
          }
        }
        if (cardState && Array.isArray(cardState._presentationEventsPersist) && cardState._presentationEventsPersist.length) {
          const persist = cardState._presentationEventsPersist.slice();
          cardState._presentationEventsPersist.length = 0;
          for (const ev of persist) {
            try {
              globalThis.BoardOps.emitPresentationEvent(cardState, ev);
            } catch (e) {
            }
          }
          flushedCount += persist.length;
        }
        return flushedCount > 0;
      } catch (e) {
      }
      return false;
    }
    __name(flushPersistedEvents, "flushPersistedEvents");
    try {
      if (typeof globalThis !== "undefined") {
        if (!globalThis.PresentationHelper) {
          globalThis.PresentationHelper = { emitPresentationEvent };
        }
      }
    } catch (e) {
    }
    try {
      if (typeof global !== "undefined" && !global.PresentationHelper) {
        global.PresentationHelper = { emitPresentationEvent };
      }
    } catch (e) {
    }
    if (typeof module !== "undefined" && module.exports) {
      module.exports = { emitPresentationEvent, flushPersistedEvents };
      try {
        if (typeof global !== "undefined" && !global.PresentationHelper) {
          global.PresentationHelper = module.exports;
          console.log("[presentation] registered global.PresentationHelper");
        }
      } catch (e) {
      }
      try {
        if (typeof globalThis !== "undefined" && !globalThis.PresentationHelper) {
          globalThis.PresentationHelper = module.exports;
          console.log("[presentation] registered globalThis.PresentationHelper");
        }
      } catch (e) {
      }
    }
  }
});

// game/logic/cards/targets.js
var require_targets = __commonJS({
  "game/logic/cards/targets.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardTargets = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { EMPTY } = SharedConstants || {};
      if (EMPTY === void 0) {
        throw new Error("SharedConstants not loaded");
      }
      function getTemptWillTargets(cardState2, gameState, playerKey) {
        const opponentKey = playerKey === "black" ? "white" : "black";
        const res = [];
        const markers = cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
        const isGuarded = /* @__PURE__ */ __name((r, c) => markers.some(
          (m) => m && m.kind === "specialStone" && m.row === r && m.col === c && m.data && m.data.type === "GUARD"
        ), "isGuarded");
        const CardUtils = typeof __require === "function" ? require_utils() : typeof globalThis !== "undefined" ? globalThis.CardUtils : null;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (isGuarded(r, c)) continue;
            if (CardUtils && typeof CardUtils.isSpecialStoneAt === "function") {
              if (!CardUtils.isSpecialStoneAt(cardState2, r, c)) continue;
              if (CardUtils.getSpecialOwnerAt(cardState2, r, c) !== opponentKey) continue;
              if (gameState.board[r][c] === EMPTY) continue;
              res.push({ row: r, col: c });
            } else {
              const marker = (cardState2.markers || []).find((m) => m.kind === "specialStone" && m.row === r && m.col === c);
              if (!marker) continue;
              if (marker.owner !== opponentKey) continue;
              if (gameState.board[r][c] === EMPTY) continue;
              res.push({ row: r, col: c });
            }
          }
        }
        return res;
      }
      __name(getTemptWillTargets, "getTemptWillTargets");
      return {
        getTemptWillTargets
      };
    });
  }
});

// game/logic/cards/work_will.js
var require_work_will = __commonJS({
  "game/logic/cards/work_will.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(
          require_shared_constants(),
          (function() {
            try {
              return require_utils();
            } catch (e) {
              return null;
            }
          })()
        );
      } else {
        root.CardWork = factory(root.SharedConstants, root.CardUtils || null);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants, CardUtils) {
      "use strict";
      const { BLACK, WHITE, EMPTY } = SharedConstants || {};
      function isWorkDebugEnabled(cardState2) {
        if (cardState2 && cardState2.debugWorkLog === true) return true;
        try {
          if (typeof globalThis !== "undefined" && globalThis.DEBUG_WORK_LOG === true) return true;
        } catch (e) {
        }
        return false;
      }
      __name(isWorkDebugEnabled, "isWorkDebugEnabled");
      function addChargeWithTotal(cardState2, playerKey, amount) {
        if (!cardState2 || !amount) return 0;
        if (!cardState2.charge) cardState2.charge = { black: 0, white: 0 };
        if (!cardState2.chargeGainedTotal) cardState2.chargeGainedTotal = { black: 0, white: 0 };
        const deltaRes = CardUtils && typeof CardUtils.addChargeWithDelta === "function" ? CardUtils.addChargeWithDelta(cardState2, playerKey, amount, "work_income") : null;
        let added = deltaRes ? Number(deltaRes.delta) || 0 : 0;
        if (!deltaRes) {
          const before = cardState2.charge[playerKey] || 0;
          const after = Math.min(30, before + amount);
          cardState2.charge[playerKey] = after;
          added = after - before;
        }
        if (added > 0) {
          cardState2.chargeGainedTotal[playerKey] = (cardState2.chargeGainedTotal[playerKey] || 0) + added;
        }
        return added;
      }
      __name(addChargeWithTotal, "addChargeWithTotal");
      function placeWorkStone(cardState2, gameState, playerKey, row, col, deps = {}) {
        if (isWorkDebugEnabled(cardState2)) {
          try {
            console.log("[WORK_DEBUG] placeWorkStone called", { playerKey, row, col });
          } catch (e) {
          }
        }
        const prev = cardState2.workAnchorPosByPlayer && cardState2.workAnchorPosByPlayer[playerKey] || null;
        if (prev && (prev.row !== row || prev.col !== col)) {
          if (cardState2.markers) {
            cardState2.markers = cardState2.markers.filter((m) => !(m.kind === "specialStone" && m.data && m.data.type === "WORK" && m.owner === playerKey && m.row === prev.row && m.col === prev.col));
          }
          cardState2.workAnchorPosByPlayer[playerKey] = null;
        }
        const addMarker = deps.addMarker || ((cs, kind, r, c, owner, data) => {
          if (!cs.markers) cs.markers = [];
          const id = typeof cs._nextMarkerId === "number" ? cs._nextMarkerId++ : 1;
          const createdSeq = typeof cs._nextCreatedSeq === "number" ? cs._nextCreatedSeq++ : 1;
          cs.markers.push({
            id,
            row: r,
            col: c,
            kind,
            owner,
            createdSeq,
            data: Object.assign({ type: "WORK", ownerColor: owner, workStage: 0, remainingOwnerTurns: 5 }, data || {})
          });
          return { placed: true };
        });
        addMarker(cardState2, "specialStone", row, col, playerKey, { type: "WORK", ownerColor: playerKey, workStage: 0, remainingOwnerTurns: 5 });
        if (!cardState2.workAnchorPosByPlayer) cardState2.workAnchorPosByPlayer = { black: null, white: null };
        cardState2.workAnchorPosByPlayer[playerKey] = { row, col };
        return { placed: true };
      }
      __name(placeWorkStone, "placeWorkStone");
      function processWorkEffects(cardState2, gameState, playerKey, deps = {}) {
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const ownerVal = playerKey === "black" ? P_BLACK : P_WHITE;
        const anchor = cardState2.workAnchorPosByPlayer && cardState2.workAnchorPosByPlayer[playerKey] || null;
        let row = null, col = null;
        if (anchor) {
          row = anchor.row;
          col = anchor.col;
        }
        let special = null;
        if (row !== null) {
          special = (cardState2.markers || []).find((s) => s.kind === "specialStone" && s.data && s.data.type === "WORK" && s.owner === playerKey && s.row === row && s.col === col);
        }
        if (!special) {
          special = (cardState2.markers || []).find((s) => s.kind === "specialStone" && s.data && s.data.type === "WORK" && s.owner === playerKey);
          if (special) {
            row = special.row;
            col = special.col;
            cardState2.workAnchorPosByPlayer[playerKey] = { row, col };
          }
        }
        if (!special) return { gained: 0, removed: false };
        const cellVal = gameState.board[row][col];
        const ownerColor = special.data && special.data.ownerColor || special.owner;
        const expectedVal = ownerColor === "black" ? P_BLACK : ownerColor === "white" ? P_WHITE : playerKey === "black" ? P_BLACK : P_WHITE;
        if (cellVal === EMPTY || cellVal !== expectedVal) {
          cardState2.markers = (cardState2.markers || []).filter((m) => !(m.kind === "specialStone" && m.data && m.data.type === "WORK" && m.owner === playerKey && m.row === row && m.col === col));
          cardState2.workAnchorPosByPlayer[playerKey] = null;
          return { gained: 0, removed: true };
        }
        const stage = special.data && typeof special.data.workStage === "number" ? special.data.workStage : 0;
        if (stage < 0 || stage > 4) {
          cardState2.workAnchorPosByPlayer[playerKey] = null;
          return { gained: 0, removed: true };
        }
        const gain = Math.min(30, 1 << stage);
        addChargeWithTotal(cardState2, playerKey, gain);
        const newStage = stage + 1;
        for (const s of cardState2.markers || []) {
          if (s.kind === "specialStone" && s.data && s.data.type === "WORK" && s.row === row && s.col === col && s.owner === playerKey) {
            s.data.workStage = newStage;
            s.data.remainingOwnerTurns = Math.max(0, 5 - newStage);
            if (s.data.ownerColor === void 0) s.data.ownerColor = s.owner;
          }
        }
        let removed = false;
        if (newStage >= 5) {
          cardState2.markers = (cardState2.markers || []).filter((m) => !(m.kind === "specialStone" && m.data && m.data.type === "WORK" && m.owner === playerKey && m.row === row && m.col === col));
          cardState2.workAnchorPosByPlayer[playerKey] = null;
          removed = true;
        }
        return { gained: gain, removed };
      }
      __name(processWorkEffects, "processWorkEffects");
      return {
        placeWorkStone,
        processWorkEffects
      };
    });
  }
});

// game/logic/cards/regen.js
var require_regen = __commonJS({
  "game/logic/cards/regen.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardRegen = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};
      if (BLACK === void 0 || WHITE === void 0 || DIRECTIONS === void 0) {
        throw new Error("SharedConstants (BLACK/WHITE/DIRECTIONS) required");
      }
      function applyRegenWill(cardState2, playerKey, row, col, deps = {}) {
        const addMarker = deps.addMarker || ((cs, kind, r, c, owner, data) => {
          if (!cs.markers) cs.markers = [];
          const id = typeof cs._nextMarkerId === "number" ? cs._nextMarkerId++ : 1;
          const createdSeq = typeof cs._nextCreatedSeq === "number" ? cs._nextCreatedSeq++ : 1;
          cs.markers.push({
            id,
            row: r,
            col: c,
            kind,
            owner,
            createdSeq,
            data: { type: data.type, regenRemaining: data.regenRemaining, ownerColor: data.ownerColor }
          });
          return true;
        });
        addMarker(cardState2, "specialStone", row, col, playerKey, {
          type: "REGEN",
          regenRemaining: 1,
          ownerColor: playerKey === "black" ? BLACK || 1 : WHITE || -1
        });
        return { applied: true };
      }
      __name(applyRegenWill, "applyRegenWill");
      function applyRegenAfterFlips(cardState2, gameState, flips, flipperKey, skipCapture, deps = {}) {
        const regened = [];
        const captureFlips = [];
        if (!flips || !flips.length) return { regened, captureFlips };
        const consumedRegenKeys = /* @__PURE__ */ new Set();
        const getCardContext = deps.getCardContext || (() => ({ protectedStones: cardState2.markers ? cardState2.markers.filter((m) => m.kind === "specialStone" && m.data && m.data.type === "PROTECTED").map((m) => ({ row: m.row, col: m.col })) : [], permaProtectedStones: cardState2.markers ? cardState2.markers.filter((m) => m.kind === "specialStone" && m.data && (m.data.type === "PERMA_PROTECTED" || m.data.type === "DRAGON" || m.data.type === "BREEDING" || m.data.type === "ULTIMATE_DESTROY_GOD")).map((m) => ({ row: m.row, col: m.col })) : [] }));
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => {
          if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.kind === "bomb" && m.row === r && m.col === c));
        });
        const specials = (cardState2.markers || []).filter((m) => m.kind === "specialStone");
        const dirs = DIRECTIONS;
        const context = getCardContext(cardState2);
        const isBlocked = /* @__PURE__ */ __name((r, c) => {
          const key = `${r},${c}`;
          const protSet = context.protectedStones ? new Set(context.protectedStones.map((p) => `${p.row},${p.col}`)) : null;
          const permaSet = context.permaProtectedStones ? new Set(context.permaProtectedStones.map((p) => `${p.row},${p.col}`)) : null;
          if (protSet && protSet.has(key)) return true;
          if (permaSet && permaSet.has(key)) return true;
          return false;
        }, "isBlocked");
        const toObj = /* @__PURE__ */ __name((p) => typeof p.row === "number" ? p : { row: p[0], col: p[1] }, "toObj");
        for (const raw of flips) {
          const pos = toObj(raw);
          const idx = specials.findIndex((s) => s.data && s.data.type === "REGEN" && s.row === pos.row && s.col === pos.col && (s.data.regenRemaining || 0) > 0);
          if (idx === -1) continue;
          const regen = specials[idx];
          const ownerColor = regen.owner === "black" ? BLACK || 1 : WHITE || -1;
          if (gameState.board[pos.row][pos.col] === ownerColor) continue;
          regen.data.regenRemaining -= 1;
          if (deps.BoardOps && typeof deps.BoardOps.changeAt === "function") {
            deps.BoardOps.changeAt(cardState2, gameState, pos.row, pos.col, regen.owner, "REGEN", "regen_triggered");
          } else {
            gameState.board[pos.row][pos.col] = ownerColor;
          }
          regened.push({ row: pos.row, col: pos.col });
          if (skipCapture) continue;
          for (const [dr, dc] of dirs) {
            const line = [];
            let r = pos.row + dr;
            let c = pos.col + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === -ownerColor) {
              if (isBlocked(r, c)) {
                line.length = 0;
                break;
              }
              line.push({ row: r, col: c });
              r += dr;
              c += dc;
            }
            if (line.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === ownerColor) {
              for (const p of line) {
                if (deps.BoardOps && typeof deps.BoardOps.changeAt === "function") {
                  deps.BoardOps.changeAt(cardState2, gameState, p.row, p.col, regen.owner, "REGEN", "regen_capture_flip");
                } else {
                  gameState.board[p.row][p.col] = ownerColor;
                }
                clearBombAt(cardState2, p.row, p.col);
                captureFlips.push(p);
              }
            }
          }
          if ((regen.data.regenRemaining || 0) <= 0) {
            const k = `${pos.row},${pos.col}`;
            if (!consumedRegenKeys.has(k)) {
              consumedRegenKeys.add(k);
              if (typeof deps.removeMarkersAt === "function") {
                deps.removeMarkersAt(cardState2, pos.row, pos.col, {
                  kind: "specialStone",
                  type: "REGEN",
                  owner: regen.owner
                });
              } else if (Array.isArray(cardState2.markers)) {
                cardState2.markers = cardState2.markers.filter((m) => !(m && m.kind === "specialStone" && m.row === pos.row && m.col === pos.col && m.data && m.data.type === "REGEN"));
              }
              if (deps.BoardOps && typeof deps.BoardOps.emitPresentationEvent === "function") {
                deps.BoardOps.emitPresentationEvent(cardState2, {
                  type: "STATUS_REMOVED",
                  row: pos.row,
                  col: pos.col,
                  cause: "REGEN",
                  reason: "regen_consumed",
                  meta: { special: "REGEN", reason: "regen_consumed" }
                });
              }
            }
          }
        }
        return { regened, captureFlips };
      }
      __name(applyRegenAfterFlips, "applyRegenAfterFlips");
      return {
        applyRegenWill,
        applyRegenAfterFlips
      };
    });
  }
});

// game/logic/cards/flips.js
var require_flips = __commonJS({
  "game/logic/cards/flips.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardFlips = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};
      if (DIRECTIONS === void 0 || EMPTY === void 0) {
        throw new Error("SharedConstants missing DIRECTIONS/EMPTY");
      }
      function getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context) {
        const protectedStones = context.protectedStones || [];
        const permaProtectedStones = context.permaProtectedStones || [];
        const protectedSet = protectedStones.length ? new Set(protectedStones.map((p) => `${p.row},${p.col}`)) : null;
        const permaSet = permaProtectedStones.length ? new Set(permaProtectedStones.map((p) => `${p.row},${p.col}`)) : null;
        const [dr, dc] = dir;
        const flips = [];
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === -ownerVal) {
          const key = `${r},${c}`;
          if (protectedSet && protectedSet.has(key) || permaSet && permaSet.has(key)) {
            flips.length = 0;
            break;
          }
          flips.push({ row: r, col: c });
          r += dr;
          c += dc;
        }
        if (flips.length === 0) return [];
        if (r < 0 || r >= 8 || c < 0 || c >= 8) return [];
        if (gameState.board[r][c] !== ownerVal) return [];
        return flips;
      }
      __name(getDirectionalChainFlips, "getDirectionalChainFlips");
      function getFlipsWithContext(state, row, col, player, context = {}) {
        if (state.board[row][col] !== EMPTY) return [];
        const allFlips = [];
        for (const dir of DIRECTIONS || []) {
          const flips = getDirectionalChainFlips(state, row, col, player, dir, context);
          if (flips && flips.length) {
            for (const f of flips) allFlips.push([f.row, f.col]);
          }
        }
        return allFlips;
      }
      __name(getFlipsWithContext, "getFlipsWithContext");
      return {
        getDirectionalChainFlips,
        getFlipsWithContext
      };
    });
  }
});

// game/logic/cards/chain.js
var require_chain = __commonJS({
  "game/logic/cards/chain.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants(), require_flips());
      } else {
        root.CardChain = factory(root.SharedConstants, root.CardFlips);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants, CardFlips2) {
      "use strict";
      const { DIRECTIONS } = SharedConstants || {};
      if (!DIRECTIONS) throw new Error("SharedConstants.DIRECTIONS required");
      function normalizePoint(p) {
        if (Array.isArray(p)) return { row: p[0], col: p[1] };
        return { row: p.row, col: p.col };
      }
      __name(normalizePoint, "normalizePoint");
      function findChainChoice(gameState, primaryFlips, ownerVal, context = {}, prng) {
        const p = prng || { random: /* @__PURE__ */ __name(() => 0, "random") };
        const candidatePoints = [];
        const seen = /* @__PURE__ */ new Set();
        for (const f of primaryFlips || []) {
          const pt = normalizePoint(f);
          const key = `${pt.row},${pt.col}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (gameState.board[pt.row][pt.col] === ownerVal) {
            candidatePoints.push({ row: pt.row, col: pt.col });
          }
        }
        if (candidatePoints.length === 0) {
          return { applied: false, flips: [], chosen: null };
        }
        const candidates = [];
        for (const point of candidatePoints) {
          for (const dir of DIRECTIONS || []) {
            const flips = CardFlips2 && typeof CardFlips2.getDirectionalChainFlips === "function" ? CardFlips2.getDirectionalChainFlips(gameState, point.row, point.col, ownerVal, dir, context) : [];
            if (flips && flips.length > 0) {
              candidates.push({ from: { row: point.row, col: point.col }, dir, score: flips.length, flips });
            }
          }
        }
        if (candidates.length === 0) {
          return { applied: false, flips: [], chosen: null };
        }
        let maxScore = 0;
        for (const c of candidates) if (c.score > maxScore) maxScore = c.score;
        const top = candidates.filter((c) => c.score === maxScore);
        const pickedIndex = Math.floor(p.random() * top.length);
        const chosen = top[pickedIndex];
        return { applied: true, flips: chosen.flips, chosen };
      }
      __name(findChainChoice, "findChainChoice");
      return {
        findChainChoice
      };
    });
  }
});

// game/logic/cards/time_bomb.js
var require_time_bomb = __commonJS({
  "game/logic/cards/time_bomb.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardTimeBomb = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { TIME_BOMB_TURNS } = SharedConstants || {};
      function applyTimeBomb(cardState2, playerKey, row, col, deps = {}) {
        const addMarker = deps.addMarker || ((cs, kind, r, c, owner, data) => {
          if (!cs.markers) cs.markers = [];
          const id = typeof cs._nextMarkerId === "number" ? cs._nextMarkerId++ : 1;
          const createdSeq = typeof cs._nextCreatedSeq === "number" ? cs._nextCreatedSeq++ : 1;
          cs.markers.push({
            id,
            row: r,
            col: c,
            kind,
            owner,
            createdSeq,
            data: { remainingTurns: data.remainingTurns, placedTurn: data.placedTurn }
          });
          return { placed: true };
        });
        const bombs = (cardState2.markers || []).filter((m) => m.kind === "bomb");
        if (bombs.some((b) => b.row === row && b.col === col)) return { placed: false, reason: "exists" };
        addMarker(cardState2, "bomb", row, col, playerKey, {
          remainingTurns: TIME_BOMB_TURNS,
          placedTurn: cardState2.turnIndex
        });
        return { placed: true };
      }
      __name(applyTimeBomb, "applyTimeBomb");
      function tickBombs(cardState2, gameState, playerKey, deps = {}) {
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
          if (gs.board[r][c] === 0) return false;
          if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
          gs.board[r][c] = 0;
          return true;
        });
        const exploded = [];
        const destroyed = [];
        const activeKey = playerKey || cardState2.lastTurnStartedFor;
        const bombs = (cardState2.markers || []).filter((m) => m.kind === "bomb");
        const removeIds = /* @__PURE__ */ new Set();
        for (const bomb of bombs) {
          if (activeKey && bomb.owner !== activeKey) {
            continue;
          }
          if (bomb.data && bomb.data.placedTurn === cardState2.turnIndex) {
            continue;
          }
          if (!bomb.data) bomb.data = {};
          bomb.data.remainingTurns = typeof bomb.data.remainingTurns === "number" ? bomb.data.remainingTurns - 1 : -1;
          if (bomb.data.remainingTurns <= 0) {
            exploded.push({ row: bomb.row, col: bomb.col });
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const r = bomb.row + dr;
                const c = bomb.col + dc;
                if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                  let destroyedRes = false;
                  if (deps.BoardOps && typeof deps.BoardOps.destroyAt === "function") {
                    const res = deps.BoardOps.destroyAt(cardState2, gameState, r, c, "TIME_BOMB", "bomb_explosion");
                    destroyedRes = !!res.destroyed;
                  } else {
                    destroyedRes = destroyAt(cardState2, gameState, r, c);
                  }
                  if (destroyedRes) {
                    destroyed.push({ row: r, col: c });
                  }
                }
              }
            }
            if (bomb.id !== void 0) {
              removeIds.add(bomb.id);
            } else {
              removeIds.add(`${bomb.row},${bomb.col},${bomb.owner}`);
            }
          }
        }
        if (removeIds.size > 0) {
          cardState2.markers = (cardState2.markers || []).filter((m) => {
            if (m.kind !== "bomb") return true;
            if (removeIds.has(m.id)) return false;
            return !removeIds.has(`${m.row},${m.col},${m.owner}`);
          });
        }
        return { exploded, destroyed };
      }
      __name(tickBombs, "tickBombs");
      function tickBombAt(cardState2, gameState, bomb, activeKey, deps = {}) {
        if (!bomb) return { exploded: [], destroyed: [], removed: false };
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
          if (gs.board[r][c] === 0) return false;
          if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
          gs.board[r][c] = 0;
          return true;
        });
        const bombs = (cardState2.markers || []).filter((m) => m.kind === "bomb");
        const idx = bombs.findIndex(
          (b2) => bomb.id !== void 0 && b2.id === bomb.id || b2.row === bomb.row && b2.col === bomb.col && b2.owner === bomb.owner && b2.createdSeq === bomb.createdSeq
        );
        if (idx === -1) return { exploded: [], destroyed: [], removed: false };
        const b = bombs[idx];
        if (activeKey && b.owner !== activeKey) return { exploded: [], destroyed: [], removed: false };
        if (b.data && b.data.placedTurn === cardState2.turnIndex) return { exploded: [], destroyed: [], removed: false };
        if (!b.data) b.data = {};
        b.data.remainingTurns = typeof b.data.remainingTurns === "number" ? b.data.remainingTurns - 1 : -1;
        if (b.data.remainingTurns > 0) return { exploded: [], destroyed: [], removed: false };
        const exploded = [{ row: b.row, col: b.col }];
        const destroyed = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r = b.row + dr;
            const c = b.col + dc;
            if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === "function") {
              const res = deps.BoardOps.destroyAt(cardState2, gameState, r, c, "TIME_BOMB", "bomb_explosion");
              destroyedRes = !!(res && res.destroyed);
            } else {
              destroyedRes = destroyAt(cardState2, gameState, r, c);
            }
            if (destroyedRes) destroyed.push({ row: r, col: c });
          }
        }
        if (b.id !== void 0) {
          cardState2.markers = (cardState2.markers || []).filter((m) => m.id !== b.id);
        } else {
          cardState2.markers = (cardState2.markers || []).filter(
            (m) => !(m.kind === "bomb" && m.row === b.row && m.col === b.col && m.owner === b.owner)
          );
        }
        return { exploded, destroyed, removed: true };
      }
      __name(tickBombAt, "tickBombAt");
      return {
        applyTimeBomb,
        tickBombs,
        tickBombAt
      };
    });
  }
});

// game/logic/effects/dragon.js
var require_dragon = __commonJS({
  "game/logic/effects/dragon.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.DragonEffects = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { BLACK, WHITE } = SharedConstants || {};
      const P_BLACK = BLACK || 1;
      const P_WHITE = WHITE || -1;
      function processDragonEffects(cardState2, gameState, playerKey, deps = {}) {
        const BoardOps = deps.BoardOps;
        const converted = [];
        const destroyed = [];
        const anchors = [];
        const player = playerKey === "black" ? P_BLACK : P_WHITE;
        const opponent = -player;
        const protectedSet = new Set(
          (cardState2.markers || []).filter((s) => s.kind === "specialStone" && s.data && (s.data.type === "PROTECTED" || s.data.type === "PERMA_PROTECTED" || s.data.type === "ULTIMATE_DESTROY_GOD" || s.data.type === "BREEDING" || s.data.type === "DRAGON")).map((s) => `${s.row},${s.col}`)
        );
        const dragons = (cardState2.markers || []).filter((s) => s.kind === "specialStone" && s.data && s.data.type === "DRAGON");
        const clearBombAt = /* @__PURE__ */ __name((row, col) => {
          if (!cardState2.markers || !cardState2.markers.length) return;
          const b = cardState2.markers.find((x) => x.kind === "bomb" && x.row === row && x.col === col);
          if (!b) return;
          cardState2.markers = cardState2.markers.filter((x) => !(x.kind === "bomb" && x.row === row && x.col === col));
        }, "clearBombAt");
        for (const dragon of dragons) {
          if (dragon.owner !== playerKey) continue;
          if (gameState.board[dragon.row][dragon.col] !== player) {
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
            continue;
          }
          const before = dragon.data && (dragon.data.remainingOwnerTurns !== void 0 && dragon.data.remainingOwnerTurns !== null) ? dragon.data.remainingOwnerTurns : 0;
          const afterDec = before - 1;
          if (dragon.data) dragon.data.remainingOwnerTurns = afterDec;
          if (afterDec < 0) continue;
          anchors.push({ row: dragon.row, col: dragon.col, remainingNow: afterDec });
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const r = dragon.row + dr;
              const c = dragon.col + dc;
              if (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === opponent) {
                const key = `${r},${c}`;
                if (protectedSet.has(key)) continue;
                if (BoardOps && typeof BoardOps.changeAt === "function") {
                  BoardOps.changeAt(cardState2, gameState, r, c, playerKey, "DRAGON", "dragon_convert");
                } else {
                  gameState.board[r][c] = player;
                }
                clearBombAt(r, c);
                converted.push({ row: r, col: c });
              }
            }
          }
          if (afterDec === 0) {
            destroyed.push({ row: dragon.row, col: dragon.col });
            if (BoardOps && typeof BoardOps.destroyAt === "function") {
              BoardOps.destroyAt(cardState2, gameState, dragon.row, dragon.col, "DRAGON", "anchor_expired");
            } else {
              gameState.board[dragon.row][dragon.col] = 0;
            }
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
          }
        }
        if (cardState2.markers) {
          cardState2.markers = cardState2.markers.filter(
            (s) => s.kind !== "specialStone" || !s.data || s.data.type !== "DRAGON" || s.data.remainingOwnerTurns !== void 0 && s.data.remainingOwnerTurns !== null && s.data.remainingOwnerTurns >= 0
          );
        }
        if (converted.length > 0 && cardState2.markers) {
          const removeSet = new Set(converted.map((p) => `${p.row},${p.col}`));
          cardState2.markers = cardState2.markers.filter(
            (s) => s.kind !== "specialStone" || !s.data || s.data.type !== "HYPERACTIVE" || !removeSet.has(`${s.row},${s.col}`)
          );
        }
        return { converted, destroyed, anchors };
      }
      __name(processDragonEffects, "processDragonEffects");
      function processDragonEffectsAtAnchor(cardState2, gameState, playerKey, row, col, deps = {}) {
        const BoardOps = deps.BoardOps;
        const converted = [];
        const destroyed = [];
        const player = playerKey === "black" ? P_BLACK : P_WHITE;
        const opponent = -player;
        const dragon = (cardState2.markers || []).find(
          (s) => s.kind === "specialStone" && s.data && s.data.type === "DRAGON" && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!dragon) return { converted, destroyed };
        if (gameState.board[row][col] !== player) return { converted, destroyed };
        const protectedSet = new Set(
          (cardState2.markers || []).filter((s) => s.kind === "specialStone" && s.data && (s.data.type === "PROTECTED" || s.data.type === "PERMA_PROTECTED" || s.data.type === "ULTIMATE_DESTROY_GOD" || s.data.type === "BREEDING" || s.data.type === "DRAGON")).map((s) => `${s.row},${s.col}`)
        );
        const clearBombAt = /* @__PURE__ */ __name((r, c) => {
          if (!cardState2.markers || !cardState2.markers.length) return;
          const b = cardState2.markers.find((x) => x.kind === "bomb" && x.row === r && x.col === c);
          if (!b) return;
          cardState2.markers = cardState2.markers.filter((x) => !(x.kind === "bomb" && x.row === r && x.col === c));
        }, "clearBombAt");
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
            if (gameState.board[r][c] !== opponent) continue;
            const key = `${r},${c}`;
            if (protectedSet.has(key)) continue;
            if (BoardOps && typeof BoardOps.changeAt === "function") {
              BoardOps.changeAt(cardState2, gameState, r, c, playerKey, "DRAGON", "dragon_convert_immediate");
            } else {
              gameState.board[r][c] = player;
            }
            clearBombAt(r, c);
            converted.push({ row: r, col: c });
          }
        }
        if (converted.length > 0 && cardState2.markers) {
          const removeSet = new Set(converted.map((p) => `${p.row},${p.col}`));
          cardState2.markers = cardState2.markers.filter(
            (s) => s.kind !== "specialStone" || !s.data || s.data.type !== "HYPERACTIVE" || !removeSet.has(`${s.row},${s.col}`)
          );
        }
        return { converted, destroyed };
      }
      __name(processDragonEffectsAtAnchor, "processDragonEffectsAtAnchor");
      function processDragonEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, deps = {}) {
        const BoardOps = deps.BoardOps;
        const converted = [];
        const destroyed = [];
        const anchors = [];
        const player = playerKey === "black" ? P_BLACK : P_WHITE;
        const opponent = -player;
        const dragon = (cardState2.markers || []).find(
          (s) => s.kind === "specialStone" && s.data && s.data.type === "DRAGON" && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!dragon) return { converted, destroyed, anchors };
        if (gameState.board[row][col] !== player) {
          if (dragon.data) dragon.data.remainingOwnerTurns = -1;
          return { converted, destroyed, anchors };
        }
        const before = dragon.data && (dragon.data.remainingOwnerTurns !== void 0 && dragon.data.remainingOwnerTurns !== null) ? dragon.data.remainingOwnerTurns : 0;
        const afterDec = before - 1;
        if (dragon.data) dragon.data.remainingOwnerTurns = afterDec;
        if (afterDec < 0) return { converted, destroyed, anchors };
        anchors.push({ row, col, remainingNow: afterDec });
        const protectedSet = new Set(
          (cardState2.markers || []).filter((s) => s.kind === "specialStone" && s.data && (s.data.type === "PROTECTED" || s.data.type === "PERMA_PROTECTED" || s.data.type === "ULTIMATE_DESTROY_GOD" || s.data.type === "BREEDING" || s.data.type === "DRAGON")).map((s) => `${s.row},${s.col}`)
        );
        const clearBombAt = /* @__PURE__ */ __name((r, c) => {
          if (!cardState2.markers || !cardState2.markers.length) return;
          const b = cardState2.markers.find((x) => x.kind === "bomb" && x.row === r && x.col === c);
          if (!b) return;
          cardState2.markers = cardState2.markers.filter((x) => !(x.kind === "bomb" && x.row === r && x.col === c));
        }, "clearBombAt");
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === opponent) {
              const key = `${r},${c}`;
              if (protectedSet.has(key)) continue;
              if (BoardOps && typeof BoardOps.changeAt === "function") {
                BoardOps.changeAt(cardState2, gameState, r, c, playerKey, "DRAGON", "dragon_convert");
              } else {
                gameState.board[r][c] = player;
              }
              clearBombAt(r, c);
              converted.push({ row: r, col: c });
            }
          }
        }
        if (afterDec === 0) {
          destroyed.push({ row, col });
          if (BoardOps && typeof BoardOps.destroyAt === "function") {
            BoardOps.destroyAt(cardState2, gameState, row, col, "DRAGON", "anchor_expired");
          } else {
            gameState.board[row][col] = 0;
          }
          if (dragon.data) dragon.data.remainingOwnerTurns = -1;
        }
        if (cardState2.markers) {
          cardState2.markers = cardState2.markers.filter(
            (s) => s.kind !== "specialStone" || !s.data || s.data.type !== "DRAGON" || s.data.remainingOwnerTurns !== void 0 && s.data.remainingOwnerTurns !== null && s.data.remainingOwnerTurns >= 0
          );
        }
        if (converted.length > 0 && cardState2.markers) {
          const removeSet = new Set(converted.map((p) => `${p.row},${p.col}`));
          cardState2.markers = cardState2.markers.filter(
            (s) => s.kind !== "specialStone" || !s.data || s.data.type !== "HYPERACTIVE" || !removeSet.has(`${s.row},${s.col}`)
          );
        }
        return { converted, destroyed, anchors };
      }
      __name(processDragonEffectsAtTurnStartAnchor, "processDragonEffectsAtTurnStartAnchor");
      return {
        processDragonEffects,
        processDragonEffectsAtAnchor,
        processDragonEffectsAtTurnStartAnchor
      };
    });
  }
});

// game/logic/cards/udg.js
var require_udg = __commonJS({
  "game/logic/cards/udg.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardUdG = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { BLACK, WHITE, EMPTY } = SharedConstants || {};
      if (BLACK === void 0 || WHITE === void 0 || EMPTY === void 0) {
        throw new Error("SharedConstants missing required values");
      }
      function processUltimateDestroyGodEffects(cardState2, gameState, playerKey, deps = {}) {
        const destroyed = [];
        const anchors = [];
        const expired = [];
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const player = playerKey === "black" ? P_BLACK : P_WHITE;
        const opponent = -player;
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
          if (gs.board[r][c] === EMPTY) return false;
          if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
          gs.board[r][c] = EMPTY;
          return true;
        });
        const udgs = (cardState2.markers || []).filter((s) => s.kind === "specialStone" && s.data && s.data.type === "ULTIMATE_DESTROY_GOD" && s.owner === playerKey);
        if (!udgs.length) return { destroyed, anchors, expired };
        for (const udg of udgs) {
          if (gameState.board[udg.row][udg.col] !== player) {
            if (udg.data) udg.data.remainingOwnerTurns = -1;
            continue;
          }
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const r = udg.row + dr;
              const c = udg.col + dc;
              if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
              if (gameState.board[r][c] !== opponent) continue;
              let destroyedRes = false;
              if (deps.BoardOps && typeof deps.BoardOps.destroyAt === "function") {
                const res = deps.BoardOps.destroyAt(cardState2, gameState, r, c, "ULTIMATE_DESTROY_GOD", "udg_destroyed");
                destroyedRes = !!res.destroyed;
              } else {
                destroyedRes = destroyAt(cardState2, gameState, r, c);
              }
              if (destroyedRes) {
                destroyed.push({ row: r, col: c });
              }
            }
          }
          const before = udg.data && (udg.data.remainingOwnerTurns !== void 0 && udg.data.remainingOwnerTurns !== null) ? udg.data.remainingOwnerTurns : 0;
          const afterDec = before - 1;
          if (udg.data) udg.data.remainingOwnerTurns = afterDec;
          if (afterDec < 0) continue;
          anchors.push({ row: udg.row, col: udg.col, remainingNow: afterDec });
          if (afterDec === 0) {
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === "function") {
              const res = deps.BoardOps.destroyAt(cardState2, gameState, udg.row, udg.col, "ULTIMATE_DESTROY_GOD", "anchor_expired");
              destroyedRes = !!res.destroyed;
            } else {
              destroyedRes = destroyAt(cardState2, gameState, udg.row, udg.col);
            }
            if (destroyedRes) {
              expired.push({ row: udg.row, col: udg.col });
            }
            if (udg.data) udg.data.remainingOwnerTurns = -1;
          }
        }
        if (cardState2.markers) {
          cardState2.markers = cardState2.markers.filter(
            (m) => m.kind !== "specialStone" || !m.data || m.data.type !== "ULTIMATE_DESTROY_GOD" || m.data.remainingOwnerTurns !== void 0 && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0
          );
        }
        return { destroyed, anchors, expired };
      }
      __name(processUltimateDestroyGodEffects, "processUltimateDestroyGodEffects");
      function processUltimateDestroyGodEffectsAtAnchor(cardState2, gameState, playerKey, row, col, deps = {}) {
        const destroyed = [];
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const player = playerKey === "black" ? P_BLACK : P_WHITE;
        const opponent = -player;
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
          if (gs.board[r][c] === EMPTY) return false;
          if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
          gs.board[r][c] = EMPTY;
          return true;
        });
        const udg = (cardState2.markers || []).find(
          (s) => s.kind === "specialStone" && s.data && s.data.type === "ULTIMATE_DESTROY_GOD" && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!udg) return { destroyed };
        if (gameState.board[row][col] !== player) return { destroyed };
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
            if (gameState.board[r][c] !== opponent) continue;
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === "function") {
              const res = deps.BoardOps.destroyAt(cardState2, gameState, r, c, "ULTIMATE_DESTROY_GOD", "udg_destroyed");
              destroyedRes = !!res.destroyed;
            } else {
              destroyedRes = destroyAt(cardState2, gameState, r, c);
            }
            if (destroyedRes) {
              destroyed.push({ row: r, col: c });
            }
          }
        }
        const before = udg.data && (udg.data.remainingOwnerTurns !== void 0 && udg.data.remainingOwnerTurns !== null) ? udg.data.remainingOwnerTurns : 0;
        const shouldDecrement = deps.decrementRemainingOwnerTurns !== false;
        const afterDec = shouldDecrement ? before - 1 : before;
        if (shouldDecrement) {
          if (udg.data) udg.data.remainingOwnerTurns = afterDec;
          if (afterDec < 0) return { destroyed };
        } else {
          if (udg.data) udg.data.remainingOwnerTurns = before;
        }
        const expired = [];
        if (shouldDecrement && afterDec === 0) {
          let destroyedRes = false;
          if (deps.BoardOps && typeof deps.BoardOps.destroyAt === "function") {
            const res = deps.BoardOps.destroyAt(cardState2, gameState, udg.row, udg.col, "ULTIMATE_DESTROY_GOD", "anchor_expired");
            destroyedRes = !!res.destroyed;
          } else {
            destroyedRes = destroyAt(cardState2, gameState, udg.row, udg.col);
          }
          if (destroyedRes) {
            expired.push({ row: udg.row, col: udg.col });
          }
          if (udg.data) udg.data.remainingOwnerTurns = -1;
        }
        if (cardState2.markers) {
          cardState2.markers = cardState2.markers.filter(
            (m) => m.kind !== "specialStone" || !m.data || m.data.type !== "ULTIMATE_DESTROY_GOD" || m.data.remainingOwnerTurns !== void 0 && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0
          );
        }
        return { destroyed, expired };
      }
      __name(processUltimateDestroyGodEffectsAtAnchor, "processUltimateDestroyGodEffectsAtAnchor");
      function processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, deps = {}) {
        const result = processUltimateDestroyGodEffectsAtAnchor(cardState2, gameState, playerKey, row, col, deps);
        return result;
      }
      __name(processUltimateDestroyGodEffectsAtTurnStartAnchor, "processUltimateDestroyGodEffectsAtTurnStartAnchor");
      return {
        processUltimateDestroyGodEffects,
        processUltimateDestroyGodEffectsAtAnchor,
        processUltimateDestroyGodEffectsAtTurnStartAnchor
      };
    });
  }
});

// game/logic/cards/hyperactive.js
var require_hyperactive = __commonJS({
  "game/logic/cards/hyperactive.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardHyperactive = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { BLACK, WHITE, EMPTY } = SharedConstants || {};
      function clearUltimateHyperactiveAtPositions(cardState2, positions) {
        if (!cardState2 || !Array.isArray(cardState2.markers)) return;
        const removeSet = new Set((positions || []).map((p) => `${p.row},${p.col}`));
        cardState2.markers = cardState2.markers.filter((m) => {
          if (!m || m.kind !== "specialStone") return true;
          if (!m.data || m.data.type !== "ULTIMATE_HYPERACTIVE") return true;
          return !removeSet.has(`${m.row},${m.col}`);
        });
      }
      __name(clearUltimateHyperactiveAtPositions, "clearUltimateHyperactiveAtPositions");
      function getNeighborEmptyCandidates(gameState, row, col) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
            if (gameState.board[r][c] === EMPTY) out.push({ row: r, col: c });
          }
        }
        return out;
      }
      __name(getNeighborEmptyCandidates, "getNeighborEmptyCandidates");
      function getNeighborEnemyCandidates(gameState, row, col, enemyVal) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
            if (gameState.board[r][c] === enemyVal) out.push({ row: r, col: c });
          }
        }
        return out;
      }
      __name(getNeighborEnemyCandidates, "getNeighborEnemyCandidates");
      function destroyUltimateAnchorWithBurst(cardState2, gameState, entry, ownerVal, deps, destroyAt) {
        const destroyed = [];
        const enemyVal = -ownerVal;
        const enemyTargets = getNeighborEnemyCandidates(gameState, entry.row, entry.col, enemyVal);
        for (const target of enemyTargets) {
          if (gameState.board[target.row][target.col] !== enemyVal) continue;
          let enemyDestroyed = false;
          if (deps.BoardOps && typeof deps.BoardOps.destroyAt === "function") {
            const res = deps.BoardOps.destroyAt(
              cardState2,
              gameState,
              target.row,
              target.col,
              "ULTIMATE_HYPERACTIVE_GOD",
              "no_candidates_burst"
            );
            enemyDestroyed = !!(res && res.destroyed);
          } else {
            enemyDestroyed = destroyAt(cardState2, gameState, target.row, target.col);
          }
          if (enemyDestroyed) destroyed.push({ row: target.row, col: target.col });
        }
        let anchorDestroyed = false;
        if (deps.BoardOps && typeof deps.BoardOps.destroyAt === "function") {
          const res = deps.BoardOps.destroyAt(cardState2, gameState, entry.row, entry.col, "ULTIMATE_HYPERACTIVE_GOD", "no_candidates");
          anchorDestroyed = !!(res && res.destroyed);
        } else {
          anchorDestroyed = destroyAt(cardState2, gameState, entry.row, entry.col);
        }
        if (anchorDestroyed) destroyed.push({ row: entry.row, col: entry.col });
        return destroyed;
      }
      __name(destroyUltimateAnchorWithBurst, "destroyUltimateAnchorWithBurst");
      function moveHyperactiveOnce(cardState2, gameState, entry, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: /* @__PURE__ */ __name(() => 0, "random") });
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
          if (gs.board[r][c] === EMPTY) return false;
          if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
          gs.board[r][c] = EMPTY;
          return true;
        });
        const getFlipsWithContext = deps.getFlipsWithContext || (() => []);
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions || ((cs, positions) => {
          if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.kind === "specialStone" && m.data && m.data.type === "HYPERACTIVE" && positions.some((p2) => p2.row === m.row && p2.col === m.col)));
        });
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => {
          if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.kind === "bomb" && m.row === r && m.col === c));
        });
        const moved = [];
        const destroyed = [];
        const flipped = [];
        const ownerKey = entry.owner;
        const ownerVal = ownerKey === "black" ? BLACK || 1 : WHITE || -1;
        if (gameState.board[entry.row][entry.col] !== ownerVal) {
          clearHyperactiveAtPositions(cardState2, [{ row: entry.row, col: entry.col }]);
          return { moved, destroyed, flipped, ownerKey };
        }
        const candidates = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = entry.row + dr;
            const c = entry.col + dc;
            if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
            if (gameState.board[r][c] === EMPTY) {
              candidates.push({ row: r, col: c });
            }
          }
        }
        if (typeof console !== "undefined" && console.log) console.log("[HYPERACTIVE] moveHyperactiveOnce candidates", candidates.length, "at", { row: entry.row, col: entry.col, owner: entry.owner });
        if (candidates.length === 0) {
          let destroyedRes = false;
          if (deps.BoardOps && typeof deps.BoardOps.destroyAt === "function") {
            const res = deps.BoardOps.destroyAt(cardState2, gameState, entry.row, entry.col, "HYPERACTIVE", "no_candidates");
            destroyedRes = !!res.destroyed;
          } else {
            destroyedRes = destroyAt(cardState2, gameState, entry.row, entry.col);
          }
          if (destroyedRes) {
            destroyed.push({ row: entry.row, col: entry.col });
          }
          return { moved, destroyed, flipped, ownerKey };
        }
        const index = Math.floor(p.random() * candidates.length);
        const target = candidates[index];
        if (typeof console !== "undefined" && console.log) console.log("[HYPERACTIVE] selected target", { index, target, candidatesLen: candidates.length });
        const flipCells = getFlipsWithContext(gameState, target.row, target.col, ownerVal, deps.getCardContext ? deps.getCardContext(cardState2) : {});
        if (deps.BoardOps && typeof deps.BoardOps.moveAt === "function") {
          deps.BoardOps.moveAt(cardState2, gameState, entry.row, entry.col, target.row, target.col, "HYPERACTIVE", "hyperactive_move");
        } else {
          gameState.board[entry.row][entry.col] = EMPTY;
          gameState.board[target.row][target.col] = ownerVal;
        }
        moved.push({ from: { row: entry.row, col: entry.col }, to: { row: target.row, col: target.col } });
        entry.row = target.row;
        entry.col = target.col;
        if (flipCells.length > 0) {
          const flipPositions = flipCells.map(([r, c]) => ({ row: r, col: c }));
          for (const [r, c] of flipCells) {
            if (deps.BoardOps && typeof deps.BoardOps.changeAt === "function") {
              deps.BoardOps.changeAt(cardState2, gameState, r, c, ownerKey, "HYPERACTIVE", "hyperactive_flip");
            } else {
              gameState.board[r][c] = ownerVal;
            }
          }
          clearHyperactiveAtPositions(cardState2, flipPositions);
          flipped.push(...flipPositions);
        }
        return { moved, destroyed, flipped, ownerKey };
      }
      __name(moveHyperactiveOnce, "moveHyperactiveOnce");
      function processHyperactiveMoves(cardState2, gameState, prng, deps = {}) {
        const moved = [];
        const destroyed = [];
        const flipped = [];
        const flippedByOwner = { black: [], white: [] };
        const entries = (cardState2.markers || []).filter((s) => s.kind === "specialStone" && s.data && s.data.type === "HYPERACTIVE").slice().sort((a, b) => (a.createdSeq || 0) - (b.createdSeq || 0));
        for (const entry of entries) {
          if (!(cardState2.markers || []).includes(entry)) continue;
          const res = moveHyperactiveOnce(cardState2, gameState, entry, prng, deps);
          moved.push(...res.moved);
          destroyed.push(...res.destroyed);
          flipped.push(...res.flipped);
          if (res.flipped.length > 0 && res.ownerKey && flippedByOwner[res.ownerKey]) {
            flippedByOwner[res.ownerKey].push(...res.flipped);
          }
        }
        return { moved, destroyed, flipped, flippedByOwner };
      }
      __name(processHyperactiveMoves, "processHyperactiveMoves");
      function processHyperactiveMoveAtAnchor(cardState2, gameState, playerKey, row, col, prng, deps = {}) {
        const entry = (cardState2.markers || []).find((s) => s.kind === "specialStone" && s.data && s.data.type === "HYPERACTIVE" && s.owner === playerKey && s.row === row && s.col === col);
        if (!entry) return { moved: [], destroyed: [], flipped: [] };
        return moveHyperactiveOnce(cardState2, gameState, entry, prng, deps);
      }
      __name(processHyperactiveMoveAtAnchor, "processHyperactiveMoveAtAnchor");
      function processUltimateHyperactiveMoveAtAnchor(cardState2, gameState, playerKey, row, col, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: /* @__PURE__ */ __name(() => 0, "random") });
        const entry = (cardState2.markers || []).find(
          (s) => s && s.kind === "specialStone" && s.data && s.data.type === "ULTIMATE_HYPERACTIVE" && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!entry) {
          return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey };
        }
        const ownerKey = entry.owner;
        const ownerVal = ownerKey === "black" ? BLACK || 1 : WHITE || -1;
        const clearUltimateAtPositions = deps.clearUltimateAtPositions || clearUltimateHyperactiveAtPositions;
        const getFlipsWithContext = deps.getFlipsWithContext || (() => []);
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
          if (gs.board[r][c] === EMPTY) return false;
          if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.row === r && m.col === c));
          gs.board[r][c] = EMPTY;
          return true;
        });
        const moved = [];
        const destroyed = [];
        const flipped = [];
        if (gameState.board[entry.row][entry.col] !== ownerVal) {
          clearUltimateAtPositions(cardState2, [{ row: entry.row, col: entry.col }]);
          return { moved, destroyed, flipped, ownerKey };
        }
        for (let step = 1; step <= 2; step++) {
          const candidates = getNeighborEmptyCandidates(gameState, entry.row, entry.col);
          if (!candidates.length) {
            destroyed.push(...destroyUltimateAnchorWithBurst(cardState2, gameState, entry, ownerVal, deps, destroyAt));
            break;
          }
          const target = candidates[Math.floor(p.random() * candidates.length)];
          const from = { row: entry.row, col: entry.col };
          const flipCells = getFlipsWithContext(
            gameState,
            target.row,
            target.col,
            ownerVal,
            deps.getCardContext ? deps.getCardContext(cardState2) : {}
          );
          let movedRes = false;
          if (deps.BoardOps && typeof deps.BoardOps.moveAt === "function") {
            const res = deps.BoardOps.moveAt(
              cardState2,
              gameState,
              entry.row,
              entry.col,
              target.row,
              target.col,
              "ULTIMATE_HYPERACTIVE_GOD",
              "ultimate_hyperactive_step_move",
              { step }
            );
            movedRes = !!(res && res.moved);
          } else {
            gameState.board[entry.row][entry.col] = EMPTY;
            gameState.board[target.row][target.col] = ownerVal;
            movedRes = true;
          }
          if (!movedRes) break;
          entry.row = target.row;
          entry.col = target.col;
          moved.push({ from, to: { row: target.row, col: target.col }, step });
          if (flipCells.length > 0) {
            const flipPositions = flipCells.map(([r, c]) => ({ row: r, col: c }));
            for (const [r, c] of flipCells) {
              if (deps.BoardOps && typeof deps.BoardOps.changeAt === "function") {
                deps.BoardOps.changeAt(cardState2, gameState, r, c, ownerKey, "ULTIMATE_HYPERACTIVE_GOD", "ultimate_hyperactive_flip");
              } else {
                gameState.board[r][c] = ownerVal;
              }
            }
            if (deps.clearHyperactiveAtPositions) {
              deps.clearHyperactiveAtPositions(cardState2, flipPositions);
            }
            flipped.push(...flipPositions);
          }
        }
        return { moved, destroyed, flipped, ownerKey };
      }
      __name(processUltimateHyperactiveMoveAtAnchor, "processUltimateHyperactiveMoveAtAnchor");
      return {
        moveHyperactiveOnce,
        processHyperactiveMoves,
        processHyperactiveMoveAtAnchor,
        processUltimateHyperactiveMoveAtAnchor
      };
    });
  }
});

// game/logic/cards/breeding.js
var require_breeding = __commonJS({
  "game/logic/cards/breeding.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardBreeding = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { BLACK, WHITE, EMPTY } = SharedConstants || {};
      if (BLACK === void 0 || WHITE === void 0 || EMPTY === void 0) {
        throw new Error("SharedConstants missing required values");
      }
      function _posKey(row, col) {
        return `${row},${col}`;
      }
      __name(_posKey, "_posKey");
      function _normalizePositions(positions) {
        const out = [];
        const seen = /* @__PURE__ */ new Set();
        const src = Array.isArray(positions) ? positions : [];
        for (const p of src) {
          if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) continue;
          const key = _posKey(p.row, p.col);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ row: p.row, col: p.col });
        }
        return out;
      }
      __name(_normalizePositions, "_normalizePositions");
      function _ensureBreedingRuntime(cardState2) {
        if (!cardState2 || typeof cardState2 !== "object") return;
        if (!cardState2.breedingFrontierByAnchorId || typeof cardState2.breedingFrontierByAnchorId !== "object") {
          cardState2.breedingFrontierByAnchorId = {};
        }
        if (!cardState2.breedingSproutByOwner || typeof cardState2.breedingSproutByOwner !== "object") {
          cardState2.breedingSproutByOwner = { black: [], white: [] };
        }
        if (!Array.isArray(cardState2.breedingSproutByOwner.black)) cardState2.breedingSproutByOwner.black = [];
        if (!Array.isArray(cardState2.breedingSproutByOwner.white)) cardState2.breedingSproutByOwner.white = [];
        if (!cardState2._breedingSproutClearedTokenByOwner || typeof cardState2._breedingSproutClearedTokenByOwner !== "object") {
          cardState2._breedingSproutClearedTokenByOwner = { black: null, white: null };
        }
      }
      __name(_ensureBreedingRuntime, "_ensureBreedingRuntime");
      function _getFrontier(cardState2, anchorId) {
        _ensureBreedingRuntime(cardState2);
        const key = String(anchorId);
        const frontier = cardState2.breedingFrontierByAnchorId[key];
        return _normalizePositions(frontier);
      }
      __name(_getFrontier, "_getFrontier");
      function _setFrontier(cardState2, anchorId, positions) {
        _ensureBreedingRuntime(cardState2);
        const key = String(anchorId);
        cardState2.breedingFrontierByAnchorId[key] = _normalizePositions(positions);
      }
      __name(_setFrontier, "_setFrontier");
      function _clearFrontier(cardState2, anchorId) {
        _ensureBreedingRuntime(cardState2);
        delete cardState2.breedingFrontierByAnchorId[String(anchorId)];
      }
      __name(_clearFrontier, "_clearFrontier");
      function _replaceSprouts(cardState2, playerKey, positions) {
        _ensureBreedingRuntime(cardState2);
        cardState2.breedingSproutByOwner[playerKey] = _normalizePositions(positions);
      }
      __name(_replaceSprouts, "_replaceSprouts");
      function _mergeSprouts(cardState2, playerKey, positions) {
        _ensureBreedingRuntime(cardState2);
        const base = cardState2.breedingSproutByOwner[playerKey] || [];
        cardState2.breedingSproutByOwner[playerKey] = _normalizePositions(base.concat(positions || []));
      }
      __name(_mergeSprouts, "_mergeSprouts");
      function _clearSproutsOnceAtTurn(cardState2, playerKey) {
        _ensureBreedingRuntime(cardState2);
        const token = `${playerKey}:${Number.isFinite(cardState2.turnIndex) ? cardState2.turnIndex : 0}`;
        if (cardState2._breedingSproutClearedTokenByOwner[playerKey] !== token) {
          cardState2._breedingSproutClearedTokenByOwner[playerKey] = token;
          _replaceSprouts(cardState2, playerKey, []);
        }
      }
      __name(_clearSproutsOnceAtTurn, "_clearSproutsOnceAtTurn");
      function _collectEmptyNeighborTargets(gameState, origins) {
        const targets = [];
        const seen = /* @__PURE__ */ new Set();
        const src = _normalizePositions(origins);
        for (const origin of src) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const r = origin.row + dr;
              const c = origin.col + dc;
              if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
              if (gameState.board[r][c] !== EMPTY) continue;
              const key = _posKey(r, c);
              if (seen.has(key)) continue;
              seen.add(key);
              targets.push({ row: r, col: c });
            }
          }
        }
        return targets;
      }
      __name(_collectEmptyNeighborTargets, "_collectEmptyNeighborTargets");
      function _pickRandomTarget(targets, prng) {
        const list = Array.isArray(targets) ? targets : [];
        if (list.length === 0) return null;
        const p = prng && typeof prng.random === "function" ? prng : { random: /* @__PURE__ */ __name(() => 0, "random") };
        const idx = Math.floor(p.random() * list.length);
        return list[Math.max(0, Math.min(list.length - 1, idx))];
      }
      __name(_pickRandomTarget, "_pickRandomTarget");
      function _spawnAndFlipBatch(cardState2, gameState, playerKey, player, targets, cause, reason, anchorPos, deps) {
        const spawned = [];
        const flipped = [];
        const flippedSet = /* @__PURE__ */ new Set();
        const getCardContext = deps.getCardContext || (() => ({ protectedStones: [], permaProtectedStones: [] }));
        const getFlipsWithContext = deps.getFlipsWithContext || ((gs, r, c, playerVal, ctx) => []);
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => {
          if (cs.markers) cs.markers = cs.markers.filter((m) => !(m.kind === "bomb" && m.row === r && m.col === c));
        });
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions;
        for (const target of targets) {
          const context = getCardContext(cardState2);
          const flips = getFlipsWithContext(gameState, target.row, target.col, player, context);
          let spawnRes = null;
          if (deps.BoardOps && typeof deps.BoardOps.spawnAt === "function") {
            spawnRes = deps.BoardOps.spawnAt(cardState2, gameState, target.row, target.col, playerKey, cause, reason);
          } else {
            gameState.board[target.row][target.col] = player;
          }
          spawned.push({
            row: target.row,
            col: target.col,
            anchorRow: anchorPos.row,
            anchorCol: anchorPos.col,
            stoneId: spawnRes ? spawnRes.stoneId : void 0
          });
          for (const [fr, fc] of flips) {
            if (deps.BoardOps && typeof deps.BoardOps.changeAt === "function") {
              deps.BoardOps.changeAt(cardState2, gameState, fr, fc, playerKey, "BREEDING", "breeding_flip");
            } else {
              gameState.board[fr][fc] = player;
            }
            clearBombAt(cardState2, fr, fc);
            const key = _posKey(fr, fc);
            if (!flippedSet.has(key)) {
              flippedSet.add(key);
              flipped.push({ row: fr, col: fc });
            }
          }
        }
        if (flipped.length > 0 && typeof clearHyperactiveAtPositions === "function") {
          clearHyperactiveAtPositions(cardState2, flipped);
        }
        return { spawned, flipped };
      }
      __name(_spawnAndFlipBatch, "_spawnAndFlipBatch");
      function _processTurnStartAnchor(cardState2, gameState, playerKey, row, col, prng, deps = {}) {
        const player = playerKey === "black" ? BLACK || 1 : WHITE || -1;
        const spawned = [];
        const destroyed = [];
        const flipped = [];
        const anchors = [];
        _ensureBreedingRuntime(cardState2);
        _clearSproutsOnceAtTurn(cardState2, playerKey);
        const anchor = (cardState2.markers || []).find(
          (s) => s.kind === "specialStone" && s.data && s.data.type === "BREEDING" && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!anchor) return { spawned, destroyed, flipped, anchors };
        if (gameState.board[row][col] !== player) {
          if (anchor.data) anchor.data.remainingOwnerTurns = -1;
          _clearFrontier(cardState2, anchor.id);
          return { spawned, destroyed, flipped, anchors };
        }
        const before = anchor.data && (anchor.data.remainingOwnerTurns !== void 0 && anchor.data.remainingOwnerTurns !== null) ? anchor.data.remainingOwnerTurns : 0;
        const afterDec = before - 1;
        if (anchor.data) anchor.data.remainingOwnerTurns = afterDec;
        if (afterDec < 0) return { spawned, destroyed, flipped, anchors };
        anchors.push({ row, col, remainingNow: afterDec });
        const previousFrontier = _getFrontier(cardState2, anchor.id);
        const brokenFrontier = previousFrontier.some((p) => gameState.board[p.row][p.col] !== player);
        const origins = previousFrontier.length === 0 || brokenFrontier ? [{ row, col }] : previousFrontier;
        const targets = _collectEmptyNeighborTargets(gameState, origins);
        const picked = _pickRandomTarget(targets, prng);
        const batch = _spawnAndFlipBatch(
          cardState2,
          gameState,
          playerKey,
          player,
          picked ? [picked] : [],
          "BREEDING",
          "breeding_spawned",
          { row, col },
          deps
        );
        spawned.push(...batch.spawned);
        flipped.push(...batch.flipped);
        if (spawned.length > 0) _setFrontier(cardState2, anchor.id, spawned);
        else if (previousFrontier.length === 0 || brokenFrontier) _setFrontier(cardState2, anchor.id, []);
        _mergeSprouts(cardState2, playerKey, spawned);
        if (afterDec === 0) {
          destroyed.push({ row, col });
          if (deps.BoardOps && typeof deps.BoardOps.destroyAt === "function") {
            deps.BoardOps.destroyAt(cardState2, gameState, row, col, "BREEDING", "anchor_expired");
          } else {
            gameState.board[row][col] = EMPTY;
          }
          if (anchor.data) anchor.data.remainingOwnerTurns = -1;
          _clearFrontier(cardState2, anchor.id);
          if (cardState2.markers) {
            cardState2.markers = cardState2.markers.filter((m) => !(m.kind === "specialStone" && m.data && m.data.type === "BREEDING" && m.row === row && m.col === col && m.owner === playerKey));
          }
        }
        return { spawned, destroyed, flipped, anchors };
      }
      __name(_processTurnStartAnchor, "_processTurnStartAnchor");
      function processBreedingEffects(cardState2, gameState, playerKey, prng, deps = {}) {
        const spawned = [];
        const destroyed = [];
        const flipped = [];
        const anchors = [];
        _ensureBreedingRuntime(cardState2);
        _replaceSprouts(cardState2, playerKey, []);
        const anchorsForOwner = (cardState2.markers || []).filter(
          (s) => s.kind === "specialStone" && s.data && s.data.type === "BREEDING" && s.owner === playerKey
        );
        for (const anchor of anchorsForOwner) {
          const one = _processTurnStartAnchor(cardState2, gameState, playerKey, anchor.row, anchor.col, prng, deps);
          if (one.spawned && one.spawned.length) spawned.push(...one.spawned);
          if (one.destroyed && one.destroyed.length) destroyed.push(...one.destroyed);
          if (one.flipped && one.flipped.length) flipped.push(...one.flipped);
          if (one.anchors && one.anchors.length) anchors.push(...one.anchors);
        }
        return { spawned, destroyed, flipped, anchors };
      }
      __name(processBreedingEffects, "processBreedingEffects");
      function processBreedingEffectsAtAnchor(cardState2, gameState, playerKey, row, col, prng, deps = {}) {
        const player = playerKey === "black" ? BLACK || 1 : WHITE || -1;
        const spawned = [];
        const destroyed = [];
        const flipped = [];
        _ensureBreedingRuntime(cardState2);
        const anchor = (cardState2.markers || []).find(
          (s) => s.kind === "specialStone" && s.data && s.data.type === "BREEDING" && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!anchor) return { spawned, destroyed, flipped };
        if (gameState.board[row][col] !== player) return { spawned, destroyed, flipped };
        const targets = _collectEmptyNeighborTargets(gameState, [{ row, col }]);
        const picked = _pickRandomTarget(targets, prng);
        const batch = _spawnAndFlipBatch(
          cardState2,
          gameState,
          playerKey,
          player,
          picked ? [picked] : [],
          "BREEDING",
          "breeding_spawn_immediate",
          { row, col },
          deps
        );
        spawned.push(...batch.spawned);
        flipped.push(...batch.flipped);
        _setFrontier(cardState2, anchor.id, spawned);
        _mergeSprouts(cardState2, playerKey, spawned);
        return { spawned, destroyed, flipped };
      }
      __name(processBreedingEffectsAtAnchor, "processBreedingEffectsAtAnchor");
      function processBreedingEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, prng, deps = {}) {
        return _processTurnStartAnchor(cardState2, gameState, playerKey, row, col, prng, deps);
      }
      __name(processBreedingEffectsAtTurnStartAnchor, "processBreedingEffectsAtTurnStartAnchor");
      return {
        processBreedingEffects,
        processBreedingEffectsAtAnchor,
        processBreedingEffectsAtTurnStartAnchor
      };
    });
  }
});

// game/logic/effects/destroy_one_stone.js
var require_destroy_one_stone = __commonJS({
  "game/logic/effects/destroy_one_stone.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_board_ops());
      } else {
        root.DestroyOneStone = factory(root.BoardOps);
      }
    })(typeof self !== "undefined" ? self : exports, function(BoardOpsModule) {
      "use strict";
      function applyDestroyOneStone(cardState2, gameState, playerKey, row, col, deps = {}) {
        const result = { destroyed: false };
        if (!gameState || gameState.board[row][col] === 0) return result;
        const BoardOps = deps.BoardOps || BoardOpsModule;
        const destroyAtFn = deps.destroyAt;
        if (BoardOps && typeof BoardOps.destroyAt === "function") {
          const res = BoardOps.destroyAt(cardState2, gameState, row, col, "DESTROY_ONE_STONE", "destroy_one_stone");
          if (res && res.destroyed) {
            cardState2.pendingEffectByPlayer = cardState2.pendingEffectByPlayer || { black: null, white: null };
            cardState2.pendingEffectByPlayer[playerKey] = null;
            result.destroyed = true;
            return result;
          }
          if (res && res.destroyed === false) {
            return result;
          }
        }
        if (typeof destroyAtFn === "function") {
          const destroyed = destroyAtFn(cardState2, gameState, row, col);
          if (destroyed) {
            cardState2.pendingEffectByPlayer = cardState2.pendingEffectByPlayer || { black: null, white: null };
            cardState2.pendingEffectByPlayer[playerKey] = null;
            result.destroyed = true;
            return result;
          }
        }
        if (cardState2 && cardState2.markers) {
          cardState2.markers = cardState2.markers.filter((m) => !(m.row === row && m.col === col));
        }
        gameState.board[row][col] = 0;
        cardState2.pendingEffectByPlayer = cardState2.pendingEffectByPlayer || { black: null, white: null };
        cardState2.pendingEffectByPlayer[playerKey] = null;
        result.destroyed = true;
        return result;
      }
      __name(applyDestroyOneStone, "applyDestroyOneStone");
      return {
        applyDestroyOneStone
      };
    });
  }
});

// game/logic/effects/swap_with_enemy.js
var require_swap_with_enemy = __commonJS({
  "game/logic/effects/swap_with_enemy.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(
          require_shared_constants(),
          (function() {
            try {
              return require_utils();
            } catch (e) {
              return null;
            }
          })()
        );
      } else {
        root.SwapWithEnemy = factory(root.SharedConstants, root.CardUtils || null);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants, CardUtils) {
      "use strict";
      const { BLACK, WHITE } = SharedConstants || {};
      const P_BLACK = BLACK || 1;
      const P_WHITE = WHITE || -1;
      function applySwapWithEnemy(cardState2, gameState, playerKey, row, col, deps = {}) {
        const boardOpsInstance = deps.BoardOps;
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions;
        const result = { swapped: false };
        const player = playerKey === "black" ? P_BLACK : P_WHITE;
        const opponent = -player;
        if (!gameState || gameState.board[row][col] !== opponent) return result;
        const hasSpecialOrBomb = (cardState2.markers || []).some((m) => {
          if (!m || m.row !== row || m.col !== col) return false;
          if (m.kind === "bomb") return true;
          if (m.kind !== "specialStone") return false;
          const isHiddenTrapForPlayer = !!(m.data && m.data.type === "TRAP" && m.owner && m.owner !== playerKey);
          if (isHiddenTrapForPlayer) return false;
          return true;
        });
        if (hasSpecialOrBomb) return result;
        if (boardOpsInstance && typeof boardOpsInstance.changeAt === "function") {
          boardOpsInstance.changeAt(cardState2, gameState, row, col, playerKey, "SWAP", "swap_with_enemy");
        } else {
          gameState.board[row][col] = player;
        }
        if (typeof clearHyperactiveAtPositions === "function") {
          clearHyperactiveAtPositions(cardState2, [{ row, col }]);
        } else if (cardState2.markers && cardState2.markers.length) {
          cardState2.markers = cardState2.markers.filter(
            (s) => !(s.kind === "specialStone" && s.data && s.data.type === "HYPERACTIVE" && s.row === row && s.col === col)
          );
        }
        cardState2.pendingEffectByPlayer = cardState2.pendingEffectByPlayer || { black: null, white: null };
        cardState2.pendingEffectByPlayer[playerKey] = null;
        cardState2.charge = cardState2.charge || { black: 0, white: 0 };
        if (CardUtils && typeof CardUtils.addChargeWithDelta === "function") {
          CardUtils.addChargeWithDelta(cardState2, playerKey, 1, "swap_flip_gain");
        } else {
          cardState2.charge[playerKey] = Math.min(30, (cardState2.charge[playerKey] || 0) + 1);
        }
        result.swapped = true;
        return result;
      }
      __name(applySwapWithEnemy, "applySwapWithEnemy");
      return {
        applySwapWithEnemy
      };
    });
  }
});

// game/logic/cards.js
var require_cards = __commonJS({
  "game/logic/cards.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory(require_shared_constants());
      } else {
        root.CardLogic = factory(root.SharedConstants);
      }
    })(typeof self !== "undefined" ? self : exports, function(SharedConstants) {
      "use strict";
      const { CARD_DEFS, CARD_TYPE_BY_ID, BLACK, WHITE, EMPTY, DIRECTIONS } = SharedConstants || {};
      if (!CARD_DEFS) {
        throw new Error("SharedConstants not loaded");
      }
      const INITIAL_HAND_SIZE = 0;
      const MAX_HAND_SIZE = 5;
      const DRAW_INTERVAL = 1;
      const DOUBLE_PLACE_EXTRA = 1;
      const CHAIN_WILL_MAX_LINKS = 2;
      const HEAVEN_BLESSING_OFFER_COUNT = 5;
      const TIME_BOMB_TURNS = 3;
      const ULTIMATE_DRAGON_TURNS = 5;
      const ULTIMATE_DESTROY_GOD_TURNS = 5;
      const DECK_SIZE = 30;
      function isWorkDebugEnabled(cardState2) {
        if (cardState2 && cardState2.debugWorkLog === true) return true;
        try {
          if (typeof globalThis !== "undefined" && globalThis.DEBUG_WORK_LOG === true) return true;
        } catch (e) {
        }
        return false;
      }
      __name(isWorkDebugEnabled, "isWorkDebugEnabled");
      function workDebugLog(cardState2) {
        if (!isWorkDebugEnabled(cardState2)) return;
        try {
          if (typeof console !== "undefined" && console.log) console.log.apply(console, Array.prototype.slice.call(arguments, 1));
        } catch (e) {
        }
      }
      __name(workDebugLog, "workDebugLog");
      function workDebugError(cardState2) {
        if (!isWorkDebugEnabled(cardState2)) return;
        try {
          if (typeof console !== "undefined" && console.error) console.error.apply(console, Array.prototype.slice.call(arguments, 1));
        } catch (e) {
        }
      }
      __name(workDebugError, "workDebugError");
      function destroyAt(cardState2, gameState, row, col) {
        if (BoardOpsModule && typeof BoardOpsModule.destroyAt === "function") {
          const res = BoardOpsModule.destroyAt(cardState2, gameState, row, col, "SYSTEM", "legacy_fallback");
          return !!res.destroyed;
        }
        if (gameState.board[row][col] === EMPTY) return false;
        removeMarkersAt(cardState2, row, col);
        gameState.board[row][col] = EMPTY;
        return true;
      }
      __name(destroyAt, "destroyAt");
      function clearBombAt(cardState2, row, col) {
        if (!cardState2) return false;
        const beforeLen = getBombMarkers(cardState2).length;
        removeMarkersAt(cardState2, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb" });
        return getBombMarkers(cardState2).length !== beforeLen;
      }
      __name(clearBombAt, "clearBombAt");
      const defaultPrng = {
        shuffle: /* @__PURE__ */ __name((array) => array, "shuffle"),
        random: /* @__PURE__ */ __name(() => {
          throw new Error("PRNG.random() called without injected PRNG. Inject a deterministic PRNG for rule logic.");
        }, "random")
      };
      const CardCostsModule = (() => {
        if (typeof __require === "function") {
          try {
            return require_costs();
          } catch (e) {
            return null;
          }
        }
        const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
        return globalScope.CardCosts || null;
      })();
      const CardDefsModule = (() => {
        if (typeof __require === "function") {
          try {
            return require_defs();
          } catch (e) {
            return null;
          }
        }
        const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
        return globalScope.CardDefs || null;
      })();
      const CardUtilsModule = (() => {
        if (typeof __require === "function") {
          try {
            return require_utils();
          } catch (e) {
            return null;
          }
        }
        const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
        return globalScope.CardUtils || null;
      })();
      function setChargeValue(cardState2, playerKey, nextValue, reason) {
        if (CardUtilsModule && typeof CardUtilsModule.setChargeWithDelta === "function") {
          return CardUtilsModule.setChargeWithDelta(cardState2, playerKey, nextValue, reason);
        }
        if (!cardState2) return { changed: false, before: 0, after: 0, delta: 0 };
        if (!cardState2.charge) cardState2.charge = { black: 0, white: 0 };
        const before = Number(cardState2.charge[playerKey] || 0);
        const safeBefore = Number.isFinite(before) ? before : 0;
        const requested = Number(nextValue);
        const safeRequested = Number.isFinite(requested) ? requested : safeBefore;
        const after = Math.max(0, Math.min(30, safeRequested));
        cardState2.charge[playerKey] = after;
        return { changed: after !== safeBefore, before: safeBefore, after, delta: after - safeBefore };
      }
      __name(setChargeValue, "setChargeValue");
      function addChargeValue(cardState2, playerKey, amount, reason) {
        if (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === "function") {
          return CardUtilsModule.addChargeWithDelta(cardState2, playerKey, amount, reason);
        }
        if (!cardState2) return { changed: false, before: 0, after: 0, delta: 0 };
        if (!cardState2.charge) cardState2.charge = { black: 0, white: 0 };
        const before = Number(cardState2.charge[playerKey] || 0);
        const safeBefore = Number.isFinite(before) ? before : 0;
        const add = Number(amount);
        const safeAdd = Number.isFinite(add) ? add : 0;
        return setChargeValue(cardState2, playerKey, safeBefore + safeAdd, reason);
      }
      __name(addChargeValue, "addChargeValue");
      const CardSelectorsModule = (() => {
        if (typeof __require === "function") {
          try {
            return require_selectors();
          } catch (e) {
            return null;
          }
        }
        const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
        return globalScope.CardSelectors || null;
      })();
      const BoardOpsModule = (() => {
        if (typeof __require === "function") {
          try {
            return require_board_ops();
          } catch (e) {
            return null;
          }
        }
        const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
        return globalScope.BoardOps || null;
      })();
      const MarkersAdapter2 = (() => {
        if (typeof __require === "function") {
          try {
            return require_markers_adapter();
          } catch (e) {
            return null;
          }
        }
        const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
        return globalScope.MarkersAdapter || null;
      })();
      const MARKER_KINDS = MarkersAdapter2 && MarkersAdapter2.MARKER_KINDS;
      function ensureMarkers(cardState2) {
        if (MarkersAdapter2 && typeof MarkersAdapter2.ensureMarkers === "function") {
          MarkersAdapter2.ensureMarkers(cardState2);
          return;
        }
        if (!cardState2) return;
        if (!Array.isArray(cardState2.markers)) cardState2.markers = [];
        if (typeof cardState2._nextMarkerId !== "number") cardState2._nextMarkerId = 1;
        if (typeof cardState2._nextCreatedSeq !== "number") cardState2._nextCreatedSeq = 1;
      }
      __name(ensureMarkers, "ensureMarkers");
      function getMarkers(cardState2) {
        return MarkersAdapter2 && typeof MarkersAdapter2.getMarkers === "function" ? MarkersAdapter2.getMarkers(cardState2) : cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
      }
      __name(getMarkers, "getMarkers");
      function getSpecialMarkers(cardState2) {
        return MarkersAdapter2 && typeof MarkersAdapter2.getSpecialMarkers === "function" ? MarkersAdapter2.getSpecialMarkers(cardState2) : getMarkers(cardState2).filter((m) => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone"));
      }
      __name(getSpecialMarkers, "getSpecialMarkers");
      function getBombMarkers(cardState2) {
        return MarkersAdapter2 && typeof MarkersAdapter2.getBombMarkers === "function" ? MarkersAdapter2.getBombMarkers(cardState2) : getMarkers(cardState2).filter((m) => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb"));
      }
      __name(getBombMarkers, "getBombMarkers");
      function findSpecialMarkerAt(cardState2, row, col, type, owner) {
        if (MarkersAdapter2 && typeof MarkersAdapter2.findSpecialMarkerAt === "function") {
          return MarkersAdapter2.findSpecialMarkerAt(cardState2, row, col, type, owner);
        }
        return getMarkers(cardState2).find((m) => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone") && m.row === row && m.col === col && (type ? m.data && m.data.type === type : true) && (owner ? m.owner === owner : true));
      }
      __name(findSpecialMarkerAt, "findSpecialMarkerAt");
      function findBombMarkerAt(cardState2, row, col) {
        if (MarkersAdapter2 && typeof MarkersAdapter2.findBombMarkerAt === "function") {
          return MarkersAdapter2.findBombMarkerAt(cardState2, row, col);
        }
        return getMarkers(cardState2).find((m) => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb") && m.row === row && m.col === col);
      }
      __name(findBombMarkerAt, "findBombMarkerAt");
      function removeMarkersAt(cardState2, row, col, options) {
        if (MarkersAdapter2 && typeof MarkersAdapter2.removeMarkersAt === "function") {
          MarkersAdapter2.removeMarkersAt(cardState2, row, col, options);
          return;
        }
        if (!cardState2 || !Array.isArray(cardState2.markers)) return;
        const opts = options || {};
        cardState2.markers = cardState2.markers.filter((m) => {
          if (m.row !== row || m.col !== col) return true;
          if (opts.kind && m.kind !== opts.kind) return true;
          if (opts.type && (!m.data || m.data.type !== opts.type)) return true;
          if (opts.owner && m.owner !== opts.owner) return true;
          return false;
        });
      }
      __name(removeMarkersAt, "removeMarkersAt");
      function swapCellCoordinates(cardState2, posA, posB) {
        if (!cardState2 || !posA || !posB) return;
        const aRow = Number(posA.row);
        const aCol = Number(posA.col);
        const bRow = Number(posB.row);
        const bCol = Number(posB.col);
        if (!Number.isInteger(aRow) || !Number.isInteger(aCol) || !Number.isInteger(bRow) || !Number.isInteger(bCol)) return;
        if (cardState2.stoneIdMap && cardState2.stoneIdMap[aRow] && cardState2.stoneIdMap[bRow]) {
          const stoneA = cardState2.stoneIdMap[aRow][aCol];
          const stoneB = cardState2.stoneIdMap[bRow][bCol];
          cardState2.stoneIdMap[aRow][aCol] = stoneB;
          cardState2.stoneIdMap[bRow][bCol] = stoneA;
        }
        const markers = getMarkers(cardState2);
        for (const m of markers) {
          if (!m) continue;
          if (m.row === aRow && m.col === aCol) {
            m.row = bRow;
            m.col = bCol;
          } else if (m.row === bRow && m.col === bCol) {
            m.row = aRow;
            m.col = aCol;
          }
        }
        const swapPoint = /* @__PURE__ */ __name((p) => {
          if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) return p;
          if (p.row === aRow && p.col === aCol) return { row: bRow, col: bCol };
          if (p.row === bRow && p.col === bCol) return { row: aRow, col: aCol };
          return p;
        }, "swapPoint");
        if (cardState2.workAnchorPosByPlayer) {
          cardState2.workAnchorPosByPlayer.black = swapPoint(cardState2.workAnchorPosByPlayer.black);
          cardState2.workAnchorPosByPlayer.white = swapPoint(cardState2.workAnchorPosByPlayer.white);
        }
        if (cardState2.breedingSproutByOwner) {
          for (const owner of ["black", "white"]) {
            const arr = Array.isArray(cardState2.breedingSproutByOwner[owner]) ? cardState2.breedingSproutByOwner[owner] : [];
            cardState2.breedingSproutByOwner[owner] = arr.map(swapPoint);
          }
        }
        if (cardState2.breedingFrontierByAnchorId && typeof cardState2.breedingFrontierByAnchorId === "object") {
          for (const key of Object.keys(cardState2.breedingFrontierByAnchorId)) {
            const arr = Array.isArray(cardState2.breedingFrontierByAnchorId[key]) ? cardState2.breedingFrontierByAnchorId[key] : [];
            cardState2.breedingFrontierByAnchorId[key] = arr.map(swapPoint);
          }
        }
      }
      __name(swapCellCoordinates, "swapCellCoordinates");
      function createCardState(prng) {
        const p = prng || defaultPrng;
        const buildDeck = /* @__PURE__ */ __name(() => {
          const enabledDefs = CARD_DEFS.filter((c) => c.enabled !== false);
          const idsByType = /* @__PURE__ */ new Map();
          for (const def of enabledDefs) {
            if (!idsByType.has(def.type)) idsByType.set(def.type, []);
            idsByType.get(def.type).push(def.id);
          }
          const guaranteed = [];
          for (const ids of idsByType.values()) {
            const pool = ids.slice();
            p.shuffle(pool);
            guaranteed.push(pool[0]);
          }
          const deck = guaranteed.slice();
          const allIds = enabledDefs.map((d) => d.id);
          while (deck.length < DECK_SIZE && allIds.length > 0) {
            const pool = allIds.slice();
            p.shuffle(pool);
            deck.push(pool[0]);
          }
          p.shuffle(deck);
          return deck;
        }, "buildDeck");
        const blackDeck = buildDeck();
        const whiteDeck = buildDeck();
        return {
          // Per-player decks (non-shared)
          decks: {
            black: blackDeck,
            white: whiteDeck
          },
          // Legacy compatibility field. Do not use in new code.
          deck: blackDeck.slice(),
          discard: [],
          initialDeckSize: DECK_SIZE,
          initialDeckSizeByPlayer: { black: DECK_SIZE, white: DECK_SIZE },
          reshuffleRequiresFullCycle: false,
          hands: { black: [], white: [] },
          turnIndex: 0,
          lastTurnStartedFor: null,
          turnCountByPlayer: { black: 0, white: 0 },
          // Card usage state
          selectedCardId: null,
          hasUsedCardThisTurnByPlayer: { black: false, white: false },
          pendingEffectByPlayer: { black: null, white: null },
          activeEffectsByPlayer: { black: [], white: [] },
          // Special effects state - unified markers array (future primary storage)
          // Format: { id, row, col, kind, owner, data: {...} }
          markers: [],
          _nextMarkerId: 1,
          _nextCreatedSeq: 1,
          // Presentation event support (PoC)
          presentationEvents: [],
          // [{type, stoneId, row, col, ownerBefore, ownerAfter, cause, reason, meta, actionId, turnIndex, plyIndex}]
          _nextStoneId: 5,
          // s1-s4 are initial stones
          stoneIdMap: (function() {
            const m = Array(8).fill(null).map(() => Array(8).fill(null));
            m[3][3] = "s1";
            m[3][4] = "s2";
            m[4][3] = "s3";
            m[4][4] = "s4";
            return m;
          })(),
          hyperactiveSeqCounter: 0,
          // Recent usage
          lastUsedCardByPlayer: { black: null, white: null },
          cardUseCountByPlayer: { black: 0, white: 0 },
          // Resources
          charge: { black: 0, white: 0 },
          chargeGainedTotal: { black: 0, white: 0 },
          chargeDeltaEvents: [],
          _nextChargeDeltaSeq: 1,
          // Extra actions
          extraPlaceRemainingByPlayer: { black: 0, white: 0 },
          // Work Will state
          workAnchorPosByPlayer: { black: null, white: null },
          workNextPlacementArmedByPlayer: { black: false, white: false },
          // Breeding runtime state
          // - frontier: next breeding origins per anchor id
          // - sprout: one-turn visual tags for stones spawned by breeding
          breedingFrontierByAnchorId: {},
          breedingSproutByOwner: { black: [], white: [] },
          _breedingSproutClearedTokenByOwner: { black: null, white: null }
        };
      }
      __name(createCardState, "createCardState");
      function copyCardState(cs) {
        const legacyDeck = Array.isArray(cs.deck) ? cs.deck.slice() : [];
        const decks = cs.decks && typeof cs.decks === "object" ? {
          black: Array.isArray(cs.decks.black) ? cs.decks.black.slice() : legacyDeck.slice(),
          white: Array.isArray(cs.decks.white) ? cs.decks.white.slice() : legacyDeck.slice()
        } : { black: legacyDeck.slice(), white: legacyDeck.slice() };
        const initialDeckSizeByPlayer = cs.initialDeckSizeByPlayer && typeof cs.initialDeckSizeByPlayer === "object" ? {
          black: Number.isFinite(cs.initialDeckSizeByPlayer.black) ? cs.initialDeckSizeByPlayer.black : decks.black.length,
          white: Number.isFinite(cs.initialDeckSizeByPlayer.white) ? cs.initialDeckSizeByPlayer.white : decks.white.length
        } : {
          black: Number.isFinite(cs.initialDeckSize) ? cs.initialDeckSize : decks.black.length,
          white: Number.isFinite(cs.initialDeckSize) ? cs.initialDeckSize : decks.white.length
        };
        return {
          decks,
          // Legacy compatibility field. Do not use in new code.
          deck: decks.black.slice(),
          discard: cs.discard.slice(),
          hands: {
            black: cs.hands.black.slice(),
            white: cs.hands.white.slice()
          },
          turnIndex: cs.turnIndex,
          lastTurnStartedFor: cs.lastTurnStartedFor,
          turnCountByPlayer: { ...cs.turnCountByPlayer },
          selectedCardId: cs.selectedCardId,
          hasUsedCardThisTurnByPlayer: { ...cs.hasUsedCardThisTurnByPlayer },
          pendingEffectByPlayer: {
            black: cs.pendingEffectByPlayer.black ? { ...cs.pendingEffectByPlayer.black } : null,
            white: cs.pendingEffectByPlayer.white ? { ...cs.pendingEffectByPlayer.white } : null
          },
          activeEffectsByPlayer: {
            black: cs.activeEffectsByPlayer.black.map((e) => ({ ...e })),
            white: cs.activeEffectsByPlayer.white.map((e) => ({ ...e }))
          },
          // Unified markers (new primary storage)
          markers: (cs.markers || []).map((m) => ({ ...m, data: { ...m.data || {} } })),
          _nextMarkerId: cs._nextMarkerId || 1,
          _nextCreatedSeq: cs._nextCreatedSeq || 1,
          stoneIdMap: (cs.stoneIdMap || Array(8).fill(null).map(() => Array(8).fill(null))).map((row) => row.slice()),
          hyperactiveSeqCounter: cs.hyperactiveSeqCounter || 0,
          lastUsedCardByPlayer: { ...cs.lastUsedCardByPlayer },
          cardUseCountByPlayer: { ...cs.cardUseCountByPlayer || { black: 0, white: 0 } },
          charge: { ...cs.charge },
          chargeGainedTotal: { ...cs.chargeGainedTotal || { black: 0, white: 0 } },
          chargeDeltaEvents: Array.isArray(cs.chargeDeltaEvents) ? cs.chargeDeltaEvents.map((e) => ({ ...e })) : [],
          _nextChargeDeltaSeq: typeof cs._nextChargeDeltaSeq === "number" ? cs._nextChargeDeltaSeq : 1,
          extraPlaceRemainingByPlayer: { ...cs.extraPlaceRemainingByPlayer },
          initialDeckSize: Number.isFinite(cs.initialDeckSize) ? cs.initialDeckSize : decks.black.length,
          initialDeckSizeByPlayer,
          reshuffleRequiresFullCycle: cs.reshuffleRequiresFullCycle !== false,
          // Breeding runtime state
          breedingFrontierByAnchorId: cs.breedingFrontierByAnchorId && typeof cs.breedingFrontierByAnchorId === "object" ? Object.fromEntries(Object.entries(cs.breedingFrontierByAnchorId).map(([k, arr]) => [
            String(k),
            Array.isArray(arr) ? arr.map((p) => ({ row: p.row, col: p.col })) : []
          ])) : {},
          breedingSproutByOwner: {
            black: cs.breedingSproutByOwner && Array.isArray(cs.breedingSproutByOwner.black) ? cs.breedingSproutByOwner.black.map((p) => ({ row: p.row, col: p.col })) : [],
            white: cs.breedingSproutByOwner && Array.isArray(cs.breedingSproutByOwner.white) ? cs.breedingSproutByOwner.white.map((p) => ({ row: p.row, col: p.col })) : []
          },
          _breedingSproutClearedTokenByOwner: cs._breedingSproutClearedTokenByOwner && typeof cs._breedingSproutClearedTokenByOwner === "object" ? {
            black: cs._breedingSproutClearedTokenByOwner.black || null,
            white: cs._breedingSproutClearedTokenByOwner.white || null
          } : { black: null, white: null }
        };
      }
      __name(copyCardState, "copyCardState");
      function dealInitialHands(cardState2, prng) {
        const p = prng || defaultPrng;
        cardState2.turnCountByPlayer["black"] = 0;
        cardState2.turnCountByPlayer["white"] = 0;
      }
      __name(dealInitialHands, "dealInitialHands");
      function initGame(prng) {
        if (!prng || typeof prng.shuffle !== "function") {
          throw new Error("initGame requires a PRNG object for deterministic initialization");
        }
        const cardState2 = createCardState(prng);
        dealInitialHands(cardState2, prng);
        return {
          cardState: cardState2,
          prngState: typeof prng.getState === "function" ? prng.getState() : null
        };
      }
      __name(initGame, "initGame");
      function addMarker(cardState2, kind, row, col, owner, data) {
        ensureMarkers(cardState2);
        const id = cardState2._nextMarkerId || 1;
        cardState2._nextMarkerId = id + 1;
        if (typeof cardState2._nextCreatedSeq === "undefined") cardState2._nextCreatedSeq = 1;
        const createdSeq = cardState2._nextCreatedSeq++;
        const marker = {
          id,
          row,
          col,
          kind,
          owner,
          createdSeq,
          data: data || {}
        };
        cardState2.markers.push(marker);
        try {
          var BoardPresentation = typeof __require === "function" ? require_presentation() : null;
          let special = null;
          let timer = null;
          if (kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone")) {
            special = data && data.type ? data.type : null;
            timer = data && typeof data.remainingOwnerTurns === "number" ? data.remainingOwnerTurns : null;
          } else if (kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb")) {
            special = "TIME_BOMB";
            timer = data && typeof data.remainingTurns === "number" ? data.remainingTurns : null;
          }
          if (special && BoardPresentation && typeof BoardPresentation.emitPresentationEvent === "function") {
            BoardPresentation.emitPresentationEvent(cardState2, { type: "STATUS_APPLIED", row, col, meta: { special, timer, owner } });
          }
          if (special && cardState2) {
            const currentActionId = cardState2._currentActionMeta && cardState2._currentActionMeta.actionId || null;
            const persist = Array.isArray(cardState2._presentationEventsPersist) ? cardState2._presentationEventsPersist : [];
            const live = Array.isArray(cardState2.presentationEvents) ? cardState2.presentationEvents : [];
            const patchSpawnMeta = /* @__PURE__ */ __name((arr) => {
              for (let i = arr.length - 1; i >= 0; i--) {
                const ev = arr[i];
                if (!ev || ev.type !== "SPAWN") continue;
                if (ev.row !== row || ev.col !== col) continue;
                if (currentActionId && ev.actionId && ev.actionId !== currentActionId) continue;
                ev.meta = Object.assign({}, ev.meta || {}, { special, timer, owner });
                return true;
              }
              return false;
            }, "patchSpawnMeta");
            if (!patchSpawnMeta(persist)) patchSpawnMeta(live);
          }
        } catch (e) {
        }
        return marker;
      }
      __name(addMarker, "addMarker");
      function removeMarkerById(cardState2, markerId) {
        if (!cardState2.markers) return false;
        const index = cardState2.markers.findIndex((m) => m.id === markerId);
        if (index === -1) return false;
        const marker = cardState2.markers[index];
        cardState2.markers.splice(index, 1);
        return true;
      }
      __name(removeMarkerById, "removeMarkerById");
      function commitDraw(cardState2, playerKey, prng) {
        const p = prng || defaultPrng;
        const decks = cardState2 && cardState2.decks && typeof cardState2.decks === "object" ? cardState2.decks : null;
        const playerDeck = decks && Array.isArray(decks[playerKey]) ? decks[playerKey] : Array.isArray(cardState2.deck) ? cardState2.deck : null;
        if (!playerDeck) return null;
        if (cardState2.hands[playerKey].length >= MAX_HAND_SIZE) {
          return null;
        }
        if (playerDeck.length === 0) {
          return null;
        }
        if (playerDeck.length > 0) {
          const cardId = playerDeck.pop();
          cardState2.hands[playerKey].push(cardId);
          return cardId;
        }
        return null;
      }
      __name(commitDraw, "commitDraw");
      function getCardDef(cardId) {
        if (CardDefsModule && typeof CardDefsModule.getCardDef === "function") {
          return CardDefsModule.getCardDef(cardId);
        }
        return CARD_DEFS.find((c) => c.id === cardId) || null;
      }
      __name(getCardDef, "getCardDef");
      function getCardType(cardId) {
        if (CardDefsModule && typeof CardDefsModule.getCardType === "function") {
          return CardDefsModule.getCardType(cardId);
        }
        return CARD_TYPE_BY_ID[cardId] || null;
      }
      __name(getCardType, "getCardType");
      function getCardDisplayName(cardId) {
        if (CardDefsModule && typeof CardDefsModule.getCardDisplayName === "function") {
          return CardDefsModule.getCardDisplayName(cardId);
        }
        const def = getCardDef(cardId);
        return def ? def.name : "";
      }
      __name(getCardDisplayName, "getCardDisplayName");
      function getCardCodeName(displayName) {
        if (CardDefsModule && typeof CardDefsModule.getCardCodeName === "function") {
          return CardDefsModule.getCardCodeName(displayName);
        }
        const def = CARD_DEFS.find((c) => c.name === displayName);
        return def ? def.id : null;
      }
      __name(getCardCodeName, "getCardCodeName");
      function getCardCost(cardId) {
        if (CardCostsModule && typeof CardCostsModule.getCardCost === "function") {
          return CardCostsModule.getCardCost(cardId);
        }
        const def = getCardDef(cardId);
        return def ? def.cost : 0;
      }
      __name(getCardCost, "getCardCost");
      function canUseCard(cardState2, playerKey, cardId) {
        if (cardState2.hasUsedCardThisTurnByPlayer[playerKey]) return false;
        if (!cardState2.hands[playerKey].includes(cardId)) return false;
        const cost = getCardCost(cardId);
        return cardState2.charge[playerKey] >= cost;
      }
      __name(canUseCard, "canUseCard");
      function getUsableCardIds(cardState2, gameState, playerKey) {
        if (!cardState2 || !cardState2.hands || !cardState2.hands[playerKey]) return [];
        const hand = cardState2.hands[playerKey] || [];
        const res = [];
        for (const cardId of hand) {
          if (!canUseCard(cardState2, playerKey, cardId)) continue;
          const def = getCardDef(cardId);
          if (!def) continue;
          const type = def.type;
          if (type === "SELL_CARD_WILL") {
            if (hand.length <= 1) continue;
          }
          if (type === "CONDEMN_WILL") {
            const opponentKey = playerKey === "black" ? "white" : "black";
            const opponentHand = cardState2.hands && Array.isArray(cardState2.hands[opponentKey]) ? cardState2.hands[opponentKey] : [];
            if (opponentHand.length === 0) continue;
          }
          if (gameState) {
            if (type === "TEMPT_WILL") {
              const targets = getTemptWillTargets(cardState2, gameState, playerKey);
              if (!targets || targets.length === 0) continue;
            }
            if (type === "TRAP_WILL") {
              const targets = getTrapTargets(cardState2, gameState, playerKey);
              if (!targets || targets.length === 0) continue;
            }
            if (type === "GUARD_WILL") {
              const targets = getGuardTargets(cardState2, gameState, playerKey);
              if (!targets || targets.length === 0) continue;
            }
            if (type === "TIME_BOMB") {
              const targets = getTimeBombTargets(cardState2, gameState, playerKey);
              if (!targets || targets.length === 0) continue;
            }
            if (type === "POSITION_SWAP_WILL") {
              let occupied = 0;
              for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                  if (gameState.board[r][c] !== EMPTY) occupied++;
                }
              }
              if (occupied < 2) continue;
            }
            if (CardSelectorsModule) {
              if (type === "DESTROY_ONE_STONE" && typeof CardSelectorsModule.getDestroyTargets === "function") {
                const targets = CardSelectorsModule.getDestroyTargets(cardState2, gameState);
                if (!targets || targets.length === 0) continue;
              }
              if (type === "STRONG_WIND_WILL" && typeof CardSelectorsModule.getStrongWindTargets === "function") {
                const targets = CardSelectorsModule.getStrongWindTargets(cardState2, gameState);
                if (!targets || targets.length === 0) continue;
              }
              if (type === "SACRIFICE_WILL" && typeof CardSelectorsModule.getSacrificeTargets === "function") {
                const targets = CardSelectorsModule.getSacrificeTargets(cardState2, gameState, playerKey);
                if (!targets || targets.length === 0) continue;
              }
              if (type === "SWAP_WITH_ENEMY" && typeof CardSelectorsModule.getSwapTargets === "function") {
                const targets = CardSelectorsModule.getSwapTargets(cardState2, gameState, playerKey);
                if (!targets || targets.length === 0) continue;
              }
              if (type === "POSITION_SWAP_WILL" && typeof CardSelectorsModule.getPositionSwapTargets === "function") {
                const targets = CardSelectorsModule.getPositionSwapTargets(cardState2, gameState, playerKey, null);
                if (!targets || targets.length < 2) continue;
              }
              if (type === "TRAP_WILL" && typeof CardSelectorsModule.getTrapTargets === "function") {
                const targets = CardSelectorsModule.getTrapTargets(cardState2, gameState, playerKey);
                if (!targets || targets.length === 0) continue;
              }
              if (type === "GUARD_WILL" && typeof CardSelectorsModule.getGuardTargets === "function") {
                const targets = CardSelectorsModule.getGuardTargets(cardState2, gameState, playerKey);
                if (!targets || targets.length === 0) continue;
              }
              if (type === "TIME_BOMB" && typeof CardSelectorsModule.getTimeBombTargets === "function") {
                const targets = CardSelectorsModule.getTimeBombTargets(cardState2, gameState, playerKey);
                if (!targets || targets.length === 0) continue;
              }
            }
          }
          res.push(cardId);
        }
        return res;
      }
      __name(getUsableCardIds, "getUsableCardIds");
      function hasUsableCard(cardState2, gameState, playerKey) {
        return getUsableCardIds(cardState2, gameState, playerKey).length > 0;
      }
      __name(hasUsableCard, "hasUsableCard");
      function buildHeavenBlessingOffers(cardIdToExclude) {
        const pool = (CARD_DEFS || []).filter((c) => c && c.enabled !== false && c.id && c.id !== cardIdToExclude).map((c) => c.id);
        if (pool.length === 0) return [];
        const out = [];
        while (pool.length > 0 && out.length < HEAVEN_BLESSING_OFFER_COUNT) {
          const idx = Math.floor(Math.random() * pool.length);
          out.push(pool[idx]);
          pool.splice(idx, 1);
        }
        return out;
      }
      __name(buildHeavenBlessingOffers, "buildHeavenBlessingOffers");
      function buildCondemnOffers(cardState2, playerKey) {
        if (!cardState2 || !cardState2.hands) return [];
        const opponentKey = playerKey === "black" ? "white" : "black";
        const hand = Array.isArray(cardState2.hands[opponentKey]) ? cardState2.hands[opponentKey] : [];
        return hand.map((cardId, handIndex) => ({ handIndex, cardId }));
      }
      __name(buildCondemnOffers, "buildCondemnOffers");
      function applyCardUsage(cardState2, playerKey, cardId) {
        let gameState = null;
        let handOwnerKey = arguments[3];
        let opts = arguments[4];
        if (typeof playerKey === "object" && playerKey && typeof cardId === "string") {
          gameState = playerKey;
          playerKey = arguments[2];
          cardId = arguments[3];
          handOwnerKey = arguments[4];
          opts = arguments[5];
        }
        const chargeOwnerKey = playerKey;
        const handKey = typeof handOwnerKey === "string" && handOwnerKey ? handOwnerKey : playerKey;
        const idx = cardState2.hands[handKey].indexOf(cardId);
        if (idx === -1) return false;
        const cost = getCardCost(cardId);
        if (!(opts && opts.ignoreCost)) {
          if (cardState2.charge[chargeOwnerKey] < cost) return false;
        }
        const cardType = getCardType(cardId);
        if (cardType === "TEMPT_WILL") {
          if (!gameState) return false;
          const targets = getTemptWillTargets(cardState2, gameState, chargeOwnerKey);
          if (!targets.length) return false;
        }
        if (cardType === "STRONG_WIND_WILL") {
          if (!gameState) return false;
          const targets = getStrongWindTargets(cardState2, gameState);
          if (!targets.length) return false;
        }
        if (cardType === "SELL_CARD_WILL") {
          const remainingHandCount = (cardState2.hands[handKey] ? cardState2.hands[handKey].length : 0) - 1;
          if (remainingHandCount <= 0) return false;
        }
        const heavenOffers = cardType === "HEAVEN_BLESSING" ? buildHeavenBlessingOffers(cardId) : null;
        if (cardType === "HEAVEN_BLESSING" && (!heavenOffers || heavenOffers.length === 0)) {
          return false;
        }
        const condemnOffers = cardType === "CONDEMN_WILL" ? buildCondemnOffers(cardState2, chargeOwnerKey) : null;
        if (cardType === "CONDEMN_WILL" && (!condemnOffers || condemnOffers.length === 0)) {
          return false;
        }
        if (cardType === "TRAP_WILL") {
          if (!gameState) return false;
          const targets = getTrapTargets(cardState2, gameState, chargeOwnerKey);
          if (!targets.length) return false;
        }
        if (cardType === "GUARD_WILL") {
          if (!gameState) return false;
          const targets = getGuardTargets(cardState2, gameState, chargeOwnerKey);
          if (!targets.length) return false;
        }
        if (cardType === "TIME_BOMB") {
          if (!gameState) return false;
          const targets = getTimeBombTargets(cardState2, gameState, chargeOwnerKey);
          if (!targets.length) return false;
        }
        if (cardType === "POSITION_SWAP_WILL") {
          if (!gameState) return false;
          const targets = getSelectableTargets({
            ...cardState2,
            pendingEffectByPlayer: {
              ...cardState2.pendingEffectByPlayer || { black: null, white: null },
              [chargeOwnerKey]: { type: "POSITION_SWAP_WILL", stage: "selectTarget" }
            }
          }, gameState, chargeOwnerKey);
          if (!targets || targets.length < 2) return false;
        }
        if (!(opts && opts.noConsume)) {
          cardState2.hands[handKey].splice(idx, 1);
          cardState2.discard.push(cardId);
          addChargeValue(cardState2, chargeOwnerKey, -cost, "card_use_cost");
          cardState2.hasUsedCardThisTurnByPlayer[chargeOwnerKey] = true;
          cardState2.cardUseCountByPlayer = cardState2.cardUseCountByPlayer || { black: 0, white: 0 };
          cardState2.cardUseCountByPlayer[chargeOwnerKey] = (cardState2.cardUseCountByPlayer[chargeOwnerKey] || 0) + 1;
        }
        cardState2.lastUsedCardByPlayer[chargeOwnerKey] = cardId;
        const needsSelection = cardType === "DESTROY_ONE_STONE" || cardType === "STRONG_WIND_WILL" || cardType === "SACRIFICE_WILL" || cardType === "SELL_CARD_WILL" || cardType === "HEAVEN_BLESSING" || cardType === "CONDEMN_WILL" || cardType === "SWAP_WITH_ENEMY" || cardType === "POSITION_SWAP_WILL" || cardType === "TRAP_WILL" || cardType === "TEMPT_WILL" || cardType === "GUARD_WILL" || cardType === "TIME_BOMB";
        cardState2.pendingEffectByPlayer[chargeOwnerKey] = {
          type: cardType,
          cardId,
          stage: needsSelection ? "selectTarget" : null,
          offers: heavenOffers || condemnOffers || void 0,
          selectedCount: cardType === "SACRIFICE_WILL" ? 0 : void 0,
          maxSelections: cardType === "SACRIFICE_WILL" ? 3 : void 0
        };
        if (cardType === "WORK_WILL") {
          if (!cardState2.workNextPlacementArmedByPlayer) cardState2.workNextPlacementArmedByPlayer = { black: false, white: false };
          cardState2.workNextPlacementArmedByPlayer[chargeOwnerKey] = true;
          workDebugLog(cardState2, "[WORK_DEBUG] Card played: WORK_WILL armed for", chargeOwnerKey);
        }
        const usedCardDef = getCardDef(cardId);
        try {
          emitPresentationEvent(cardState2, {
            type: "CARD_USED",
            player: chargeOwnerKey,
            cardId,
            meta: {
              owner: handKey,
              cost: Number.isFinite(cost) ? cost : null,
              name: usedCardDef && usedCardDef.name ? usedCardDef.name : null
            }
          });
        } catch (e) {
        }
        return true;
      }
      __name(applyCardUsage, "applyCardUsage");
      function cancelPendingSelection(cardState2, playerKey, opts) {
        if (!cardState2 || !cardState2.pendingEffectByPlayer) return { canceled: false, reason: "no_state" };
        const pending = cardState2.pendingEffectByPlayer[playerKey];
        if (!pending || pending.stage !== "selectTarget") return { canceled: false, reason: "not_pending" };
        if (pending.type !== "DESTROY_ONE_STONE" && pending.type !== "SACRIFICE_WILL" && pending.type !== "POSITION_SWAP_WILL") {
          return { canceled: false, reason: "not_cancellable" };
        }
        if (pending.type === "SACRIFICE_WILL" && Number(pending.selectedCount || 0) > 0) {
          cardState2.pendingEffectByPlayer[playerKey] = null;
          return { canceled: true, cardId: pending.cardId, finished: true };
        }
        const cardId = pending.cardId;
        const cardDef = cardId ? getCardDef(cardId) : null;
        const cost = cardDef ? cardDef.cost : 0;
        const refundCost = !(opts && opts.refundCost === false);
        const resetUsage = !(opts && opts.resetUsage === false);
        const noConsume = !!(opts && opts.noConsume);
        if (refundCost && !noConsume) {
          addChargeValue(cardState2, playerKey, cost, "card_cancel_refund");
        }
        if (resetUsage && !noConsume) {
          cardState2.hasUsedCardThisTurnByPlayer[playerKey] = false;
        }
        if (!noConsume) {
          cardState2.cardUseCountByPlayer = cardState2.cardUseCountByPlayer || { black: 0, white: 0 };
          cardState2.cardUseCountByPlayer[playerKey] = Math.max(0, (cardState2.cardUseCountByPlayer[playerKey] || 0) - 1);
        }
        if (cardId) {
          const handKey = cardState2.hands[playerKey] ? playerKey : "black";
          if (!cardState2.hands[handKey].includes(cardId)) {
            cardState2.hands[handKey].push(cardId);
          }
          const discardIndex = cardState2.discard.lastIndexOf(cardId);
          if (discardIndex >= 0) {
            cardState2.discard.splice(discardIndex, 1);
          }
        }
        cardState2.pendingEffectByPlayer[playerKey] = null;
        return { canceled: true, cardId };
      }
      __name(cancelPendingSelection, "cancelPendingSelection");
      function getSpecialMarkerAt(cardState2, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.getSpecialMarkerAt === "function") {
          return CardUtilsModule.getSpecialMarkerAt(cardState2, row, col);
        }
        const special = findSpecialMarkerAt(cardState2, row, col);
        if (special) return { kind: "specialStone", marker: special };
        const bomb = findBombMarkerAt(cardState2, row, col);
        if (bomb) return { kind: "bomb", marker: bomb };
        return null;
      }
      __name(getSpecialMarkerAt, "getSpecialMarkerAt");
      function isSpecialStoneAt(cardState2, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.isSpecialStoneAt === "function") {
          return CardUtilsModule.isSpecialStoneAt(cardState2, row, col);
        }
        return !!getSpecialMarkerAt(cardState2, row, col);
      }
      __name(isSpecialStoneAt, "isSpecialStoneAt");
      function getSpecialOwnerAt(cardState2, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.getSpecialOwnerAt === "function") {
          return CardUtilsModule.getSpecialOwnerAt(cardState2, row, col);
        }
        const entry = getSpecialMarkerAt(cardState2, row, col);
        if (!entry) return null;
        return entry.marker && entry.marker.owner ? entry.marker.owner : null;
      }
      __name(getSpecialOwnerAt, "getSpecialOwnerAt");
      function getTemptWillTargets(cardState2, gameState, playerKey) {
        if (typeof __require === "function" || typeof globalThis !== "undefined" && globalThis.CardTargets) {
          try {
            const mod = typeof __require === "function" ? require_targets() : globalThis.CardTargets;
            if (mod && typeof mod.getTemptWillTargets === "function") {
              return mod.getTemptWillTargets(cardState2, gameState, playerKey);
            }
          } catch (e) {
          }
        }
        const opponentKey = playerKey === "black" ? "white" : "black";
        const res = [];
        const hasGuardMarkerAt = /* @__PURE__ */ __name((row, col) => getSpecialMarkers(cardState2).some((m) => m && m.row === row && m.col === col && m.data && m.data.type === "GUARD"), "hasGuardMarkerAt");
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (hasGuardMarkerAt(r, c)) continue;
            if (!isSpecialStoneAt(cardState2, r, c)) continue;
            if (getSpecialOwnerAt(cardState2, r, c) !== opponentKey) continue;
            if (gameState.board[r][c] === 0) continue;
            res.push({ row: r, col: c });
          }
        }
        return res;
      }
      __name(getTemptWillTargets, "getTemptWillTargets");
      function getTrapTargets(cardState2, gameState, playerKey) {
        if (typeof __require === "function" || typeof globalThis !== "undefined" && globalThis.CardSelectors) {
          try {
            const mod = typeof __require === "function" ? require_selectors() : globalThis.CardSelectors;
            if (mod && typeof mod.getTrapTargets === "function") {
              return mod.getTrapTargets(cardState2, gameState, playerKey);
            }
          } catch (e) {
          }
        }
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const playerVal = playerKey === "black" ? P_BLACK : P_WHITE;
        const markers = cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
        const res = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] !== playerVal) continue;
            const hasBomb = markers.some((m) => m && m.row === r && m.col === c && m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb"));
            if (hasBomb) continue;
            const hasOwnTrap = markers.some((m) => m && m.row === r && m.col === c && m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone") && m.owner === playerKey && m.data && m.data.type === "TRAP");
            if (hasOwnTrap) continue;
            res.push({ row: r, col: c });
          }
        }
        return res;
      }
      __name(getTrapTargets, "getTrapTargets");
      function getGuardTargets(cardState2, gameState, playerKey) {
        if (typeof __require === "function" || typeof globalThis !== "undefined" && globalThis.CardSelectors) {
          try {
            const mod = typeof __require === "function" ? require_selectors() : globalThis.CardSelectors;
            if (mod && typeof mod.getGuardTargets === "function") {
              return mod.getGuardTargets(cardState2, gameState, playerKey);
            }
          } catch (e) {
          }
        }
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const playerVal = playerKey === "black" ? P_BLACK : P_WHITE;
        const markers = cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
        const res = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] !== playerVal) continue;
            const hasBomb = markers.some((m) => m && m.row === r && m.col === c && m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb"));
            if (hasBomb) continue;
            res.push({ row: r, col: c });
          }
        }
        return res;
      }
      __name(getGuardTargets, "getGuardTargets");
      function getTimeBombTargets(cardState2, gameState, playerKey) {
        if (typeof __require === "function" || typeof globalThis !== "undefined" && globalThis.CardSelectors) {
          try {
            const mod = typeof __require === "function" ? require_selectors() : globalThis.CardSelectors;
            if (mod && typeof mod.getTimeBombTargets === "function") {
              return mod.getTimeBombTargets(cardState2, gameState, playerKey);
            }
          } catch (e) {
          }
        }
        return getGuardTargets(cardState2, gameState, playerKey);
      }
      __name(getTimeBombTargets, "getTimeBombTargets");
      function applyTrapWill(cardState2, gameState, playerKey, row, col) {
        const pending = cardState2.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== "TRAP_WILL" || pending.stage !== "selectTarget") {
          return { applied: false, reason: "not_pending" };
        }
        const targets = getTrapTargets(cardState2, gameState, playerKey);
        const allowed = targets.some((t) => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: "invalid_target" };
        removeMarkersAt(cardState2, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone" });
        const opponentKey = playerKey === "black" ? "white" : "black";
        addMarker(cardState2, "specialStone", row, col, playerKey, {
          type: "TRAP",
          armedForPlayer: opponentKey,
          hidden: true
        });
        cardState2.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col };
      }
      __name(applyTrapWill, "applyTrapWill");
      function processTrapEffects(cardState2, gameState, activePlayerKey, options) {
        const opts = options || {};
        const expireOnOwnerTurnStart = !!opts.expireOnOwnerTurnStart;
        const res = { triggered: [], expired: [], disarmed: [] };
        if (!cardState2 || !gameState || !gameState.board) return res;
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const specials = getSpecialMarkers(cardState2).filter((m) => m && m.data && m.data.type === "TRAP");
        if (!specials.length) return res;
        for (const trap of specials) {
          const row = trap.row;
          const col = trap.col;
          const ownerKey = trap.owner === "white" ? "white" : "black";
          const opponentKey = ownerKey === "black" ? "white" : "black";
          const ownerVal = ownerKey === "black" ? P_BLACK : P_WHITE;
          const activeVal = activePlayerKey === "black" ? P_BLACK : P_WHITE;
          const cellVal = gameState.board[row][col];
          if (cellVal === EMPTY) {
            removeMarkersAt(cardState2, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone", type: "TRAP", owner: ownerKey });
            res.disarmed.push({ row, col, owner: ownerKey, reason: "empty" });
            continue;
          }
          if (cellVal === ownerVal) {
            if (expireOnOwnerTurnStart && activePlayerKey === ownerKey) {
              emitPresentationEvent(cardState2, {
                type: "STATUS_APPLIED",
                row,
                col,
                meta: { special: "TRAP_REVEAL", owner: ownerKey, reason: "trap_expired_reveal" }
              });
              if (BoardOpsModule && typeof BoardOpsModule.destroyAt === "function") {
                BoardOpsModule.destroyAt(cardState2, gameState, row, col, "TRAP_WILL", "trap_expired", { special: "TRAP_REVEAL", owner: ownerKey });
              } else {
                gameState.board[row][col] = EMPTY;
                removeMarkersAt(cardState2, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone", type: "TRAP", owner: ownerKey });
              }
              res.expired.push({ row, col, owner: ownerKey });
            }
            continue;
          }
          if (activePlayerKey === opponentKey && cellVal === activeVal) {
            const victimKey = opponentKey;
            const victimCharge = Math.max(0, Number(cardState2.charge[victimKey] || 0));
            setChargeValue(cardState2, victimKey, 0, "trap_confiscated");
            const gainedCharge = addChargeWithTotal(cardState2, ownerKey, victimCharge);
            const victimHand = Array.isArray(cardState2.hands[victimKey]) ? cardState2.hands[victimKey] : [];
            const stolenCount = Math.min(3, victimHand.length);
            const stolenCards = victimHand.splice(0, stolenCount);
            const ownerHand = Array.isArray(cardState2.hands[ownerKey]) ? cardState2.hands[ownerKey] : [];
            const handSpace = Math.max(0, MAX_HAND_SIZE - ownerHand.length);
            const toHand = stolenCards.slice(0, handSpace);
            const toDeck = stolenCards.slice(handSpace);
            if (toHand.length > 0) ownerHand.push(...toHand);
            if (toDeck.length > 0) {
              if (!cardState2.decks || typeof cardState2.decks !== "object") {
                cardState2.decks = { black: [], white: [] };
              }
              if (!Array.isArray(cardState2.decks[ownerKey])) cardState2.decks[ownerKey] = [];
              cardState2.decks[ownerKey].push(...toDeck);
            }
            removeMarkersAt(cardState2, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone", type: "TRAP", owner: ownerKey });
            res.triggered.push({
              row,
              col,
              owner: ownerKey,
              victim: victimKey,
              stolenCharge: victimCharge,
              gainedCharge,
              stolenHandCount: stolenCount,
              toHandCount: toHand.length,
              toDeckCount: toDeck.length
            });
            continue;
          }
          removeMarkersAt(cardState2, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone", type: "TRAP", owner: ownerKey });
          res.disarmed.push({ row, col, owner: ownerKey, reason: "changed_without_trigger" });
        }
        return res;
      }
      __name(processTrapEffects, "processTrapEffects");
      function applyTemptWill(cardState2, gameState, playerKey, row, col) {
        const pending = cardState2.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== "TEMPT_WILL" || pending.stage !== "selectTarget") {
          return { applied: false, reason: "not_pending" };
        }
        const opponentKey = playerKey === "black" ? "white" : "black";
        if (!isSpecialStoneAt(cardState2, row, col)) return { applied: false, reason: "not_special" };
        if (getSpecialOwnerAt(cardState2, row, col) !== opponentKey) return { applied: false, reason: "not_opponent_special" };
        if (gameState.board[row][col] === 0) return { applied: false, reason: "empty" };
        const guarded = getSpecialMarkers(cardState2).some((m) => m && m.row === row && m.col === col && m.data && m.data.type === "GUARD");
        if (guarded) return { applied: false, reason: "guarded" };
        if (BoardOpsModule && typeof BoardOpsModule.changeAt === "function") {
          BoardOpsModule.changeAt(cardState2, gameState, row, col, playerKey, "TEMPT_WILL", "tempt_applied");
        } else {
          const playerVal = playerKey === "black" ? BLACK || 1 : WHITE || -1;
          gameState.board[row][col] = playerVal;
        }
        let wasWork = false;
        const specialMarker = findSpecialMarkerAt(cardState2, row, col);
        if (specialMarker) {
          wasWork = !!(specialMarker.data && specialMarker.data.type === "WORK");
          specialMarker.owner = playerKey;
          if (specialMarker.data && specialMarker.data.expiresForPlayer !== void 0) {
            specialMarker.data.expiresForPlayer = playerKey;
          }
        }
        const bombMarker = findBombMarkerAt(cardState2, row, col);
        if (bombMarker) {
          bombMarker.owner = playerKey;
        }
        if (wasWork) {
          if (cardState2.workAnchorPosByPlayer && cardState2.workAnchorPosByPlayer[opponentKey]) {
            cardState2.workAnchorPosByPlayer[opponentKey] = null;
          }
          removeMarkersAt(cardState2, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone", type: "WORK" });
          emitPresentationEvent(cardState2, { type: "WORK_REMOVED", row, col, ownerBefore: opponentKey, ownerAfter: playerKey, cause: "TEMPT_WILL", removed: true, meta: {} });
        }
        cardState2.pendingEffectByPlayer[playerKey] = null;
        return { applied: true };
      }
      __name(applyTemptWill, "applyTemptWill");
      function applyGuardWill(cardState2, gameState, playerKey, row, col) {
        const pending = cardState2.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== "GUARD_WILL" || pending.stage !== "selectTarget") {
          return { applied: false, reason: "not_pending" };
        }
        const targets = getGuardTargets(cardState2, gameState, playerKey);
        const allowed = targets.some((t) => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: "invalid_target" };
        removeMarkersAt(cardState2, row, col, {
          kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone",
          type: "GUARD",
          owner: playerKey
        });
        addMarker(cardState2, "specialStone", row, col, playerKey, {
          type: "GUARD",
          remainingOwnerTurns: 3
        });
        cardState2.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col };
      }
      __name(applyGuardWill, "applyGuardWill");
      function applyTimeBombWill(cardState2, gameState, playerKey, row, col) {
        const pending = cardState2.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== "TIME_BOMB" || pending.stage !== "selectTarget") {
          return { applied: false, reason: "not_pending" };
        }
        const targets = getTimeBombTargets(cardState2, gameState, playerKey);
        const allowed = targets.some((t) => t.row === row && t.col === col);
        if (!allowed) return { applied: false, reason: "invalid_target" };
        removeMarkersAt(cardState2, row, col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone" });
        const existingBomb = findBombMarkerAt(cardState2, row, col);
        if (existingBomb) return { applied: false, reason: "exists" };
        addMarker(cardState2, "bomb", row, col, playerKey, {
          remainingTurns: TIME_BOMB_TURNS,
          placedTurn: cardState2.turnIndex
        });
        cardState2.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, row, col };
      }
      __name(applyTimeBombWill, "applyTimeBombWill");
      function getStrongWindTargets(cardState2, gameState) {
        if (CardSelectorsModule && typeof CardSelectorsModule.getStrongWindTargets === "function") {
          return CardSelectorsModule.getStrongWindTargets(cardState2, gameState);
        }
        const res = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (gameState.board[r][c] === EMPTY) continue;
            const hasMove = r > 0 && gameState.board[r - 1][c] === EMPTY || r < 7 && gameState.board[r + 1][c] === EMPTY || c > 0 && gameState.board[r][c - 1] === EMPTY || c < 7 && gameState.board[r][c + 1] === EMPTY;
            if (hasMove) res.push({ row: r, col: c });
          }
        }
        return res;
      }
      __name(getStrongWindTargets, "getStrongWindTargets");
      function _getStrongWindMoveOptions(gameState, row, col) {
        const dirs = [
          { dr: -1, dc: 0 },
          { dr: 1, dc: 0 },
          { dr: 0, dc: -1 },
          { dr: 0, dc: 1 }
        ];
        const options = [];
        for (const d of dirs) {
          const nr = row + d.dr;
          const nc = col + d.dc;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
          if (gameState.board[nr][nc] !== EMPTY) continue;
          let tr = nr;
          let tc = nc;
          while (true) {
            const rr = tr + d.dr;
            const cc = tc + d.dc;
            if (rr < 0 || rr >= 8 || cc < 0 || cc >= 8) break;
            if (gameState.board[rr][cc] !== EMPTY) break;
            tr = rr;
            tc = cc;
          }
          const distance = Math.abs(tr - row) + Math.abs(tc - col);
          options.push({ direction: d, target: { row: tr, col: tc }, distance });
        }
        return options;
      }
      __name(_getStrongWindMoveOptions, "_getStrongWindMoveOptions");
      function _moveMarkersForStrongWind(cardState2, fromRow, fromCol, toRow, toCol) {
        const markers = getMarkers(cardState2);
        for (const m of markers) {
          if (!m) continue;
          if (m.row !== fromRow || m.col !== fromCol) continue;
          m.row = toRow;
          m.col = toCol;
        }
      }
      __name(_moveMarkersForStrongWind, "_moveMarkersForStrongWind");
      function applyStrongWindWill(cardState2, gameState, playerKey, row, col, prng) {
        const pending = cardState2.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== "STRONG_WIND_WILL" || pending.stage !== "selectTarget") {
          return { applied: false, reason: "not_pending" };
        }
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return { applied: false, reason: "out_of_board" };
        if (gameState.board[row][col] === EMPTY) return { applied: false, reason: "empty" };
        const options = _getStrongWindMoveOptions(gameState, row, col);
        if (!options.length) return { applied: false, reason: "no_move_options" };
        const maxDistance = options.reduce((m, o) => Math.max(m, Number(o && o.distance) || 0), 0);
        const bestOptions = options.filter((o) => (Number(o && o.distance) || 0) === maxDistance);
        const p = prng && typeof prng.random === "function" ? prng : { random: Math.random };
        const pick = bestOptions[Math.floor(p.random() * bestOptions.length)];
        const to = pick.target;
        const movedDistance = Math.abs(to.row - row) + Math.abs(to.col - col);
        _moveMarkersForStrongWind(cardState2, row, col, to.row, to.col);
        if (BoardOpsModule && typeof BoardOpsModule.moveAt === "function") {
          const res = BoardOpsModule.moveAt(cardState2, gameState, row, col, to.row, to.col, "STRONG_WIND_WILL", "strong_wind_move");
          if (!res || !res.moved) {
            return { applied: false, reason: "move_failed" };
          }
        } else {
          const val = gameState.board[row][col];
          gameState.board[row][col] = EMPTY;
          gameState.board[to.row][to.col] = val;
        }
        if (!cardState2.chargeGainedTotal) cardState2.chargeGainedTotal = { black: 0, white: 0 };
        const gainRes = addChargeValue(cardState2, playerKey, movedDistance, "strong_wind_move_distance");
        const gained = Number(gainRes && gainRes.delta) || 0;
        if (gained > 0) {
          cardState2.chargeGainedTotal[playerKey] = (cardState2.chargeGainedTotal[playerKey] || 0) + gained;
        }
        cardState2.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, from: { row, col }, to, direction: pick.direction, movedDistance, chargeGained: gained };
      }
      __name(applyStrongWindWill, "applyStrongWindWill");
      function onTurnStart(cardState2, playerKey, gameState, prng) {
        const p = prng || defaultPrng;
        cardState2.turnCountByPlayer[playerKey]++;
        cardState2.turnIndex++;
        cardState2.lastTurnStartedFor = playerKey;
        if (!cardState2.breedingSproutByOwner || typeof cardState2.breedingSproutByOwner !== "object") {
          cardState2.breedingSproutByOwner = { black: [], white: [] };
        }
        if (!Array.isArray(cardState2.breedingSproutByOwner.black)) cardState2.breedingSproutByOwner.black = [];
        if (!Array.isArray(cardState2.breedingSproutByOwner.white)) cardState2.breedingSproutByOwner.white = [];
        if (!cardState2._breedingSproutClearedTokenByOwner || typeof cardState2._breedingSproutClearedTokenByOwner !== "object") {
          cardState2._breedingSproutClearedTokenByOwner = { black: null, white: null };
        }
        const breedingSproutToken = `${playerKey}:${Number.isFinite(cardState2.turnIndex) ? cardState2.turnIndex : 0}`;
        if (cardState2._breedingSproutClearedTokenByOwner[playerKey] !== breedingSproutToken) {
          cardState2._breedingSproutClearedTokenByOwner[playerKey] = breedingSproutToken;
          cardState2.breedingSproutByOwner[playerKey] = [];
        }
        cardState2.hasUsedCardThisTurnByPlayer[playerKey] = false;
        cardState2.extraPlaceRemainingByPlayer[playerKey] = 0;
        if (cardState2.debugNoDraw !== true && cardState2.turnCountByPlayer[playerKey] % DRAW_INTERVAL === 0) {
          commitDraw(cardState2, playerKey, p);
        }
        const specialMarkers = getSpecialMarkers(cardState2);
        for (const m of specialMarkers) {
          const data = m.data || {};
          if (data.expiresForPlayer === playerKey) {
            if (data.type === "GOLD" || data.type === "SILVER") {
              if (BoardOpsModule && typeof BoardOpsModule.destroyAt === "function") {
                BoardOpsModule.destroyAt(cardState2, gameState, m.row, m.col, "SYSTEM", "gold_silver_expired");
              } else {
                if (gameState && gameState.board) gameState.board[m.row][m.col] = EMPTY;
                removeMarkersAt(cardState2, m.row, m.col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone", type: data.type, owner: m.owner });
              }
            } else {
              removeMarkersAt(cardState2, m.row, m.col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone", type: data.type, owner: m.owner });
            }
            continue;
          }
          if (typeof data.remainingOwnerTurns === "number" && data.remainingOwnerTurns <= 0) {
            removeMarkersAt(cardState2, m.row, m.col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone", type: data.type, owner: m.owner });
            continue;
          }
          if (data.type === "REGEN" && (data.regenRemaining || 0) <= 0) {
            removeMarkersAt(cardState2, m.row, m.col, { kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone", type: data.type, owner: m.owner });
          }
          if (data.type === "GUARD" && m.owner === playerKey && typeof data.remainingOwnerTurns === "number") {
            data.remainingOwnerTurns -= 1;
            if (data.remainingOwnerTurns <= 0) {
              removeMarkersAt(cardState2, m.row, m.col, {
                kind: MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone",
                type: "GUARD",
                owner: m.owner
              });
            }
          }
        }
        let workMod;
        if (typeof __require === "function") {
          try {
            workMod = require_work_will();
          } catch (e) {
          }
        } else if (typeof globalThis !== "undefined" && globalThis.CardWork) {
          workMod = globalThis.CardWork;
        }
        if (workMod && typeof workMod.processWorkEffects === "function") {
          try {
            const res = workMod.processWorkEffects(cardState2, gameState, playerKey);
            if (!cardState2.presentationEvents) cardState2.presentationEvents = [];
            if (res.gained && res.gained > 0) {
              emitPresentationEvent(cardState2, { type: "WORK_INCOME", player: playerKey, gained: res.gained, removed: !!res.removed, meta: {} });
            } else if (res.removed) {
              emitPresentationEvent(cardState2, { type: "WORK_REMOVED", player: playerKey, removed: true, meta: {} });
            }
          } catch (e) {
          }
        }
      }
      __name(onTurnStart, "onTurnStart");
      function addChargeWithTotal(cardState2, playerKey, amount) {
        if (!cardState2 || !amount) return 0;
        if (!cardState2.charge) cardState2.charge = { black: 0, white: 0 };
        if (!cardState2.chargeGainedTotal) cardState2.chargeGainedTotal = { black: 0, white: 0 };
        const deltaRes = addChargeValue(cardState2, playerKey, amount, "placement_or_effect_gain");
        const added = Number(deltaRes.delta) || 0;
        if (added > 0) {
          cardState2.chargeGainedTotal[playerKey] = (cardState2.chargeGainedTotal[playerKey] || 0) + added;
        }
        return added;
      }
      __name(addChargeWithTotal, "addChargeWithTotal");
      function applyPlacementEffects(cardState2, gameState, playerKey, row, col, flipCount) {
        const effects = { chargeGained: 0 };
        const pending = cardState2.pendingEffectByPlayer[playerKey];
        if (pending && pending.type === "FREE_PLACEMENT") {
          effects.freePlacementUsed = true;
        }
        const opponentKey = playerKey === "black" ? "white" : "black";
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const ownerVal = playerKey === "black" ? P_BLACK : P_WHITE;
        const opponentVal = -ownerVal;
        let chargeGain = flipCount;
        if (pending && pending.type === "GOLD_STONE") {
          chargeGain = flipCount * 4;
          effects.goldStoneUsed = true;
          if (BoardOpsModule && typeof BoardOpsModule.destroyAt === "function") {
            BoardOpsModule.destroyAt(cardState2, gameState, row, col, "SYSTEM", "gold_stone_sacrifice");
          } else {
            gameState.board[row][col] = EMPTY;
          }
        }
        if (pending && pending.type === "SILVER_STONE") {
          chargeGain = flipCount * 3;
          effects.silverStoneUsed = true;
          if (BoardOpsModule && typeof BoardOpsModule.destroyAt === "function") {
            BoardOpsModule.destroyAt(cardState2, gameState, row, col, "SYSTEM", "silver_stone_sacrifice");
          } else {
            gameState.board[row][col] = EMPTY;
          }
        }
        if (pending && pending.type === "PLUNDER_WILL") {
          let plunderEffect;
          if (typeof module === "object" && module.exports) {
            try {
              plunderEffect = __require("./effects/plunder_will").applyPlunderWill;
            } catch (e) {
            }
          }
          if (typeof plunderEffect === "function") {
            const res = plunderEffect(cardState2, playerKey, flipCount);
            chargeGain += res.plundered || 0;
            effects.plunderAmount = res.plundered || 0;
          } else {
            const stolen = Math.min(flipCount, cardState2.charge[opponentKey]);
            addChargeValue(cardState2, opponentKey, -stolen, "plunder_loss");
            chargeGain += stolen;
            effects.plunderAmount = stolen;
          }
        }
        if (pending && pending.type === "STEAL_CARD") {
          let stealEffect;
          if (typeof module === "object" && module.exports) {
            try {
              stealEffect = __require("./effects/steal_card").applyStealCard;
            } catch (e) {
            }
          }
          if (typeof stealEffect === "function") {
            const res = stealEffect(cardState2, playerKey, flipCount);
            if (res && res.stolenCount > 0) {
              effects.stolenCount = res.stolenCount;
              effects.stolenCards = res.stolenCards;
            }
            if (res && res.resaleGain > 0) {
              chargeGain += res.resaleGain;
              effects.resaleGain = res.resaleGain;
            }
          } else {
            const totalSteal = Math.min(
              flipCount,
              cardState2.hands[opponentKey].length
            );
            if (totalSteal > 0) {
              const stolenCards = cardState2.hands[opponentKey].splice(0, totalSteal);
              if (!Array.isArray(cardState2.discard)) cardState2.discard = [];
              cardState2.discard.push(...stolenCards);
              const resaleGain = totalSteal * 2;
              chargeGain += resaleGain;
              effects.stolenCards = stolenCards;
              effects.stolenCount = totalSteal;
              effects.resaleGain = resaleGain;
            }
          }
        }
        addChargeWithTotal(cardState2, playerKey, chargeGain);
        effects.chargeGained = chargeGain;
        if (pending && pending.type === "PROTECTED_NEXT_STONE") {
          let mod;
          if (typeof module === "object" && module.exports) {
            try {
              mod = __require("./effects/protected_next_stone");
            } catch (e) {
            }
          }
          if (mod && typeof mod.applyProtectedNextStone === "function") {
            const r = mod.applyProtectedNextStone(cardState2, playerKey, row, col);
            if (r.applied) effects.protected = true;
          } else {
            addMarker(cardState2, "specialStone", row, col, playerKey, {
              type: "PROTECTED",
              expiresForPlayer: playerKey
            });
            effects.protected = true;
          }
        }
        if (pending && pending.type === "PERMA_PROTECT_NEXT_STONE") {
          let mod;
          if (typeof module === "object" && module.exports) {
            try {
              mod = __require("./effects/perma_protect_next_stone");
            } catch (e) {
            }
          }
          if (mod && typeof mod.applyPermaProtectNextStone === "function") {
            const r = mod.applyPermaProtectNextStone(cardState2, playerKey, row, col);
            if (r.applied) effects.permaProtected = true;
          } else {
            applyStrongWill(cardState2, playerKey, row, col);
            effects.permaProtected = true;
          }
        }
        if (pending && pending.type === "REGEN_WILL") {
          applyRegenWill(cardState2, playerKey, row, col);
          effects.regenPlaced = true;
        }
        try {
          workDebugLog(cardState2, "[WORK_DEBUG] workNextPlacementArmedByPlayer state:", cardState2.workNextPlacementArmedByPlayer, "playerKey:", playerKey, "row:", row, "col:", col);
          if (cardState2.workNextPlacementArmedByPlayer && cardState2.workNextPlacementArmedByPlayer[playerKey]) {
            let workMod;
            if (typeof __require === "function") {
              try {
                workMod = require_work_will();
              } catch (e) {
              }
            } else if (typeof globalThis !== "undefined" && globalThis.CardWork) {
              workMod = globalThis.CardWork;
            }
            try {
              if (workMod && typeof workMod.placeWorkStone === "function") {
                workDebugLog(cardState2, "[WORK_DEBUG] Calling placeWorkStone for", playerKey, row, col);
                workMod.placeWorkStone(cardState2, gameState, playerKey, row, col, { addMarker });
                effects.workPlaced = true;
                try {
                  if (typeof globalThis !== "undefined") globalThis._lastWorkPlaced = { playerKey, row, col };
                  else if (typeof global !== "undefined") global._lastWorkPlaced = { playerKey, row, col };
                } catch (e) {
                }
              } else {
                workDebugLog(cardState2, "[WORK_DEBUG] workMod.placeWorkStone not available, workMod:", !!workMod);
              }
            } catch (e) {
              workDebugError(cardState2, "[WORK_DEBUG] placeWorkStone threw", e && e.message ? e.message : e);
            }
            cardState2.workNextPlacementArmedByPlayer[playerKey] = false;
          }
        } catch (e) {
        }
        if (pending && pending.type === "ULTIMATE_REVERSE_DRAGON") {
          let mod;
          if (typeof module === "object" && module.exports) {
            try {
              mod = __require("./effects/ultimate_reverse_dragon");
            } catch (e) {
            }
          }
          if (mod && typeof mod.applyUltimateDragon === "function") {
            const r = mod.applyUltimateDragon(cardState2, playerKey, row, col);
            if (r.placed) effects.dragonPlaced = true;
          } else {
            addMarker(cardState2, "specialStone", row, col, playerKey, {
              type: "DRAGON",
              remainingOwnerTurns: ULTIMATE_DRAGON_TURNS
            });
            effects.dragonPlaced = true;
          }
        }
        if (pending && pending.type === "BREEDING_WILL") {
          const BREEDING_DURATION = 3;
          addMarker(cardState2, "specialStone", row, col, playerKey, {
            type: "BREEDING",
            remainingOwnerTurns: BREEDING_DURATION
          });
          effects.breedingPlaced = true;
        }
        if (pending && pending.type === "ULTIMATE_DESTROY_GOD") {
          addMarker(cardState2, "specialStone", row, col, playerKey, {
            type: "ULTIMATE_DESTROY_GOD",
            remainingOwnerTurns: ULTIMATE_DESTROY_GOD_TURNS
          });
          effects.ultimateDestroyGodPlaced = true;
        }
        if (pending && pending.type === "HYPERACTIVE_WILL") {
          cardState2.hyperactiveSeqCounter = (cardState2.hyperactiveSeqCounter || 0) + 1;
          addMarker(cardState2, "specialStone", row, col, playerKey, {
            type: "HYPERACTIVE",
            hyperactiveSeq: cardState2.hyperactiveSeqCounter
          });
          effects.hyperactivePlaced = true;
        }
        if (pending && pending.type === "ULTIMATE_HYPERACTIVE_GOD") {
          addMarker(cardState2, "specialStone", row, col, playerKey, {
            type: "ULTIMATE_HYPERACTIVE"
          });
          effects.ultimateHyperactivePlaced = true;
        }
        if (pending && pending.type === "CROSS_BOMB") {
          const targets = [{ row, col }];
          for (const dist of [1, 2]) {
            targets.push(
              { row: row - dist, col },
              { row: row + dist, col },
              { row, col: col - dist },
              { row, col: col + dist }
            );
          }
          const inBoundsTargets = targets.filter((pos) => pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8);
          let destroyedCount = 0;
          for (const pos of inBoundsTargets) {
            if (BoardOpsModule && typeof BoardOpsModule.destroyAt === "function") {
              const res = BoardOpsModule.destroyAt(
                cardState2,
                gameState,
                pos.row,
                pos.col,
                "CROSS_BOMB",
                "cross_bomb_explosion"
              );
              if (res && res.destroyed) destroyedCount++;
            } else if (gameState.board[pos.row][pos.col] !== EMPTY) {
              removeMarkersAt(cardState2, pos.row, pos.col);
              gameState.board[pos.row][pos.col] = EMPTY;
              destroyedCount++;
            }
          }
          effects.crossBombExploded = true;
          effects.crossBombDestroyed = destroyedCount;
        }
        if (pending && pending.type === "DOUBLE_PLACE") {
          let dpEffect;
          if (typeof module === "object" && module.exports) {
            try {
              dpEffect = __require("./effects/double_place").applyDoublePlace;
            } catch (e) {
            }
          }
          if (typeof dpEffect === "function") {
            const res = dpEffect(cardState2, playerKey);
            if (res.activated) effects.doublePlaceActivated = true;
          } else {
            if (!cardState2.extraPlaceRemainingByPlayer) cardState2.extraPlaceRemainingByPlayer = {};
            cardState2.extraPlaceRemainingByPlayer[playerKey] = DOUBLE_PLACE_EXTRA;
            effects.doublePlaceActivated = true;
          }
        }
        cardState2.pendingEffectByPlayer[playerKey] = null;
        return effects;
      }
      __name(applyPlacementEffects, "applyPlacementEffects");
      function isNormalStoneForPlayer(cardState2, gameState, playerKey, row, col) {
        if (CardUtilsModule && typeof CardUtilsModule.isNormalStoneForPlayer === "function") {
          return CardUtilsModule.isNormalStoneForPlayer(cardState2, gameState, playerKey, row, col);
        }
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const playerVal = playerKey === "black" ? P_BLACK : P_WHITE;
        if (gameState.board[row][col] !== playerVal) return false;
        const specials = getSpecialMarkers(cardState2);
        if (specials.some((s) => s.row === row && s.col === col)) return false;
        const bombs = getBombMarkers(cardState2);
        if (bombs.some((b) => b.row === row && b.col === col)) return false;
        return true;
      }
      __name(isNormalStoneForPlayer, "isNormalStoneForPlayer");
      function applyStrongWill(cardState2, playerKey, row, col) {
        const already = getSpecialMarkers(cardState2).some(
          (s) => s.row === row && s.col === col && s.data && s.data.type === "PERMA_PROTECTED"
        );
        if (!already) {
          addMarker(cardState2, "specialStone", row, col, playerKey, {
            type: "PERMA_PROTECTED"
          });
        }
        return { applied: true };
      }
      __name(applyStrongWill, "applyStrongWill");
      function applyRegenWill(cardState2, playerKey, row, col) {
        if (typeof module === "object" && module.exports) {
          const mod = require_regen();
          return mod.applyRegenWill(cardState2, playerKey, row, col, { addMarker, BLACK, WHITE });
        }
        if (typeof CardRegen !== "undefined" && typeof CardRegen.applyRegenWill === "function") {
          return CardRegen.applyRegenWill(cardState2, playerKey, row, col, { addMarker, BLACK, WHITE });
        }
        console.warn("[cards.js] CardRegen.applyRegenWill not available");
        return { applied: false };
      }
      __name(applyRegenWill, "applyRegenWill");
      function applyRegenAfterFlips(cardState2, gameState, flips, flipperKey, skipCapture) {
        if (typeof module === "object" && module.exports) {
          const mod = require_regen();
          return mod.applyRegenAfterFlips(cardState2, gameState, flips, flipperKey, skipCapture, {
            getCardContext,
            clearBombAt,
            removeMarkersAt,
            BoardOps: BoardOpsModule
          });
        }
        if (typeof CardRegen !== "undefined" && typeof CardRegen.applyRegenAfterFlips === "function") {
          return CardRegen.applyRegenAfterFlips(cardState2, gameState, flips, flipperKey, skipCapture, {
            getCardContext,
            clearBombAt,
            removeMarkersAt,
            BoardOps: BoardOpsModule
          });
        }
        console.warn("[cards.js] CardRegen module not available");
        return { regened: [], captureFlips: [] };
      }
      __name(applyRegenAfterFlips, "applyRegenAfterFlips");
      function applySacrificeWill(cardState2, gameState, playerKey, row, col) {
        const pending = cardState2 && cardState2.pendingEffectByPlayer ? cardState2.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== "SACRIFICE_WILL" || pending.stage !== "selectTarget") {
          return { applied: false, reason: "pending_not_found" };
        }
        const ownerVal = playerKey === "black" ? BLACK || 1 : WHITE || -1;
        if (!gameState || !gameState.board || gameState.board[row][col] !== ownerVal) {
          return { applied: false, reason: "\u81EA\u5206\u306E\u77F3\u306E\u307F\u9078\u629E\u3067\u304D\u307E\u3059" };
        }
        const destroyed = destroyAt(cardState2, gameState, row, col);
        if (!destroyed) {
          return { applied: false, reason: "\u7834\u58CA\u306B\u5931\u6557\u3057\u307E\u3057\u305F" };
        }
        const gained = addChargeWithTotal(cardState2, playerKey, 5);
        const selectedCount = Number(pending.selectedCount || 0) + 1;
        const maxSelections = Number(pending.maxSelections || 3);
        pending.selectedCount = selectedCount;
        pending.maxSelections = maxSelections;
        const remainTargets = getSelectableTargets(cardState2, gameState, playerKey);
        const completed = selectedCount >= maxSelections || remainTargets.length === 0;
        if (completed) {
          cardState2.pendingEffectByPlayer[playerKey] = null;
        }
        return { applied: true, gained, selectedCount, maxSelections, completed };
      }
      __name(applySacrificeWill, "applySacrificeWill");
      function applySellCardWill(cardState2, playerKey, soldCardId) {
        const pending = cardState2 && cardState2.pendingEffectByPlayer ? cardState2.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== "SELL_CARD_WILL" || pending.stage !== "selectTarget") {
          return { applied: false, reason: "pending_not_found" };
        }
        if (!soldCardId || !cardState2.hands || !Array.isArray(cardState2.hands[playerKey])) {
          return { applied: false, reason: "invalid_target" };
        }
        const idx = cardState2.hands[playerKey].indexOf(soldCardId);
        if (idx === -1) {
          return { applied: false, reason: "\u624B\u672D\u306B\u306A\u3044\u30AB\u30FC\u30C9\u306F\u58F2\u5374\u3067\u304D\u307E\u305B\u3093" };
        }
        cardState2.hands[playerKey].splice(idx, 1);
        cardState2.discard.push(soldCardId);
        const gainBase = getCardCost(soldCardId);
        const gained = addChargeWithTotal(cardState2, playerKey, gainBase);
        cardState2.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, soldCardId, gained };
      }
      __name(applySellCardWill, "applySellCardWill");
      function applyHeavenBlessingChoice(cardState2, playerKey, selectedCardId) {
        const pending = cardState2 && cardState2.pendingEffectByPlayer ? cardState2.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== "HEAVEN_BLESSING" || pending.stage !== "selectTarget") {
          return { applied: false, reason: "pending_not_found" };
        }
        const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
        if (!offers.length) {
          cardState2.pendingEffectByPlayer[playerKey] = null;
          return { applied: false, reason: "offers_not_found" };
        }
        if (!selectedCardId || !offers.includes(selectedCardId)) {
          return { applied: false, reason: "invalid_target" };
        }
        if (!cardState2.hands || !Array.isArray(cardState2.hands[playerKey])) {
          return { applied: false, reason: "invalid_hand" };
        }
        if (cardState2.hands[playerKey].length >= MAX_HAND_SIZE) {
          return { applied: false, reason: "hand_full" };
        }
        cardState2.hands[playerKey].push(selectedCardId);
        const vanished = offers.filter((id) => id !== selectedCardId);
        cardState2.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, selectedCardId, vanished };
      }
      __name(applyHeavenBlessingChoice, "applyHeavenBlessingChoice");
      function applyCondemnWill(cardState2, playerKey, targetIndex) {
        const pending = cardState2 && cardState2.pendingEffectByPlayer ? cardState2.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== "CONDEMN_WILL" || pending.stage !== "selectTarget") {
          return { applied: false, reason: "pending_not_found" };
        }
        const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
        if (!offers.length) {
          cardState2.pendingEffectByPlayer[playerKey] = null;
          return { applied: false, reason: "offers_not_found" };
        }
        if (!Number.isInteger(targetIndex)) {
          return { applied: false, reason: "invalid_target" };
        }
        const offer = offers.find((o) => o && Number.isInteger(o.handIndex) && o.handIndex === targetIndex);
        if (!offer || !offer.cardId) {
          return { applied: false, reason: "invalid_target" };
        }
        const opponentKey = playerKey === "black" ? "white" : "black";
        const opponentHand = cardState2.hands && Array.isArray(cardState2.hands[opponentKey]) ? cardState2.hands[opponentKey] : null;
        if (!opponentHand) {
          return { applied: false, reason: "invalid_hand" };
        }
        if (targetIndex < 0 || targetIndex >= opponentHand.length) {
          return { applied: false, reason: "invalid_target" };
        }
        if (opponentHand[targetIndex] !== offer.cardId) {
          return { applied: false, reason: "target_mismatch" };
        }
        const destroyedCardId = opponentHand[targetIndex];
        opponentHand.splice(targetIndex, 1);
        cardState2.discard.push(destroyedCardId);
        cardState2.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, destroyedCardId };
      }
      __name(applyCondemnWill, "applyCondemnWill");
      function getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context) {
        if (typeof module === "object" && module.exports) {
          const mod = require_flips();
          return mod.getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context);
        }
        if (typeof CardFlips !== "undefined" && typeof CardFlips.getDirectionalChainFlips === "function") {
          return CardFlips.getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context);
        }
        console.warn("[cards.js] CardFlips.getDirectionalChainFlips not available");
        return [];
      }
      __name(getDirectionalChainFlips, "getDirectionalChainFlips");
      function applyChainWillAfterMove(cardState2, gameState, playerKey, primaryFlips, prng) {
        const pending = cardState2.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== "CHAIN_WILL") {
          return { applied: false, flips: [], chosen: null };
        }
        const ownerVal = playerKey === "black" ? BLACK || 1 : WHITE || -1;
        const context = getCardContext(cardState2);
        const p = prng || defaultPrng;
        function runChainLinks(findChainChoiceFn) {
          const appliedFlips = [];
          const chosenSteps = [];
          let sourceFlips = Array.isArray(primaryFlips) ? primaryFlips.slice() : [];
          for (let i = 0; i < CHAIN_WILL_MAX_LINKS; i++) {
            const res = findChainChoiceFn(gameState, sourceFlips, ownerVal, context, p);
            if (!res || !res.applied || !Array.isArray(res.flips) || res.flips.length === 0) break;
            const chainLink = i + 1;
            for (const pos of res.flips) {
              if (BoardOpsModule && typeof BoardOpsModule.changeAt === "function") {
                BoardOpsModule.changeAt(cardState2, gameState, pos.row, pos.col, playerKey, "CHAIN_WILL", "chain_flip", { chainLink });
              } else {
                gameState.board[pos.row][pos.col] = ownerVal;
              }
              clearBombAt(cardState2, pos.row, pos.col);
            }
            clearHyperactiveAtPositions(cardState2, res.flips);
            appliedFlips.push(...res.flips);
            chosenSteps.push(res.chosen || null);
            sourceFlips = res.flips;
          }
          if (appliedFlips.length === 0) return { applied: false, flips: [], chosen: null, chosenSteps: [] };
          return { applied: true, flips: appliedFlips, chosen: chosenSteps[chosenSteps.length - 1] || null, chosenSteps };
        }
        __name(runChainLinks, "runChainLinks");
        if (typeof module === "object" && module.exports) {
          const mod = require_chain();
          if (mod && typeof mod.findChainChoice === "function") {
            return runChainLinks(mod.findChainChoice);
          }
        }
        if (typeof CardChain !== "undefined" && typeof CardChain.findChainChoice === "function") {
          return runChainLinks(CardChain.findChainChoice);
        }
        console.warn("[cards.js] CardChain module not available");
        return { applied: false, flips: [], chosen: null };
      }
      __name(applyChainWillAfterMove, "applyChainWillAfterMove");
      function tickBombs(cardState2, gameState, playerKey) {
        if (typeof module === "object" && module.exports) {
          const mod = require_time_bomb();
          return mod.tickBombs(cardState2, gameState, playerKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        if (typeof CardTimeBomb !== "undefined" && typeof CardTimeBomb.tickBombs === "function") {
          return CardTimeBomb.tickBombs(cardState2, gameState, playerKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        console.warn("[cards.js] CardTimeBomb module not available");
        return { exploded: [], destroyed: [] };
      }
      __name(tickBombs, "tickBombs");
      function tickBombAt(cardState2, gameState, bomb, activeKey) {
        if (!bomb) return { exploded: [], destroyed: [], removed: false };
        if (typeof module === "object" && module.exports) {
          try {
            const mod = require_time_bomb();
            if (mod && typeof mod.tickBombAt === "function") return mod.tickBombAt(cardState2, gameState, bomb, activeKey, { BoardOps: BoardOpsModule, destroyAt });
          } catch (e) {
          }
        }
        if (typeof CardTimeBomb !== "undefined" && typeof CardTimeBomb.tickBombAt === "function") {
          return CardTimeBomb.tickBombAt(cardState2, gameState, bomb, activeKey, { BoardOps: BoardOpsModule, destroyAt });
        }
        const bombs = getBombMarkers(cardState2);
        const idx = bombs.findIndex((b2) => bomb.id && b2.id === bomb.id || b2.row === bomb.row && b2.col === bomb.col && b2.owner === bomb.owner && b2.createdSeq === bomb.createdSeq);
        if (idx === -1) return { exploded: [], destroyed: [], removed: false };
        const b = bombs[idx];
        if (activeKey && b.owner !== activeKey) return { exploded: [], destroyed: [], removed: false };
        if (b.data && b.data.placedTurn === cardState2.turnIndex) return { exploded: [], destroyed: [], removed: false };
        if (!b.data) b.data = {};
        b.data.remainingTurns = typeof b.data.remainingTurns === "number" ? b.data.remainingTurns - 1 : -1;
        if (b.data.remainingTurns <= 0) {
          const exploded = [{ row: b.row, col: b.col }];
          const destroyed = [];
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const r = b.row + dr;
              const c = b.col + dc;
              if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                let destroyedRes = false;
                if (BoardOpsModule && typeof BoardOpsModule.destroyAt === "function") {
                  const res = BoardOpsModule.destroyAt(cardState2, gameState, r, c, "TIME_BOMB", "bomb_explosion");
                  destroyedRes = !!(res && res.destroyed);
                } else {
                  destroyedRes = destroyAt(cardState2, gameState, r, c);
                }
                if (destroyedRes) destroyed.push({ row: r, col: c });
              }
            }
          }
          if (typeof removeMarkerById === "function" && b.id !== void 0) {
            removeMarkerById(cardState2, b.id);
          } else {
            removeMarkersAt(cardState2, b.row, b.col, { kind: MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb", owner: b.owner });
          }
          return { exploded, destroyed, removed: true };
        }
        return { exploded: [], destroyed: [], removed: false };
      }
      __name(tickBombAt, "tickBombAt");
      function processDragonEffects(cardState2, gameState, playerKey) {
        if (typeof module === "object" && module.exports) {
          const mod = require_dragon();
          return mod.processDragonEffects(cardState2, gameState, playerKey, { BoardOps: BoardOpsModule });
        }
        if (typeof DragonEffects !== "undefined" && typeof DragonEffects.processDragonEffects === "function") {
          return DragonEffects.processDragonEffects(cardState2, gameState, playerKey, { BoardOps: BoardOpsModule });
        }
        console.warn("[cards.js] DragonEffects module not available");
        return { converted: [], destroyed: [], anchors: [] };
      }
      __name(processDragonEffects, "processDragonEffects");
      function processDragonEffectsAtAnchor(cardState2, gameState, playerKey, row, col) {
        if (typeof module === "object" && module.exports) {
          const mod = require_dragon();
          return mod.processDragonEffectsAtAnchor(cardState2, gameState, playerKey, row, col, { BoardOps: BoardOpsModule });
        }
        if (typeof DragonEffects !== "undefined" && typeof DragonEffects.processDragonEffectsAtAnchor === "function") {
          return DragonEffects.processDragonEffectsAtAnchor(cardState2, gameState, playerKey, row, col, { BoardOps: BoardOpsModule });
        }
        console.warn("[cards.js] DragonEffects module not available");
        return { converted: [], destroyed: [] };
      }
      __name(processDragonEffectsAtAnchor, "processDragonEffectsAtAnchor");
      function processDragonEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col) {
        if (typeof module === "object" && module.exports) {
          try {
            const mod = require_dragon();
            if (mod && typeof mod.processDragonEffectsAtTurnStartAnchor === "function") {
              return mod.processDragonEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, { BoardOps: BoardOpsModule });
            }
          } catch (e) {
          }
        }
        if (typeof DragonEffects !== "undefined" && typeof DragonEffects.processDragonEffectsAtTurnStartAnchor === "function") {
          return DragonEffects.processDragonEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, { BoardOps: BoardOpsModule });
        }
        console.warn("[cards.js] DragonEffects turn-start anchor processor not available");
        return { converted: [], destroyed: [], anchors: [] };
      }
      __name(processDragonEffectsAtTurnStartAnchor, "processDragonEffectsAtTurnStartAnchor");
      function processUltimateDestroyGodEffects(cardState2, gameState, playerKey) {
        if (typeof module === "object" && module.exports) {
          const mod = require_udg();
          return mod.processUltimateDestroyGodEffects(cardState2, gameState, playerKey, { destroyAt, BoardOps: BoardOpsModule });
        }
        if (typeof CardUdG !== "undefined" && typeof CardUdG.processUltimateDestroyGodEffects === "function") {
          return CardUdG.processUltimateDestroyGodEffects(cardState2, gameState, playerKey, { destroyAt, BoardOps: BoardOpsModule });
        }
        console.warn("[cards.js] CardUdG module not available");
        return { destroyed: [], anchors: [], expired: [] };
      }
      __name(processUltimateDestroyGodEffects, "processUltimateDestroyGodEffects");
      function processUltimateDestroyGodEffectsAtAnchor(cardState2, gameState, playerKey, row, col, opts = {}) {
        const deps = Object.assign({ destroyAt, BoardOps: BoardOpsModule }, opts);
        if (typeof module === "object" && module.exports) {
          const mod = require_udg();
          return mod.processUltimateDestroyGodEffectsAtAnchor(cardState2, gameState, playerKey, row, col, deps);
        }
        if (typeof CardUdG !== "undefined" && typeof CardUdG.processUltimateDestroyGodEffectsAtAnchor === "function") {
          return CardUdG.processUltimateDestroyGodEffectsAtAnchor(cardState2, gameState, playerKey, row, col, deps);
        }
        console.warn("[cards.js] CardUdG module not available");
        return { destroyed: [] };
      }
      __name(processUltimateDestroyGodEffectsAtAnchor, "processUltimateDestroyGodEffectsAtAnchor");
      function processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col) {
        if (typeof module === "object" && module.exports) {
          try {
            const mod = require_udg();
            if (mod && typeof mod.processUltimateDestroyGodEffectsAtTurnStartAnchor === "function") {
              return mod.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, { destroyAt, BoardOps: BoardOpsModule });
            }
          } catch (e) {
          }
        }
        if (typeof CardUdG !== "undefined" && typeof CardUdG.processUltimateDestroyGodEffectsAtTurnStartAnchor === "function") {
          return CardUdG.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, { destroyAt, BoardOps: BoardOpsModule });
        }
        console.warn("[cards.js] CardUdG turn-start anchor processor not available");
        return { destroyed: [] };
      }
      __name(processUltimateDestroyGodEffectsAtTurnStartAnchor, "processUltimateDestroyGodEffectsAtTurnStartAnchor");
      function getFlipsWithContextLocal(state, row, col, player, context = {}) {
        if (typeof module === "object" && module.exports) {
          const mod = require_flips();
          return mod.getFlipsWithContext(state, row, col, player, context);
        }
        if (typeof CardFlips !== "undefined" && typeof CardFlips.getFlipsWithContext === "function") {
          return CardFlips.getFlipsWithContext(state, row, col, player, context);
        }
        console.warn("[cards.js] CardFlips module not available");
        return [];
      }
      __name(getFlipsWithContextLocal, "getFlipsWithContextLocal");
      function clearHyperactiveAtPositions(cardState2, positions) {
        const removeSet = new Set(positions.map((p) => `${p.row},${p.col}`));
        if (!cardState2 || !Array.isArray(cardState2.markers)) return;
        cardState2.markers = cardState2.markers.filter((m) => {
          if (m.kind !== (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone")) return true;
          if (!m.data || m.data.type !== "HYPERACTIVE" && m.data.type !== "ULTIMATE_HYPERACTIVE") return true;
          return !removeSet.has(`${m.row},${m.col}`);
        });
      }
      __name(clearHyperactiveAtPositions, "clearHyperactiveAtPositions");
      function moveHyperactiveOnce(cardState2, gameState, entry, prng) {
        if (typeof module === "object" && module.exports) {
          const mod = require_hyperactive();
          return mod.moveHyperactiveOnce(cardState2, gameState, entry, prng, {
            defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearHyperactiveAtPositions,
            clearBombAt,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        if (typeof CardHyperactive !== "undefined" && typeof CardHyperactive.moveHyperactiveOnce === "function") {
          return CardHyperactive.moveHyperactiveOnce(cardState2, gameState, entry, prng, {
            defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearHyperactiveAtPositions,
            clearBombAt,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        console.warn("[cards.js] CardHyperactive module not available");
        return { moved: [], destroyed: [], flipped: [], ownerKey: entry ? entry.owner : "black" };
      }
      __name(moveHyperactiveOnce, "moveHyperactiveOnce");
      function processHyperactiveMoves(cardState2, gameState, prng) {
        if (typeof module === "object" && module.exports) {
          const mod = require_hyperactive();
          return mod.processHyperactiveMoves(cardState2, gameState, prng, {
            defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        if (typeof CardHyperactive !== "undefined" && typeof CardHyperactive.processHyperactiveMoves === "function") {
          return CardHyperactive.processHyperactiveMoves(cardState2, gameState, prng, {
            defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        console.warn("[cards.js] CardHyperactive module not available");
        return { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } };
      }
      __name(processHyperactiveMoves, "processHyperactiveMoves");
      function processHyperactiveMoveAtAnchor(cardState2, gameState, playerKey, row, col, prng) {
        if (typeof module === "object" && module.exports) {
          const mod = require_hyperactive();
          return mod.processHyperactiveMoveAtAnchor(cardState2, gameState, playerKey, row, col, prng, {
            defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        if (typeof CardHyperactive !== "undefined" && typeof CardHyperactive.processHyperactiveMoveAtAnchor === "function") {
          return CardHyperactive.processHyperactiveMoveAtAnchor(cardState2, gameState, playerKey, row, col, prng, {
            defaultPrng,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        console.warn("[cards.js] CardHyperactive module not available");
        return { moved: [], destroyed: [], flipped: [] };
      }
      __name(processHyperactiveMoveAtAnchor, "processHyperactiveMoveAtAnchor");
      function processUltimateHyperactiveMoveAtAnchor(cardState2, gameState, playerKey, row, col, prng) {
        if (typeof module === "object" && module.exports) {
          const mod = require_hyperactive();
          return mod.processUltimateHyperactiveMoveAtAnchor(cardState2, gameState, playerKey, row, col, prng, {
            defaultPrng,
            clearUltimateAtPositions: clearHyperactiveAtPositions,
            clearHyperactiveAtPositions,
            clearBombAt,
            getFlipsWithContext: getFlipsWithContextLocal,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        if (typeof CardHyperactive !== "undefined" && typeof CardHyperactive.processUltimateHyperactiveMoveAtAnchor === "function") {
          return CardHyperactive.processUltimateHyperactiveMoveAtAnchor(cardState2, gameState, playerKey, row, col, prng, {
            defaultPrng,
            clearUltimateAtPositions: clearHyperactiveAtPositions,
            clearHyperactiveAtPositions,
            clearBombAt,
            getFlipsWithContext: getFlipsWithContextLocal,
            getCardContext,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        console.warn("[cards.js] CardHyperactive ultimate module not available");
        return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey };
      }
      __name(processUltimateHyperactiveMoveAtAnchor, "processUltimateHyperactiveMoveAtAnchor");
      function processBreedingEffects(cardState2, gameState, playerKey, prng) {
        if (typeof module === "object" && module.exports) {
          const mod = require_breeding();
          return mod.processBreedingEffects(cardState2, gameState, playerKey, prng, {
            defaultPrng,
            getCardContext,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        if (typeof CardBreeding !== "undefined" && typeof CardBreeding.processBreedingEffects === "function") {
          return CardBreeding.processBreedingEffects(cardState2, gameState, playerKey, prng, {
            defaultPrng,
            getCardContext,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        console.warn("[cards.js] CardBreeding module not available");
        return { spawned: [], destroyed: [], flipped: [], anchors: [] };
      }
      __name(processBreedingEffects, "processBreedingEffects");
      function processBreedingEffectsAtAnchor(cardState2, gameState, playerKey, row, col, prng) {
        if (typeof module === "object" && module.exports) {
          const mod = require_breeding();
          return mod.processBreedingEffectsAtAnchor(cardState2, gameState, playerKey, row, col, prng, {
            defaultPrng,
            getCardContext,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        if (typeof CardBreeding !== "undefined" && typeof CardBreeding.processBreedingEffectsAtAnchor === "function") {
          return CardBreeding.processBreedingEffectsAtAnchor(cardState2, gameState, playerKey, row, col, prng, {
            defaultPrng,
            getCardContext,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        console.warn("[cards.js] CardBreeding module not available");
        return { spawned: [], destroyed: [], flipped: [] };
      }
      __name(processBreedingEffectsAtAnchor, "processBreedingEffectsAtAnchor");
      function processBreedingEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, prng) {
        if (typeof module === "object" && module.exports) {
          try {
            const mod = require_breeding();
            if (mod && typeof mod.processBreedingEffectsAtTurnStartAnchor === "function") {
              return mod.processBreedingEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, prng, {
                defaultPrng,
                getCardContext,
                getFlipsWithContext: getFlipsWithContextLocal,
                clearBombAt,
                clearHyperactiveAtPositions,
                BoardOps: BoardOpsModule,
                destroyAt
              });
            }
          } catch (e) {
          }
        }
        if (typeof CardBreeding !== "undefined" && typeof CardBreeding.processBreedingEffectsAtTurnStartAnchor === "function") {
          return CardBreeding.processBreedingEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, prng, {
            defaultPrng,
            getCardContext,
            getFlipsWithContext: getFlipsWithContextLocal,
            clearBombAt,
            clearHyperactiveAtPositions,
            BoardOps: BoardOpsModule,
            destroyAt
          });
        }
        console.warn("[cards.js] CardBreeding turn-start anchor processor not available");
        return { spawned: [], destroyed: [], flipped: [], anchors: [] };
      }
      __name(processBreedingEffectsAtTurnStartAnchor, "processBreedingEffectsAtTurnStartAnchor");
      function applyDestroyEffect(cardState2, gameState, playerKey, row, col) {
        if (typeof module === "object" && module.exports) {
          const mod = require_destroy_one_stone();
          const r = mod.applyDestroyOneStone(cardState2, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, destroyAt });
          return !!r.destroyed;
        }
        if (typeof DestroyOneStone !== "undefined" && typeof DestroyOneStone.applyDestroyOneStone === "function") {
          const r = DestroyOneStone.applyDestroyOneStone(cardState2, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, destroyAt });
          return !!r.destroyed;
        }
        console.warn("[cards.js] DestroyOneStone module not available");
        return false;
      }
      __name(applyDestroyEffect, "applyDestroyEffect");
      function applySwapEffect(cardState2, gameState, playerKey, row, col) {
        if (typeof module === "object" && module.exports) {
          const mod = require_swap_with_enemy();
          const r = mod.applySwapWithEnemy(cardState2, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, clearHyperactiveAtPositions });
          return !!r.swapped;
        }
        if (typeof SwapWithEnemy !== "undefined" && typeof SwapWithEnemy.applySwapWithEnemy === "function") {
          const r = SwapWithEnemy.applySwapWithEnemy(cardState2, gameState, playerKey, row, col, { BoardOps: BoardOpsModule, clearHyperactiveAtPositions });
          return !!r.swapped;
        }
        console.warn("[cards.js] SwapWithEnemy module not available");
        return false;
      }
      __name(applySwapEffect, "applySwapEffect");
      function applyPositionSwapWill(cardState2, gameState, playerKey, row, col) {
        const pending = cardState2 && cardState2.pendingEffectByPlayer ? cardState2.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== "POSITION_SWAP_WILL" || pending.stage !== "selectTarget") {
          return { applied: false, reason: "not_pending" };
        }
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return { applied: false, reason: "out_of_board" };
        if (!gameState || !gameState.board || gameState.board[row][col] === EMPTY) return { applied: false, reason: "empty" };
        const first = pending.firstTarget ? { row: pending.firstTarget.row, col: pending.firstTarget.col } : null;
        if (!first) {
          pending.firstTarget = { row, col };
          return { applied: true, completed: false, firstTarget: { row, col } };
        }
        if (first.row === row && first.col === col) {
          return { applied: false, reason: "same_target" };
        }
        if (first.row < 0 || first.row >= 8 || first.col < 0 || first.col >= 8) {
          pending.firstTarget = { row, col };
          return { applied: true, completed: false, firstTarget: { row, col } };
        }
        if (gameState.board[first.row][first.col] === EMPTY) {
          pending.firstTarget = { row, col };
          return { applied: true, completed: false, firstTarget: { row, col } };
        }
        const stoneIdA = cardState2.stoneIdMap && cardState2.stoneIdMap[first.row] ? cardState2.stoneIdMap[first.row][first.col] : null;
        const stoneIdB = cardState2.stoneIdMap && cardState2.stoneIdMap[row] ? cardState2.stoneIdMap[row][col] : null;
        const ownerBeforeA = gameState.board[first.row][first.col] === (BLACK || 1) ? "black" : "white";
        const ownerBeforeB = gameState.board[row][col] === (BLACK || 1) ? "black" : "white";
        const tmp = gameState.board[first.row][first.col];
        gameState.board[first.row][first.col] = gameState.board[row][col];
        gameState.board[row][col] = tmp;
        swapCellCoordinates(cardState2, first, { row, col });
        cardState2.pendingEffectByPlayer[playerKey] = null;
        emitPresentationEvent(cardState2, {
          type: "MOVE",
          stoneId: stoneIdA,
          row,
          col,
          prevRow: first.row,
          prevCol: first.col,
          ownerBefore: ownerBeforeA,
          ownerAfter: ownerBeforeA,
          cause: "POSITION_SWAP_WILL",
          reason: "position_swap"
        });
        emitPresentationEvent(cardState2, {
          type: "MOVE",
          stoneId: stoneIdB,
          row: first.row,
          col: first.col,
          prevRow: row,
          prevCol: col,
          ownerBefore: ownerBeforeB,
          ownerAfter: ownerBeforeB,
          cause: "POSITION_SWAP_WILL",
          reason: "position_swap"
        });
        return { applied: true, completed: true, from: first, to: { row, col } };
      }
      __name(applyPositionSwapWill, "applyPositionSwapWill");
      function getCardContext(cardState2) {
        const specials = getSpecialMarkers(cardState2);
        const protectedStones = specials.filter((s) => s.data && s.data.type === "PROTECTED").map((s) => ({ row: s.row, col: s.col, owner: s.owner }));
        const permaProtectedStones = specials.filter((s) => s.data && (s.data.type === "PERMA_PROTECTED" || s.data.type === "DRAGON" || s.data.type === "BREEDING" || s.data.type === "ULTIMATE_DESTROY_GOD" || s.data.type === "GUARD")).map((s) => ({
          row: s.row,
          col: s.col,
          owner: s.owner === "black" ? BLACK : WHITE
        }));
        const bombs = getBombMarkers(cardState2).map((b) => ({
          row: b.row,
          col: b.col,
          remainingTurns: b.data ? b.data.remainingTurns : void 0,
          owner: b.owner,
          placedTurn: b.data ? b.data.placedTurn : void 0,
          createdSeq: b.createdSeq
        }));
        return {
          protectedStones,
          permaProtectedStones,
          bombs
        };
      }
      __name(getCardContext, "getCardContext");
      function onTurnEnd(cardState2, gameState, playerKey) {
        const pending = cardState2.pendingEffectByPlayer[playerKey];
        if (pending && pending.type === "CHAIN_WILL") {
          cardState2.pendingEffectByPlayer[playerKey] = null;
        }
      }
      __name(onTurnEnd, "onTurnEnd");
      function hasPendingEffect(cardState2, playerKey) {
        return cardState2.pendingEffectByPlayer[playerKey] !== null;
      }
      __name(hasPendingEffect, "hasPendingEffect");
      function allocateStoneId(cardState2) {
        if (!cardState2) return null;
        if (cardState2._nextStoneId === void 0 || cardState2._nextStoneId === null) cardState2._nextStoneId = 1;
        const id = "s" + String(cardState2._nextStoneId++);
        return id;
      }
      __name(allocateStoneId, "allocateStoneId");
      function emitPresentationEvent(cardState2, ev) {
        if (!cardState2) return;
        if (BoardOpsModule && typeof BoardOpsModule.emitPresentationEvent === "function") {
          BoardOpsModule.emitPresentationEvent(cardState2, ev);
          return;
        }
      }
      __name(emitPresentationEvent, "emitPresentationEvent");
      function flushPresentationEvents(cardState2) {
        if (!cardState2 || !cardState2.presentationEvents) return [];
        const out = cardState2.presentationEvents.slice();
        if (!(BoardOpsModule && typeof BoardOpsModule.emitPresentationEvent === "function")) {
          if (!cardState2._presentationEventsPersist) cardState2._presentationEventsPersist = [];
          cardState2._presentationEventsPersist.push(...out);
        }
        cardState2.presentationEvents.length = 0;
        return out;
      }
      __name(flushPresentationEvents, "flushPresentationEvents");
      function getPendingEffectType(cardState2, playerKey) {
        const pending = cardState2.pendingEffectByPlayer[playerKey];
        return pending ? pending.type : null;
      }
      __name(getPendingEffectType, "getPendingEffectType");
      function getSelectableTargets(cardState2, gameState, playerKey) {
        const pending = cardState2 && cardState2.pendingEffectByPlayer ? cardState2.pendingEffectByPlayer[playerKey] : null;
        if (!pending) return [];
        if (typeof __require === "function" || typeof globalThis !== "undefined" && globalThis.CardSelectors) {
          try {
            const mod = typeof __require === "function" ? require_selectors() : globalThis.CardSelectors;
            if (mod) {
              if (pending.type === "DESTROY_ONE_STONE" && typeof mod.getDestroyTargets === "function") {
                return mod.getDestroyTargets(cardState2, gameState);
              }
              if (pending.type === "STRONG_WIND_WILL" && typeof mod.getStrongWindTargets === "function") {
                return mod.getStrongWindTargets(cardState2, gameState);
              }
              if (pending.type === "SACRIFICE_WILL" && typeof mod.getSacrificeTargets === "function") {
                return mod.getSacrificeTargets(cardState2, gameState, playerKey);
              }
              if (pending.type === "SWAP_WITH_ENEMY" && typeof mod.getSwapTargets === "function") {
                return mod.getSwapTargets(cardState2, gameState, playerKey);
              }
              if (pending.type === "POSITION_SWAP_WILL" && typeof mod.getPositionSwapTargets === "function") {
                return mod.getPositionSwapTargets(cardState2, gameState, playerKey, pending);
              }
              if (pending.type === "TRAP_WILL" && typeof mod.getTrapTargets === "function") {
                return mod.getTrapTargets(cardState2, gameState, playerKey);
              }
              if (pending.type === "GUARD_WILL" && typeof mod.getGuardTargets === "function") {
                return mod.getGuardTargets(cardState2, gameState, playerKey);
              }
              if (pending.type === "TIME_BOMB" && typeof mod.getTimeBombTargets === "function") {
                return mod.getTimeBombTargets(cardState2, gameState, playerKey);
              }
            }
          } catch (e) {
          }
        }
        const playerVal = playerKey === "black" ? BLACK || 1 : WHITE || -1;
        const opponentVal = -playerVal;
        const res = [];
        if (pending.type === "DESTROY_ONE_STONE") {
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              if (gameState.board[r][c] !== EMPTY) {
                res.push({ row: r, col: c });
              }
            }
          }
          return res;
        }
        if (pending.type === "SACRIFICE_WILL") {
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              if (gameState.board[r][c] === playerVal) {
                res.push({ row: r, col: c });
              }
            }
          }
          return res;
        }
        if (pending.type === "STRONG_WIND_WILL") {
          return getStrongWindTargets(cardState2, gameState);
        }
        if (pending.type === "SWAP_WITH_ENEMY") {
          const markers = cardState2 && Array.isArray(cardState2.markers) ? cardState2.markers : [];
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              if (gameState.board[r][c] !== opponentVal) continue;
              const hasSpecialOrBomb = markers.some((m) => m.row === r && m.col === c && (m.kind === "specialStone" || m.kind === "bomb"));
              if (hasSpecialOrBomb) continue;
              res.push({ row: r, col: c });
            }
          }
          return res;
        }
        if (pending.type === "POSITION_SWAP_WILL") {
          const first = pending.firstTarget ? { row: pending.firstTarget.row, col: pending.firstTarget.col } : null;
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              if (gameState.board[r][c] === EMPTY) continue;
              if (first && first.row === r && first.col === c) continue;
              res.push({ row: r, col: c });
            }
          }
          return res;
        }
        if (pending.type === "TEMPT_WILL") {
          return getTemptWillTargets(cardState2, gameState, playerKey);
        }
        if (pending.type === "TRAP_WILL") {
          return getTrapTargets(cardState2, gameState, playerKey);
        }
        if (pending.type === "GUARD_WILL") {
          return getGuardTargets(cardState2, gameState, playerKey);
        }
        if (pending.type === "TIME_BOMB") {
          return getTimeBombTargets(cardState2, gameState, playerKey);
        }
        return res;
      }
      __name(getSelectableTargets, "getSelectableTargets");
      return {
        // Constants
        INITIAL_HAND_SIZE,
        TIME_BOMB_TURNS,
        ULTIMATE_DRAGON_TURNS,
        ULTIMATE_DESTROY_GOD_TURNS,
        // State factories
        createCardState,
        copyCardState,
        dealInitialHands,
        initGame,
        addMarker,
        removeMarkerById,
        // Core operations
        commitDraw,
        getCardDef,
        getCardType,
        getCardDisplayName,
        getCardCodeName,
        getCardCost,
        canUseCard,
        getUsableCardIds,
        hasUsableCard,
        applyCardUsage,
        destroyAt,
        clearBombAt,
        processBreedingEffects,
        processUltimateDestroyGodEffects,
        processUltimateDestroyGodEffectsAtAnchor,
        // Game flow
        onTurnStart,
        onTurnEnd,
        applyPlacementEffects,
        tickBombs,
        tickBombAt,
        processDragonEffects,
        processDragonEffectsAtTurnStartAnchor,
        processDragonEffectsAtAnchor,
        applyDestroyEffect,
        applySwapEffect,
        applyPositionSwapWill,
        applyStrongWill,
        applySacrificeWill,
        applySellCardWill,
        applyHeavenBlessingChoice,
        applyCondemnWill,
        applyTemptWill,
        applyGuardWill,
        applyTimeBombWill,
        applyStrongWindWill,
        applyRegenWill,
        applyRegenAfterFlips,
        applyChainWillAfterMove,
        processBreedingEffectsAtTurnStartAnchor,
        processBreedingEffectsAtAnchor,
        processUltimateDestroyGodEffectsAtTurnStartAnchor,
        processUltimateDestroyGodEffectsAtAnchor,
        // Helpers
        getCardContext,
        hasPendingEffect,
        getPendingEffectType,
        getSelectableTargets,
        getStrongWindTargets,
        cancelPendingSelection,
        getTemptWillTargets,
        getGuardTargets,
        getTimeBombTargets,
        getTrapTargets,
        applyTrapWill,
        processTrapEffects,
        clearHyperactiveAtPositions,
        processHyperactiveMoves,
        processHyperactiveMoveAtAnchor,
        processUltimateHyperactiveMoveAtAnchor,
        // Presentation helpers (PoC)
        allocateStoneId,
        emitPresentationEvent,
        flushPresentationEvents
      };
    });
  }
});

// game/logic/context.js
var require_context = __commonJS({
  "game/logic/context.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    function mapBombMarkers(cardState2) {
      if (!cardState2) return [];
      if (typeof MarkersAdapter !== "undefined" && MarkersAdapter && typeof MarkersAdapter.getBombMarkers === "function") {
        return MarkersAdapter.getBombMarkers(cardState2).map((m) => ({
          row: m.row,
          col: m.col,
          remainingTurns: m.data ? m.data.remainingTurns : void 0,
          owner: m.owner,
          placedTurn: m.data ? m.data.placedTurn : void 0,
          createdSeq: m.createdSeq
        }));
      }
      return [];
    }
    __name(mapBombMarkers, "mapBombMarkers");
    function getSafeCardContext(cardState2, protectedStones, permaProtectedStones) {
      if (typeof CardLogic !== "undefined" && CardLogic && typeof CardLogic.getCardContext === "function") {
        try {
          return CardLogic.getCardContext(cardState2);
        } catch (e) {
          console.warn("[getSafeCardContext] CardLogic.getCardContext threw \u2014 falling back to safe context:", e && e.message);
        }
      }
      if (typeof __require === "function") {
        try {
          const cardsImpl = require_cards();
          if (cardsImpl && typeof cardsImpl.getCardContext === "function") {
            return cardsImpl.getCardContext(cardState2);
          }
        } catch (e) {
        }
      }
      return {
        protectedStones: protectedStones || [],
        permaProtectedStones: permaProtectedStones || [],
        bombs: mapBombMarkers(cardState2)
      };
    }
    __name(getSafeCardContext, "getSafeCardContext");
    if (typeof module !== "undefined" && module.exports) {
      module.exports = { getSafeCardContext, mapBombMarkers };
    }
  }
});

// game/turn/turn_pipeline_phases.js
var require_turn_pipeline_phases = __commonJS({
  "game/turn/turn_pipeline_phases.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory();
      } else {
        root.TurnPipelinePhases = factory();
      }
    })(typeof self !== "undefined" ? self : exports, function() {
      const MarkersAdapter2 = (() => {
        if (typeof __require === "function") {
          try {
            return require_markers_adapter();
          } catch (e) {
            return null;
          }
        }
        const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
        return globalScope.MarkersAdapter || null;
      })();
      const MARKER_KINDS = MarkersAdapter2 && MarkersAdapter2.MARKER_KINDS;
      const CardUtilsModule = (() => {
        if (typeof __require === "function") {
          try {
            return require_utils();
          } catch (e) {
            return null;
          }
        }
        const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
        return globalScope.CardUtils || null;
      })();
      function addChargeWithTotal(cardState2, playerKey, amount) {
        if (!cardState2 || !amount) return 0;
        if (!cardState2.charge) cardState2.charge = { black: 0, white: 0 };
        if (!cardState2.chargeGainedTotal) cardState2.chargeGainedTotal = { black: 0, white: 0 };
        const deltaRes = CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === "function" ? CardUtilsModule.addChargeWithDelta(cardState2, playerKey, amount, "turn_start_effect") : null;
        let added = deltaRes ? Number(deltaRes.delta) || 0 : 0;
        if (!deltaRes) {
          const before = cardState2.charge[playerKey] || 0;
          const after = Math.min(30, before + amount);
          cardState2.charge[playerKey] = after;
          added = after - before;
        }
        if (added > 0) {
          cardState2.chargeGainedTotal[playerKey] = (cardState2.chargeGainedTotal[playerKey] || 0) + added;
        }
        return added;
      }
      __name(addChargeWithTotal, "addChargeWithTotal");
      function pushTrapEvents(events, trapRes) {
        if (!events || !trapRes) return;
        if (Array.isArray(trapRes.triggered) && trapRes.triggered.length > 0) {
          events.push({ type: "trap_triggered", details: trapRes.triggered.slice() });
        }
        if (Array.isArray(trapRes.expired) && trapRes.expired.length > 0) {
          events.push({ type: "trap_expired", details: trapRes.expired.slice() });
        }
        if (Array.isArray(trapRes.disarmed) && trapRes.disarmed.length > 0) {
          events.push({ type: "trap_disarmed", details: trapRes.disarmed.slice() });
        }
      }
      __name(pushTrapEvents, "pushTrapEvents");
      function applyTurnStartPhase(CardLogic3, Core2, cardState2, gameState, playerKey, events, prng) {
        const p = prng || void 0;
        if (cardState2.lastTurnStartedFor !== playerKey) {
          const timerSnapshot = /* @__PURE__ */ new Map();
          try {
            const sourceMarkers2 = MarkersAdapter2 && typeof MarkersAdapter2.getMarkers === "function" ? MarkersAdapter2.getMarkers(cardState2) : cardState2.markers || [];
            for (const m of sourceMarkers2) {
              if (!m || !m.data) continue;
              const key = m.id !== void 0 && m.id !== null ? `${m.kind}:${m.id}` : `${m.kind}:${m.row},${m.col}:${m.owner}:${m.createdSeq || 0}`;
              if (m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb")) {
                if (typeof m.data.remainingTurns === "number") {
                  timerSnapshot.set(key, { timer: m.data.remainingTurns, special: "TIME_BOMB", owner: m.owner, row: m.row, col: m.col, kind: m.kind });
                }
              } else if (m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone")) {
                if (typeof m.data.remainingOwnerTurns === "number") {
                  timerSnapshot.set(key, { timer: m.data.remainingOwnerTurns, special: m.data.type || null, owner: m.owner, row: m.row, col: m.col, kind: m.kind });
                }
              }
            }
          } catch (e) {
          }
          CardLogic3.onTurnStart(cardState2, playerKey, gameState, p);
          events.push({ type: "turn_start", player: playerKey });
          const sourceMarkers = MarkersAdapter2 && typeof MarkersAdapter2.getMarkers === "function" ? MarkersAdapter2.getMarkers(cardState2) : cardState2.markers || [];
          const markers = sourceMarkers.map((m) => ({
            kind: m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb") ? "bomb" : "special",
            marker: m,
            createdSeq: m.createdSeq || 0
          })).sort((a, b) => (a.createdSeq || 0) - (b.createdSeq || 0));
          const hyperAggregated = { moved: [], destroyed: [], flipped: [], flippedByOwner: { black: [], white: [] } };
          for (const m of markers) {
            if (m.kind === "bomb") {
              const res = CardLogic3.tickBombAt(cardState2, gameState, m.marker, playerKey);
              if (res && res.exploded && res.exploded.length) {
                events.push({ type: "bombs_exploded", details: res });
              }
            } else if (m.kind === "special") {
              const t = (m.marker.data && m.marker.data.type ? m.marker.data.type : "").toUpperCase();
              const owner = m.marker.owner;
              const row = m.marker.row;
              const col = m.marker.col;
              if (t === "ULTIMATE_DESTROY_GOD" && owner === playerKey) {
                const res = CardLogic3.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col);
                if (res && res.destroyed && res.destroyed.length) events.push({ type: "udg_destroyed_start", details: res.destroyed });
                if (res && res.expired && res.expired.length) events.push({ type: "udg_expired_start", details: res.expired });
              } else if (t === "DRAGON" && owner === playerKey) {
                const res = CardLogic3.processDragonEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col);
                if (res && res.converted && res.converted.length) {
                  addChargeWithTotal(cardState2, playerKey, res.converted.length);
                  events.push({ type: "dragon_converted_start", details: res.converted });
                }
                if (res && res.destroyed && res.destroyed.length) events.push({ type: "dragon_destroyed_anchor_start", details: res.destroyed });
              } else if (t === "BREEDING" && owner === playerKey) {
                const res = CardLogic3.processBreedingEffectsAtTurnStartAnchor(cardState2, gameState, playerKey, row, col, p);
                if (res && res.spawned && res.spawned.length) events.push({ type: "breeding_spawned_start", details: res.spawned });
                if (res && res.flipped && res.flipped.length) {
                  addChargeWithTotal(cardState2, playerKey, res.flipped.length);
                  events.push({ type: "breeding_flipped_start", details: res.flipped });
                }
                if (res && res.destroyed && res.destroyed.length) events.push({ type: "breeding_destroyed_anchor_start", details: res.destroyed });
              } else if (t === "HYPERACTIVE") {
                const ownerKey = owner;
                if (typeof console !== "undefined" && console.log) console.log("[TurnPipeline] processing HYPERACTIVE anchor", { row, col, owner: ownerKey, createdSeq: m.createdSeq });
                const res = CardLogic3.processHyperactiveMoveAtAnchor(cardState2, gameState, ownerKey, row, col, p);
                if (typeof console !== "undefined" && console.log) console.log("[TurnPipeline] hyperactive result", { row, col, owner: ownerKey, res });
                if (res && res.moved && res.moved.length) {
                  events.push({ type: "hyperactive_moved_start", details: res.moved });
                  hyperAggregated.moved.push(...res.moved);
                }
                if (res && res.destroyed && res.destroyed.length) {
                  events.push({ type: "hyperactive_destroyed_start", details: res.destroyed });
                  hyperAggregated.destroyed.push(...res.destroyed);
                }
                if (res && res.flipped && res.flipped.length) {
                  events.push({ type: "hyperactive_flipped_start", details: res.flipped });
                  hyperAggregated.flipped.push(...res.flipped);
                  hyperAggregated.flippedByOwner[ownerKey] = hyperAggregated.flippedByOwner[ownerKey] || [];
                  hyperAggregated.flippedByOwner[ownerKey].push(...res.flipped);
                  addChargeWithTotal(cardState2, ownerKey, res.flipped.length);
                }
              } else if (t === "ULTIMATE_HYPERACTIVE") {
                const ownerKey = owner;
                const res = CardLogic3.processUltimateHyperactiveMoveAtAnchor(cardState2, gameState, ownerKey, row, col, p);
                if (res && res.moved && res.moved.length) {
                  events.push({ type: "ultimate_hyperactive_moved_start", details: res.moved });
                }
                if (res && res.flipped && res.flipped.length) {
                  events.push({ type: "ultimate_hyperactive_flipped_start", details: res.flipped });
                  addChargeWithTotal(cardState2, ownerKey, res.flipped.length);
                }
                if (res && res.destroyed && res.destroyed.length) {
                  events.push({ type: "ultimate_hyperactive_destroyed_start", details: res.destroyed });
                }
              }
            }
          }
          const hyperByOwner = hyperAggregated.flippedByOwner || {};
          const regenTriggered = [];
          const regenCaptureFlips = [];
          const regenCaptureByOwner = { black: [], white: [] };
          for (const ownerKey of ["black", "white"]) {
            const flips = hyperByOwner[ownerKey] || [];
            if (!flips.length) continue;
            if (typeof CardLogic3.applyRegenAfterFlips !== "function") continue;
            const regenRes = CardLogic3.applyRegenAfterFlips(cardState2, gameState, flips, ownerKey);
            if (regenRes && regenRes.regened && regenRes.regened.length) regenTriggered.push(...regenRes.regened);
            if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
              regenCaptureFlips.push(...regenRes.captureFlips);
              regenCaptureByOwner[ownerKey] = regenCaptureByOwner[ownerKey] || [];
              regenCaptureByOwner[ownerKey].push(...regenRes.captureFlips);
            }
          }
          if (regenCaptureFlips.length && typeof CardLogic3.clearHyperactiveAtPositions === "function") {
            CardLogic3.clearHyperactiveAtPositions(cardState2, regenCaptureFlips);
          }
          if (regenTriggered.length) {
            events.push({ type: "regen_triggered_start", details: regenTriggered });
          }
          if (regenCaptureFlips.length) {
            for (const ownerKey of ["black", "white"]) {
              const arr = regenCaptureByOwner[ownerKey] || [];
              if (!arr.length) continue;
              addChargeWithTotal(cardState2, ownerKey, arr.length);
            }
            events.push({ type: "regen_capture_flipped_start", details: regenCaptureFlips });
          }
          if (typeof CardLogic3.processTrapEffects === "function") {
            const trapRes = CardLogic3.processTrapEffects(cardState2, gameState, playerKey, { expireOnOwnerTurnStart: true });
            pushTrapEvents(events, trapRes);
          }
          try {
            const afterMarkers = MarkersAdapter2 && typeof MarkersAdapter2.getMarkers === "function" ? MarkersAdapter2.getMarkers(cardState2) : cardState2.markers || [];
            for (const m of afterMarkers) {
              if (!m || !m.data) continue;
              const key = m.id !== void 0 && m.id !== null ? `${m.kind}:${m.id}` : `${m.kind}:${m.row},${m.col}:${m.owner}:${m.createdSeq || 0}`;
              const before = timerSnapshot.get(key);
              if (m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : "bomb")) {
                if (typeof m.data.remainingTurns !== "number") continue;
                if (!before || before.timer !== m.data.remainingTurns) {
                  if (typeof CardLogic3.emitPresentationEvent === "function") {
                    CardLogic3.emitPresentationEvent(cardState2, {
                      type: "STATUS_TICK",
                      row: m.row,
                      col: m.col,
                      meta: { special: "TIME_BOMB", timer: m.data.remainingTurns, owner: m.owner }
                    });
                  }
                }
              } else if (m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : "specialStone")) {
                if (typeof m.data.remainingOwnerTurns !== "number") continue;
                if (!before || before.timer !== m.data.remainingOwnerTurns) {
                  if (typeof CardLogic3.emitPresentationEvent === "function") {
                    CardLogic3.emitPresentationEvent(cardState2, {
                      type: "STATUS_TICK",
                      row: m.row,
                      col: m.col,
                      meta: { special: m.data.type || null, timer: m.data.remainingOwnerTurns, owner: m.owner }
                    });
                  }
                }
              }
            }
          } catch (e) {
          }
        }
      }
      __name(applyTurnStartPhase, "applyTurnStartPhase");
      function applyCardUsagePhase(CardLogic3, cardState2, gameState, playerKey, action, events, prng) {
        const p = prng || void 0;
        if (action.useCardId) {
          const ok = CardLogic3.applyCardUsage(
            cardState2,
            gameState,
            playerKey,
            action.useCardId,
            action.useCardOwnerKey,
            action.debugOptions
          );
          if (!ok) {
            throw new Error("applyCardUsage failed");
          }
          events.push({ type: "card_used", player: playerKey, cardId: action.useCardId });
          const pendingType = typeof CardLogic3.getPendingEffectType === "function" ? CardLogic3.getPendingEffectType(cardState2, playerKey) : cardState2 && cardState2.pendingEffectByPlayer && cardState2.pendingEffectByPlayer[playerKey] ? cardState2.pendingEffectByPlayer[playerKey].type : null;
          if (pendingType === "TREASURE_BOX") {
            const rnd = p && typeof p.random === "function" ? p.random() : Math.random();
            const gained = 1 + Math.floor(Math.max(0, Math.min(0.999999, rnd)) * 3);
            addChargeWithTotal(cardState2, playerKey, gained);
            if (cardState2 && cardState2.pendingEffectByPlayer) {
              cardState2.pendingEffectByPlayer[playerKey] = null;
            }
            events.push({ type: "treasure_box_gain", player: playerKey, gained });
          }
        }
      }
      __name(applyCardUsagePhase, "applyCardUsagePhase");
      function resolveSafeCardContext(CardLogic3, cardState2) {
        let ctx = null;
        try {
          const ctxHelper = typeof __require === "function" ? require_context() : typeof globalThis !== "undefined" ? globalThis.GameLogicContext : null;
          if (ctxHelper && typeof ctxHelper.getSafeCardContext === "function") {
            ctx = ctxHelper.getSafeCardContext(cardState2);
          }
        } catch (e) {
        }
        if (!ctx) {
          try {
            ctx = CardLogic3.getCardContext(cardState2);
          } catch (e) {
            ctx = { protectedStones: [], permaProtectedStones: [], bombs: [] };
          }
        }
        return ctx;
      }
      __name(resolveSafeCardContext, "resolveSafeCardContext");
      function applyTrapEffectsAfterSelection(CardLogic3, cardState2, gameState, playerKey, events) {
        if (!CardLogic3 || typeof CardLogic3.processTrapEffects !== "function") return;
        const trapRes = CardLogic3.processTrapEffects(cardState2, gameState, playerKey, { expireOnOwnerTurnStart: false });
        pushTrapEvents(events, trapRes);
      }
      __name(applyTrapEffectsAfterSelection, "applyTrapEffectsAfterSelection");
      function applyActionPhase(CardLogic3, Core2, cardState2, gameState, playerKey, action, events, prng, BoardOps) {
        const p = prng || void 0;
        if (action.type === "pass") {
          const player = playerKey === "black" ? Core2.BLACK : Core2.WHITE;
          const ctx = resolveSafeCardContext(CardLogic3, cardState2);
          const legalMoves = Core2.getLegalMoves(gameState, player, ctx);
          if (legalMoves.length > 0) {
            throw new Error("Illegal pass: legal moves available");
          }
          if (cardState2 && cardState2.pendingEffectByPlayer) {
            cardState2.pendingEffectByPlayer[playerKey] = null;
          }
          const newState = Core2.applyPass(gameState);
          Object.assign(gameState, newState);
          events.push({ type: "pass", player: playerKey });
        } else if (action.type === "use_card") {
          events.push({ type: "card_used_only", player: playerKey, cardId: action.useCardId || null });
          return;
        } else if (action.type === "cancel_card") {
          const res = typeof CardLogic3.cancelPendingSelection === "function" ? CardLogic3.cancelPendingSelection(cardState2, playerKey, action.cancelOptions) : { canceled: false, reason: "not_supported" };
          events.push({ type: "card_cancelled", player: playerKey, canceled: !!res.canceled, reason: res.reason || null, cardId: res.cardId || null });
          return;
        } else if (action.type === "place") {
          const pending = cardState2.pendingEffectByPlayer[playerKey];
          if (pending && pending.type === "DESTROY_ONE_STONE" && action.destroyTarget) {
            const destroyed = CardLogic3.applyDestroyEffect(
              cardState2,
              gameState,
              playerKey,
              action.destroyTarget.row,
              action.destroyTarget.col
            );
            events.push({ type: "destroy_selected", player: playerKey, target: action.destroyTarget, destroyed });
            applyTrapEffectsAfterSelection(CardLogic3, cardState2, gameState, playerKey, events);
            return;
          } else if (pending && pending.type === "DESTROY_ONE_STONE" && action.destroyTarget == null) {
            throw new Error("DESTROY_ONE_STONE requires destroyTarget before placement");
          }
          if (pending && pending.type === "STRONG_WIND_WILL" && action.strongWindTarget) {
            const res = CardLogic3.applyStrongWindWill(
              cardState2,
              gameState,
              playerKey,
              action.strongWindTarget.row,
              action.strongWindTarget.col,
              p
            );
            events.push({ type: "strong_wind_selected", player: playerKey, target: action.strongWindTarget, applied: !!(res && res.applied), from: res && res.from ? res.from : null, to: res && res.to ? res.to : null });
            applyTrapEffectsAfterSelection(CardLogic3, cardState2, gameState, playerKey, events);
            return;
          } else if (pending && pending.type === "STRONG_WIND_WILL" && action.strongWindTarget == null) {
            throw new Error("STRONG_WIND_WILL requires strongWindTarget before placement");
          }
          if (pending && pending.type === "SACRIFICE_WILL" && action.sacrificeTarget) {
            const res = CardLogic3.applySacrificeWill(
              cardState2,
              gameState,
              playerKey,
              action.sacrificeTarget.row,
              action.sacrificeTarget.col
            );
            events.push({ type: "sacrifice_selected", player: playerKey, target: action.sacrificeTarget, applied: !!(res && res.applied), gained: res && res.gained ? res.gained : 0, completed: !!(res && res.completed) });
            applyTrapEffectsAfterSelection(CardLogic3, cardState2, gameState, playerKey, events);
            return;
          } else if (pending && pending.type === "SACRIFICE_WILL" && action.sacrificeTarget == null) {
            throw new Error("SACRIFICE_WILL requires sacrificeTarget before placement");
          }
          if (pending && pending.type === "SELL_CARD_WILL" && action.sellCardId) {
            const res = CardLogic3.applySellCardWill(
              cardState2,
              playerKey,
              action.sellCardId
            );
            events.push({ type: "sell_selected", player: playerKey, soldCardId: action.sellCardId, applied: !!(res && res.applied), gained: res && res.gained ? res.gained : 0 });
            return;
          } else if (pending && pending.type === "SELL_CARD_WILL" && action.sellCardId == null) {
            throw new Error("SELL_CARD_WILL requires sellCardId before placement");
          }
          if (pending && pending.type === "HEAVEN_BLESSING" && action.heavenBlessingCardId) {
            const res = CardLogic3.applyHeavenBlessingChoice(
              cardState2,
              playerKey,
              action.heavenBlessingCardId
            );
            events.push({
              type: "heaven_blessing_selected",
              player: playerKey,
              selectedCardId: action.heavenBlessingCardId,
              applied: !!(res && res.applied)
            });
            return;
          } else if (pending && pending.type === "HEAVEN_BLESSING" && action.heavenBlessingCardId == null) {
            throw new Error("HEAVEN_BLESSING requires heavenBlessingCardId before placement");
          }
          if (pending && pending.type === "CONDEMN_WILL" && action.condemnTargetIndex != null) {
            const res = CardLogic3.applyCondemnWill(
              cardState2,
              playerKey,
              action.condemnTargetIndex
            );
            events.push({
              type: "condemn_selected",
              player: playerKey,
              condemnTargetIndex: action.condemnTargetIndex,
              applied: !!(res && res.applied),
              destroyedCardId: res && res.destroyedCardId ? res.destroyedCardId : null
            });
            return;
          } else if (pending && pending.type === "CONDEMN_WILL" && action.condemnTargetIndex == null) {
            throw new Error("CONDEMN_WILL requires condemnTargetIndex before placement");
          }
          if (pending && pending.type === "TEMPT_WILL" && action.temptTarget) {
            const res = CardLogic3.applyTemptWill(
              cardState2,
              gameState,
              playerKey,
              action.temptTarget.row,
              action.temptTarget.col
            );
            events.push({ type: "tempt_selected", player: playerKey, target: action.temptTarget, applied: !!(res && res.applied) });
            applyTrapEffectsAfterSelection(CardLogic3, cardState2, gameState, playerKey, events);
            return;
          } else if (pending && pending.type === "TEMPT_WILL" && action.temptTarget == null) {
            throw new Error("TEMPT_WILL requires temptTarget before placement");
          }
          if (pending && pending.type === "SWAP_WITH_ENEMY" && action.swapTarget) {
            const swapped = CardLogic3.applySwapEffect(
              cardState2,
              gameState,
              playerKey,
              action.swapTarget.row,
              action.swapTarget.col
            );
            events.push({ type: "swap_selected", player: playerKey, row: action.swapTarget.row, col: action.swapTarget.col, swapped });
            if (!swapped) {
              throw new Error("SWAP_WITH_ENEMY: invalid target (protected/bomb?)");
            }
            applyTrapEffectsAfterSelection(CardLogic3, cardState2, gameState, playerKey, events);
            return;
          } else if (pending && pending.type === "SWAP_WITH_ENEMY" && action.swapTarget == null) {
            throw new Error("SWAP_WITH_ENEMY requires swapTarget before placement");
          }
          if (pending && pending.type === "POSITION_SWAP_WILL" && action.positionSwapTarget) {
            const res = CardLogic3.applyPositionSwapWill(
              cardState2,
              gameState,
              playerKey,
              action.positionSwapTarget.row,
              action.positionSwapTarget.col
            );
            events.push({
              type: res && res.completed ? "position_swap_selected" : "position_swap_first_selected",
              player: playerKey,
              target: action.positionSwapTarget,
              from: res && res.from ? res.from : res && res.firstTarget ? res.firstTarget : null,
              to: res && res.to ? res.to : null,
              applied: !!(res && res.applied),
              completed: !!(res && res.completed)
            });
            applyTrapEffectsAfterSelection(CardLogic3, cardState2, gameState, playerKey, events);
            return;
          } else if (pending && pending.type === "POSITION_SWAP_WILL" && action.positionSwapTarget == null) {
            throw new Error("POSITION_SWAP_WILL requires positionSwapTarget before placement");
          }
          if (pending && pending.type === "TRAP_WILL" && action.trapTarget) {
            const res = CardLogic3.applyTrapWill(
              cardState2,
              gameState,
              playerKey,
              action.trapTarget.row,
              action.trapTarget.col
            );
            events.push({ type: "trap_selected", player: playerKey, target: action.trapTarget, applied: !!(res && res.applied) });
            return;
          } else if (pending && pending.type === "TRAP_WILL" && action.trapTarget == null) {
            throw new Error("TRAP_WILL requires trapTarget before placement");
          }
          if (pending && pending.type === "GUARD_WILL" && action.guardTarget) {
            const res = CardLogic3.applyGuardWill(
              cardState2,
              gameState,
              playerKey,
              action.guardTarget.row,
              action.guardTarget.col
            );
            events.push({ type: "guard_selected", player: playerKey, target: action.guardTarget, applied: !!(res && res.applied) });
            return;
          } else if (pending && pending.type === "GUARD_WILL" && action.guardTarget == null) {
            throw new Error("GUARD_WILL requires guardTarget before placement");
          }
          if (pending && pending.type === "TIME_BOMB" && action.bombTarget) {
            const res = CardLogic3.applyTimeBombWill(
              cardState2,
              gameState,
              playerKey,
              action.bombTarget.row,
              action.bombTarget.col
            );
            events.push({ type: "time_bomb_selected", player: playerKey, target: action.bombTarget, applied: !!(res && res.applied) });
            return;
          } else if (pending && pending.type === "TIME_BOMB" && action.bombTarget == null) {
            throw new Error("TIME_BOMB requires bombTarget before placement");
          }
          const ctx = resolveSafeCardContext(CardLogic3, cardState2);
          const player = playerKey === "black" ? Core2.BLACK : Core2.WHITE;
          let originalCellVal = null;
          const pendingType = CardLogic3.getPendingEffectType(cardState2, playerKey);
          const swapOnEnemy = pendingType === "SWAP_WITH_ENEMY" && gameState.board[action.row][action.col] === -player;
          if (pendingType === "SWAP_WITH_ENEMY") {
            if (swapOnEnemy) {
              const swapped = CardLogic3.applySwapEffect(cardState2, gameState, playerKey, action.row, action.col);
              events.push({ type: "swap_selected", player: playerKey, row: action.row, col: action.col, swapped });
              if (!swapped) {
                throw new Error("SWAP_WITH_ENEMY: invalid target (protected/bomb?)");
              }
            } else {
              throw new Error("SWAP_WITH_ENEMY requires selecting an enemy stone before placement");
            }
          }
          if (swapOnEnemy) {
            originalCellVal = gameState.board[action.row][action.col];
            gameState.board[action.row][action.col] = Core2.EMPTY;
          }
          const flips = Core2.getFlipsWithContext(gameState, action.row, action.col, player, ctx);
          let flipCount = flips.length;
          if (swapOnEnemy) {
            gameState.board[action.row][action.col] = originalCellVal;
          }
          const freePlacement = pendingType === "FREE_PLACEMENT";
          if (flipCount === 0 && !freePlacement && !swapOnEnemy) {
            throw new Error("Illegal move: no flips and not free placement");
          }
          const preExtra = cardState2.extraPlaceRemainingByPlayer[playerKey] || 0;
          const turnNumberBeforePlace = Number(gameState.turnNumber || 0);
          if (BoardOps && typeof BoardOps.spawnAt === "function") {
            const spawnMeta = {};
            if (pendingType === "GOLD_STONE") {
              spawnMeta.special = "GOLD";
              spawnMeta.owner = playerKey;
            } else if (pendingType === "SILVER_STONE") {
              spawnMeta.special = "SILVER";
              spawnMeta.owner = playerKey;
            } else if (pendingType === "CROSS_BOMB") {
              spawnMeta.special = "CROSS_BOMB";
              spawnMeta.owner = playerKey;
            }
            BoardOps.spawnAt(cardState2, gameState, action.row, action.col, playerKey, "SYSTEM", "standard_place", spawnMeta);
            for (const [fr, fc] of flips) {
              BoardOps.changeAt(cardState2, gameState, fr, fc, playerKey, "SYSTEM", "standard_flip");
            }
          } else {
            const newState = Core2.applyMove(gameState, { row: action.row, col: action.col, flips });
            Object.assign(gameState, newState);
          }
          events.push({ type: "place", player: playerKey, row: action.row, col: action.col, flips: flips.slice() });
          if (flips.length > 0 && typeof CardLogic3.clearBombAt === "function") {
            for (const [r, c] of flips) {
              CardLogic3.clearBombAt(cardState2, r, c);
            }
          }
          if (flips.length > 0 && typeof CardLogic3.clearHyperactiveAtPositions === "function") {
            const flippedPositions = flips.map(([r, c]) => ({ row: r, col: c }));
            CardLogic3.clearHyperactiveAtPositions(cardState2, flippedPositions);
          }
          if (flipCount > 0 && typeof CardLogic3.applyRegenAfterFlips === "function") {
            const regenRes = CardLogic3.applyRegenAfterFlips(cardState2, gameState, flips, playerKey);
            if (regenRes.regened && regenRes.regened.length) {
              events.push({ type: "regen_triggered", details: regenRes.regened });
            }
            if (regenRes.captureFlips && regenRes.captureFlips.length) {
              flips.push(...regenRes.captureFlips.map((p2) => [p2.row, p2.col]));
              flipCount = flips.length;
              events.push({ type: "regen_capture_flipped", details: regenRes.captureFlips });
            }
          }
          if (typeof CardLogic3.applyChainWillAfterMove === "function") {
            const chainRes = CardLogic3.applyChainWillAfterMove(cardState2, gameState, playerKey, flips, p);
            if (chainRes && chainRes.flips && chainRes.flips.length) {
              flips.push(...chainRes.flips.map((pos) => [pos.row, pos.col]));
              flipCount = flips.length;
              events.push({ type: "chain_flipped", details: chainRes.flips });
            }
            if (chainRes && chainRes.flips && chainRes.flips.length && typeof CardLogic3.applyRegenAfterFlips === "function") {
              const regenRes2 = CardLogic3.applyRegenAfterFlips(cardState2, gameState, chainRes.flips, playerKey);
              if (regenRes2.regened && regenRes2.regened.length) {
                events.push({ type: "regen_triggered", details: regenRes2.regened });
              }
              if (regenRes2.captureFlips && regenRes2.captureFlips.length) {
                flips.push(...regenRes2.captureFlips.map((p3) => [p3.row, p3.col]));
                flipCount = flips.length;
                events.push({ type: "regen_capture_flipped", details: regenRes2.captureFlips });
              }
            }
          }
          const effects = CardLogic3.applyPlacementEffects(cardState2, gameState, playerKey, action.row, action.col, flipCount);
          events.push({ type: "placement_effects", player: playerKey, effects });
          if (effects && effects.dragonPlaced && typeof CardLogic3.processDragonEffectsAtAnchor === "function") {
            const dragonNow = CardLogic3.processDragonEffectsAtAnchor(cardState2, gameState, playerKey, action.row, action.col);
            if (dragonNow.converted && dragonNow.converted.length) {
              addChargeWithTotal(cardState2, playerKey, dragonNow.converted.length);
              events.push({ type: "dragon_converted_immediate", details: dragonNow.converted });
            }
          }
          if (effects && effects.breedingPlaced && typeof CardLogic3.processBreedingEffectsAtAnchor === "function") {
            const breedingNow = CardLogic3.processBreedingEffectsAtAnchor(cardState2, gameState, playerKey, action.row, action.col, p);
            if (breedingNow.spawned && breedingNow.spawned.length) {
              events.push({ type: "breeding_spawned_immediate", details: breedingNow.spawned });
            }
            if (breedingNow.flipped && breedingNow.flipped.length) {
              addChargeWithTotal(cardState2, playerKey, breedingNow.flipped.length);
              events.push({ type: "breeding_flipped_immediate", details: breedingNow.flipped });
            }
          }
          if (effects && effects.ultimateDestroyGodPlaced && typeof CardLogic3.processUltimateDestroyGodEffectsAtAnchor === "function") {
            const udgNow = CardLogic3.processUltimateDestroyGodEffectsAtAnchor(cardState2, gameState, playerKey, action.row, action.col, { decrementRemainingOwnerTurns: false });
            if (udgNow.destroyed && udgNow.destroyed.length) {
              events.push({ type: "udg_destroyed_immediate", details: udgNow.destroyed });
            }
          }
          if (effects && effects.hyperactivePlaced) {
            if (typeof console !== "undefined" && console.log) console.log("[TurnPipeline] hyperactivePlaced detected on placement \u2014 immediate activation suppressed by spec");
          }
          if (effects && effects.ultimateHyperactivePlaced) {
            if (typeof console !== "undefined" && console.log) console.log("[TurnPipeline] ultimateHyperactivePlaced detected on placement \u2014 immediate activation suppressed by spec");
          }
          if (typeof CardLogic3.processTrapEffects === "function") {
            const trapRes = CardLogic3.processTrapEffects(cardState2, gameState, playerKey, { expireOnOwnerTurnStart: false });
            pushTrapEvents(events, trapRes);
          }
          if (preExtra > 0) {
            cardState2.extraPlaceRemainingByPlayer[playerKey] = Math.max(0, (cardState2.extraPlaceRemainingByPlayer[playerKey] || 0) - 1);
            events.push({ type: "extra_place_consumed", player: playerKey });
          }
          const postExtra = cardState2.extraPlaceRemainingByPlayer[playerKey] || 0;
          const keepTurnForExtra = preExtra <= 0 && postExtra > 0;
          if (keepTurnForExtra) {
            gameState.currentPlayer = player;
            gameState.consecutivePasses = 0;
            gameState.turnNumber = turnNumberBeforePlace;
          } else {
            gameState.currentPlayer = -player;
            gameState.consecutivePasses = 0;
            gameState.turnNumber = turnNumberBeforePlace + 1;
          }
        } else {
          throw new Error("Unknown action.type");
        }
      }
      __name(applyActionPhase, "applyActionPhase");
      return { applyTurnStartPhase, applyCardUsagePhase, applyActionPhase };
    });
  }
});

// game/schema/prng.js
var require_prng = __commonJS({
  "game/schema/prng.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(root, factory) {
      if (typeof module === "object" && module.exports) {
        module.exports = factory();
      } else {
        root.SeededPRNG = factory();
      }
    })(typeof self !== "undefined" ? self : exports, function() {
      "use strict";
      function createPRNG(seed) {
        let state = seed === void 0 || seed === null ? 1 : seed;
        state = state >>> 0;
        const prng = {
          _seed: seed,
          _calls: 0,
          /**
           * Get next random number in [0, 1)
           * @returns {number}
           */
          random: /* @__PURE__ */ __name(function() {
            state = state * 1664525 + 1013904223 >>> 0;
            this._calls++;
            return state / 4294967296;
          }, "random"),
          /**
           * Shuffle an array in place (Fisher-Yates)
           * @param {Array} array
           */
          shuffle: /* @__PURE__ */ __name(function(array) {
            for (let i = array.length - 1; i > 0; i--) {
              const j = Math.floor(this.random() * (i + 1));
              [array[i], array[j]] = [array[j], array[i]];
            }
          }, "shuffle"),
          /**
           * Get a random integer in [0, max)
           * @param {number} max
           * @returns {number}
           */
          nextInt: /* @__PURE__ */ __name(function(max) {
            return Math.floor(this.random() * max);
          }, "nextInt"),
          /**
           * Get current state for serialization
           * @returns {{ seed: number, calls: number }}
           */
          getState: /* @__PURE__ */ __name(function() {
            return {
              seed: this._seed,
              calls: this._calls
            };
          }, "getState"),
          /**
           * Restore PRNG to a previous state
           * @param {{ seed: number, calls: number }} savedState
           */
          restoreState: /* @__PURE__ */ __name(function(savedState) {
            this._seed = savedState.seed;
            this._calls = 0;
            state = savedState.seed === void 0 || savedState.seed === null ? 1 : savedState.seed;
            state = state >>> 0;
            for (let i = 0; i < savedState.calls; i++) {
              state = state * 1664525 + 1013904223 >>> 0;
            }
            this._calls = savedState.calls;
          }, "restoreState")
        };
        return prng;
      }
      __name(createPRNG, "createPRNG");
      function fromState(savedState) {
        const prng = createPRNG(savedState.seed);
        prng.restoreState(savedState);
        return prng;
      }
      __name(fromState, "fromState");
      return {
        createPRNG,
        fromState
      };
    });
  }
});

// utils/deepClone.js
var require_deepClone = __commonJS({
  "utils/deepClone.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    function deepClone2(value) {
      if (typeof globalThis !== "undefined" && typeof globalThis.structuredClone === "function") {
        return globalThis.structuredClone(value);
      }
      return JSON.parse(JSON.stringify(value));
    }
    __name(deepClone2, "deepClone");
    module.exports = deepClone2;
  }
});

// .wrangler/tmp/bundle-SrNEQW/middleware-loader.entry.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();

// .wrangler/tmp/bundle-SrNEQW/middleware-insertion-facade.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();

// workers/match-worker.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();
var import_core = __toESM(require_core(), 1);
var import_cards = __toESM(require_cards(), 1);
var import_turn_pipeline_phases = __toESM(require_turn_pipeline_phases(), 1);
var import_prng = __toESM(require_prng(), 1);
var import_deepClone = __toESM(require_deepClone(), 1);
var ROOM_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var ROOM_ID_LENGTH = 8;
var SEAT_TOKEN_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
var SEAT_TOKEN_LENGTH = 24;
var ROOM_STORAGE_KEY = "match_room_state_v1";
var PLAYER_KEYS = Object.freeze(["black", "white"]);
var HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function withCORS(response) {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withCORS, "withCORS");
function jsonResponse(statusCode, payload) {
  return new Response(JSON.stringify(payload || {}), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    }
  });
}
__name(jsonResponse, "jsonResponse");
function normalizePlayerKey(value) {
  if (value === "white" || value === -1 || value === "-1") return "white";
  return "black";
}
__name(normalizePlayerKey, "normalizePlayerKey");
function parseSeatKeyOptional(value) {
  if (value === "black" || value === 1 || value === "1") return "black";
  if (value === "white" || value === -1 || value === "-1") return "white";
  return null;
}
__name(parseSeatKeyOptional, "parseSeatKeyOptional");
function getCurrentPlayerKey(gameState) {
  if (!gameState) return "black";
  return normalizePlayerKey(gameState.currentPlayer);
}
__name(getCurrentPlayerKey, "getCurrentPlayerKey");
function getOpponentKey(playerKey) {
  return normalizePlayerKey(playerKey) === "white" ? "black" : "white";
}
__name(getOpponentKey, "getOpponentKey");
function makeHiddenHandToken(ownerKey, handIndex) {
  const normalizedOwner = normalizePlayerKey(ownerKey);
  const idx = Number.isFinite(Number(handIndex)) ? Math.max(0, Math.trunc(Number(handIndex))) : 0;
  return `__hidden_hand__:${normalizedOwner}:${idx}`;
}
__name(makeHiddenHandToken, "makeHiddenHandToken");
function parseHiddenHandToken(value) {
  const match = String(value || "").match(HIDDEN_HAND_TOKEN_RE);
  if (!match) return null;
  const ownerKey = normalizePlayerKey(match[1]);
  const handIndex = Number(match[2]);
  if (!Number.isInteger(handIndex) || handIndex < 0) return null;
  return { ownerKey, handIndex };
}
__name(parseHiddenHandToken, "parseHiddenHandToken");
function resolveCardIdFromHiddenToken(value, previousHands) {
  const parsed = parseHiddenHandToken(value);
  if (!parsed) return null;
  const ownerHand = previousHands && Array.isArray(previousHands[parsed.ownerKey]) ? previousHands[parsed.ownerKey] : null;
  if (!ownerHand) return null;
  if (parsed.handIndex < 0 || parsed.handIndex >= ownerHand.length) return null;
  return ownerHand[parsed.handIndex];
}
__name(resolveCardIdFromHiddenToken, "resolveCardIdFromHiddenToken");
function resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue) {
  if (!room || !room.seatTokens) return null;
  const seatToken = String(seatTokenValue || "").trim();
  if (!seatToken) return null;
  const requestedSeat = parseSeatKeyOptional(seatKeyValue);
  if (requestedSeat) {
    return room.seatTokens[requestedSeat] === seatToken ? requestedSeat : null;
  }
  if (room.seatTokens.black === seatToken) return "black";
  if (room.seatTokens.white === seatToken) return "white";
  return null;
}
__name(resolveAuthenticatedSeatKey, "resolveAuthenticatedSeatKey");
function randomFromChars(chars, length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}
__name(randomFromChars, "randomFromChars");
function makeRoomId() {
  return randomFromChars(ROOM_ID_CHARS, ROOM_ID_LENGTH);
}
__name(makeRoomId, "makeRoomId");
function makeSeatToken() {
  return randomFromChars(SEAT_TOKEN_CHARS, SEAT_TOKEN_LENGTH);
}
__name(makeSeatToken, "makeSeatToken");
function parseJsonBody(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
__name(parseJsonBody, "parseJsonBody");
function normalizeRoomId(value) {
  const roomId = String(value || "").trim().toUpperCase();
  return roomId || "";
}
__name(normalizeRoomId, "normalizeRoomId");
function makeInitialSnapshot(seed) {
  const gameState = import_core.default.createGameState();
  const prng = import_prng.default.createPRNG(seed);
  const cardState2 = import_cards.default.createCardState(prng);
  const startupEvents = [];
  import_turn_pipeline_phases.default.applyTurnStartPhase(
    import_cards.default,
    import_core.default,
    cardState2,
    gameState,
    "black",
    startupEvents,
    prng
  );
  return {
    gameState,
    cardState: cardState2,
    stateVersion: 0,
    updatedAt: Date.now()
  };
}
__name(makeInitialSnapshot, "makeInitialSnapshot");
function cloneSnapshotWithVersion(room) {
  const shot = (0, import_deepClone.default)(room && room.snapshot ? room.snapshot : {});
  shot.stateVersion = room ? room.stateVersion : 0;
  shot.updatedAt = room ? room.updatedAt : Date.now();
  return shot;
}
__name(cloneSnapshotWithVersion, "cloneSnapshotWithVersion");
function projectSnapshotForViewer(room, viewerSeatKey) {
  const shot = cloneSnapshotWithVersion(room);
  if (!shot || typeof shot !== "object") return shot;
  const cardState2 = shot.cardState && typeof shot.cardState === "object" ? shot.cardState : null;
  if (!cardState2) return shot;
  const viewer = parseSeatKeyOptional(viewerSeatKey);
  const hands = cardState2.hands && typeof cardState2.hands === "object" ? cardState2.hands : {};
  cardState2.hands = cardState2.hands && typeof cardState2.hands === "object" ? cardState2.hands : {};
  for (const ownerKey of PLAYER_KEYS) {
    const ownerHand = Array.isArray(hands[ownerKey]) ? hands[ownerKey] : [];
    if (viewer && ownerKey === viewer) {
      cardState2.hands[ownerKey] = ownerHand.slice();
      continue;
    }
    cardState2.hands[ownerKey] = ownerHand.map((_, handIndex) => makeHiddenHandToken(ownerKey, handIndex));
  }
  const selectedOwnerKey = parseSeatKeyOptional(cardState2.selectedCardOwnerKey);
  if (!viewer || !selectedOwnerKey || selectedOwnerKey !== viewer) {
    cardState2.selectedCardId = null;
    cardState2.selectedCardOwnerKey = null;
  }
  if (cardState2.pendingEffectByPlayer && typeof cardState2.pendingEffectByPlayer === "object") {
    for (const ownerKey of PLAYER_KEYS) {
      const pending = cardState2.pendingEffectByPlayer[ownerKey];
      if (!pending || pending.type !== "CONDEMN_WILL" || !Array.isArray(pending.offers)) continue;
      if (viewer && ownerKey === viewer) continue;
      const opponentKey = getOpponentKey(ownerKey);
      pending.offers = pending.offers.map((offer, idx) => {
        const handIndex = offer && Number.isInteger(offer.handIndex) ? offer.handIndex : idx;
        return {
          handIndex,
          cardId: makeHiddenHandToken(opponentKey, handIndex)
        };
      });
    }
  }
  return shot;
}
__name(projectSnapshotForViewer, "projectSnapshotForViewer");
function rehydrateSnapshotForPublish(previousSnapshot, incomingSnapshot) {
  const nextSnapshot = (0, import_deepClone.default)(incomingSnapshot || {});
  if (!nextSnapshot.cardState || typeof nextSnapshot.cardState !== "object") {
    nextSnapshot.cardState = {};
  }
  const nextCardState = nextSnapshot.cardState;
  const previousCardState = previousSnapshot && previousSnapshot.cardState && typeof previousSnapshot.cardState === "object" ? previousSnapshot.cardState : {};
  const previousHands = previousCardState.hands && typeof previousCardState.hands === "object" ? previousCardState.hands : {};
  if (!nextCardState.hands || typeof nextCardState.hands !== "object") {
    nextCardState.hands = {};
  }
  for (const ownerKey of PLAYER_KEYS) {
    const incomingHand = Array.isArray(nextCardState.hands[ownerKey]) ? nextCardState.hands[ownerKey] : [];
    nextCardState.hands[ownerKey] = incomingHand.map((cardId) => {
      const resolved = resolveCardIdFromHiddenToken(cardId, previousHands);
      return resolved || cardId;
    });
  }
  if (Array.isArray(nextCardState.discard)) {
    nextCardState.discard = nextCardState.discard.map((cardId) => {
      const resolved = resolveCardIdFromHiddenToken(cardId, previousHands);
      return resolved || cardId;
    });
  }
  return nextSnapshot;
}
__name(rehydrateSnapshotForPublish, "rehydrateSnapshotForPublish");
function toPublicSnapshot(room, viewerSeatKey) {
  return projectSnapshotForViewer(room, viewerSeatKey || null);
}
__name(toPublicSnapshot, "toPublicSnapshot");
function buildSnapshotPayload(room, meta, viewerSeatKey) {
  return {
    ok: true,
    roomId: room.roomId,
    stateVersion: room.stateVersion,
    snapshot: toPublicSnapshot(room, viewerSeatKey),
    playbackEvents: Array.isArray(meta && meta.playbackEvents) ? meta.playbackEvents : [],
    operationId: meta && meta.operationId ? String(meta.operationId) : null,
    playerKey: meta && meta.playerKey ? normalizePlayerKey(meta.playerKey) : null,
    actionType: meta && meta.actionType ? String(meta.actionType) : null
  };
}
__name(buildSnapshotPayload, "buildSnapshotPayload");
function resolveSeatForJoin(room, requestedSeatKey, providedToken) {
  const token = String(providedToken || "").trim();
  const requested = parseSeatKeyOptional(requestedSeatKey);
  if (requested) {
    if (token && room.seatTokens && room.seatTokens[requested] === token) return requested;
    if (!room.seats[requested]) return requested;
    return null;
  }
  if (token && room.seatTokens) {
    if (room.seatTokens.black === token) return "black";
    if (room.seatTokens.white === token) return "white";
  }
  if (!room.seats.black) return "black";
  if (!room.seats.white) return "white";
  return null;
}
__name(resolveSeatForJoin, "resolveSeatForJoin");
function sseChunk(eventName, payload) {
  const data = JSON.stringify(payload || {});
  const eventLine = eventName ? `event: ${eventName}
` : "";
  return `${eventLine}data: ${data}

`;
}
__name(sseChunk, "sseChunk");
function getRoomStub(env2, roomId) {
  const doId = env2.MATCH_ROOM.idFromName(roomId);
  return env2.MATCH_ROOM.get(doId);
}
__name(getRoomStub, "getRoomStub");
async function forwardJsonToRoom(env2, roomId, pathname, payload) {
  const stub = getRoomStub(env2, roomId);
  const req = new Request(`https://room${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  const response = await stub.fetch(req);
  return withCORS(response);
}
__name(forwardJsonToRoom, "forwardJsonToRoom");
async function forwardGetToRoom(env2, roomId, pathname, sourceUrl) {
  const stub = getRoomStub(env2, roomId);
  const urlObj = new URL(sourceUrl);
  const target = new URL(`https://room${pathname}`);
  for (const [key, value] of urlObj.searchParams.entries()) {
    target.searchParams.set(key, value);
  }
  target.searchParams.set("roomId", roomId);
  const req = new Request(target.toString(), { method: "GET" });
  const response = await stub.fetch(req);
  return withCORS(response);
}
__name(forwardGetToRoom, "forwardGetToRoom");
async function handleCreate(env2) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const roomId = makeRoomId();
    const stub = getRoomStub(env2, roomId);
    const req = new Request(`https://room/internal/create?roomId=${encodeURIComponent(roomId)}`, { method: "POST" });
    const response = await stub.fetch(req);
    if (response.status === 409) {
      continue;
    }
    return withCORS(response);
  }
  return jsonResponse(500, { ok: false, reason: "CREATE_RETRY_EXHAUSTED" });
}
__name(handleCreate, "handleCreate");
async function parsePostBody(request) {
  const raw = await request.text();
  const body = parseJsonBody(raw);
  if (body === null) {
    return { ok: false, response: jsonResponse(400, { ok: false, reason: "INVALID_JSON" }) };
  }
  return { ok: true, body };
}
__name(parsePostBody, "parsePostBody");
async function handleMatchApi(request, env2) {
  const urlObj = new URL(request.url);
  const pathname = urlObj.pathname;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method === "POST" && pathname === "/api/match/create") {
    return handleCreate(env2);
  }
  if (request.method === "POST" && (pathname === "/api/match/join" || pathname === "/api/match/leave" || pathname === "/api/match/publish")) {
    const parsed = await parsePostBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body || {};
    const roomId = normalizeRoomId(body.roomId);
    if (!roomId) {
      return jsonResponse(400, { ok: false, reason: "ROOM_ID_REQUIRED" });
    }
    body.roomId = roomId;
    return forwardJsonToRoom(env2, roomId, pathname, body);
  }
  if (request.method === "GET" && (pathname === "/api/match/state" || pathname === "/api/match/stream")) {
    const roomId = normalizeRoomId(urlObj.searchParams.get("roomId") || "");
    if (!roomId) {
      return jsonResponse(400, { ok: false, reason: "ROOM_ID_REQUIRED" });
    }
    return forwardGetToRoom(env2, roomId, pathname, request.url);
  }
  return jsonResponse(404, { ok: false, reason: "NOT_FOUND" });
}
__name(handleMatchApi, "handleMatchApi");
var MatchRoomDurableObject = class {
  static {
    __name(this, "MatchRoomDurableObject");
  }
  constructor(state) {
    this.state = state;
    this.room = null;
    this.roomLoaded = false;
    this.streams = /* @__PURE__ */ new Map();
    this.streamSeq = 0;
    this.encoder = new TextEncoder();
  }
  async loadRoom() {
    if (this.roomLoaded) return;
    this.room = await this.state.storage.get(ROOM_STORAGE_KEY) || null;
    this.roomLoaded = true;
  }
  async saveRoom() {
    await this.state.storage.put(ROOM_STORAGE_KEY, this.room);
  }
  async removeRoom() {
    this.room = null;
    await this.state.storage.delete(ROOM_STORAGE_KEY);
  }
  async closeStream(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    this.streams.delete(streamId);
    try {
      await stream.writer.close();
    } catch (e) {
      try {
        stream.writer.releaseLock();
      } catch (inner) {
      }
    }
  }
  async sendSse(streamId, eventName, payload) {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    const chunk = sseChunk(eventName, payload);
    try {
      await stream.writer.write(this.encoder.encode(chunk));
    } catch (e) {
      await this.closeStream(streamId);
    }
  }
  async broadcastSnapshot(meta) {
    if (!this.room) return;
    const streamEntries = Array.from(this.streams.entries());
    for (const [streamId, streamInfo] of streamEntries) {
      const payload = buildSnapshotPayload(this.room, meta, streamInfo && streamInfo.seatKey ? streamInfo.seatKey : null);
      await this.sendSse(streamId, "snapshot", payload);
    }
  }
  createRoomState(roomId) {
    const seed = Date.now();
    return {
      roomId,
      seed,
      snapshot: makeInitialSnapshot(seed),
      stateVersion: 0,
      seats: { black: false, white: false },
      seatTokens: { black: makeSeatToken(), white: makeSeatToken() },
      updatedAt: Date.now()
    };
  }
  async handleInternalCreate(urlObj) {
    await this.loadRoom();
    if (this.room) {
      return jsonResponse(409, { ok: false, reason: "ROOM_EXISTS" });
    }
    const roomId = normalizeRoomId(urlObj.searchParams.get("roomId") || "");
    if (!roomId) {
      return jsonResponse(400, { ok: false, reason: "ROOM_ID_REQUIRED" });
    }
    this.room = this.createRoomState(roomId);
    this.room.seats.black = true;
    this.room.updatedAt = Date.now();
    await this.saveRoom();
    return jsonResponse(200, {
      ok: true,
      roomId: this.room.roomId,
      seatKey: "black",
      seatToken: this.room.seatTokens.black,
      stateVersion: this.room.stateVersion,
      snapshot: toPublicSnapshot(this.room, "black"),
      serverTime: Date.now()
    });
  }
  async handleJoin(body) {
    await this.loadRoom();
    const room = this.room;
    if (!room) {
      return jsonResponse(404, { ok: false, reason: "ROOM_NOT_FOUND" });
    }
    const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
    const providedToken = String(body.seatToken || "").trim();
    const seatKey = resolveSeatForJoin(room, requestedSeatKey, providedToken);
    if (!seatKey) {
      return jsonResponse(409, { ok: false, reason: "ROOM_FULL" });
    }
    if (!room.seatTokens || !room.seatTokens[seatKey]) {
      room.seatTokens = room.seatTokens || {};
      room.seatTokens[seatKey] = makeSeatToken();
    }
    const seatToken = room.seatTokens[seatKey];
    const rejoined = providedToken && providedToken === seatToken;
    room.seats[seatKey] = true;
    room.updatedAt = Date.now();
    await this.saveRoom();
    return jsonResponse(200, {
      ok: true,
      roomId: room.roomId,
      seatKey,
      seatToken,
      rejoined: !!rejoined,
      stateVersion: room.stateVersion,
      snapshot: toPublicSnapshot(room, seatKey),
      serverTime: Date.now()
    });
  }
  async handleLeave(body) {
    await this.loadRoom();
    const room = this.room;
    if (!room) {
      return jsonResponse(200, { ok: true });
    }
    const seatKey = normalizePlayerKey(body.seatKey);
    const seatToken = String(body.seatToken || "").trim();
    if (seatToken && room.seatTokens && room.seatTokens[seatKey] !== seatToken) {
      return jsonResponse(403, { ok: false, reason: "SEAT_TOKEN_MISMATCH" });
    }
    room.seats[seatKey] = false;
    room.updatedAt = Date.now();
    if (!room.seats.black && !room.seats.white && this.streams.size === 0) {
      await this.removeRoom();
    } else {
      await this.saveRoom();
    }
    return jsonResponse(200, { ok: true });
  }
  async handlePublish(body) {
    await this.loadRoom();
    const room = this.room;
    if (!room) {
      return jsonResponse(404, { ok: false, rejectedReason: "ROOM_NOT_FOUND" });
    }
    const seatKey = normalizePlayerKey(body.seatKey);
    const playerKey = normalizePlayerKey(body.playerKey);
    const seatToken = String(body.seatToken || "").trim();
    const baseVersion = Number.isFinite(Number(body.baseVersion)) ? Number(body.baseVersion) : null;
    const snapshot = body.snapshot;
    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    if (!room.seats[seatKey]) {
      return jsonResponse(403, {
        ok: false,
        rejectedReason: "SEAT_NOT_JOINED",
        snapshot: toPublicSnapshot(room, viewerSeatKey),
        stateVersion: room.stateVersion
      });
    }
    if (seatKey !== playerKey) {
      return jsonResponse(403, {
        ok: false,
        rejectedReason: "SEAT_MISMATCH",
        snapshot: toPublicSnapshot(room, viewerSeatKey),
        stateVersion: room.stateVersion
      });
    }
    if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
      return jsonResponse(403, {
        ok: false,
        rejectedReason: "SEAT_TOKEN_MISMATCH",
        snapshot: toPublicSnapshot(room, null),
        stateVersion: room.stateVersion
      });
    }
    if (baseVersion === null || baseVersion !== room.stateVersion) {
      return jsonResponse(409, {
        ok: false,
        rejectedReason: "VERSION_MISMATCH",
        snapshot: toPublicSnapshot(room, seatKey),
        stateVersion: room.stateVersion
      });
    }
    const expectedPlayerKey = getCurrentPlayerKey(room.snapshot && room.snapshot.gameState);
    if (playerKey !== expectedPlayerKey) {
      return jsonResponse(409, {
        ok: false,
        rejectedReason: "OUT_OF_TURN",
        snapshot: toPublicSnapshot(room, seatKey),
        stateVersion: room.stateVersion
      });
    }
    if (!snapshot || typeof snapshot !== "object" || !snapshot.gameState || !snapshot.cardState) {
      return jsonResponse(400, {
        ok: false,
        rejectedReason: "INVALID_SNAPSHOT",
        snapshot: toPublicSnapshot(room, seatKey),
        stateVersion: room.stateVersion
      });
    }
    room.stateVersion += 1;
    const nextSnapshot = rehydrateSnapshotForPublish(room.snapshot, snapshot);
    nextSnapshot.stateVersion = room.stateVersion;
    nextSnapshot.updatedAt = Date.now();
    room.snapshot = nextSnapshot;
    room.updatedAt = nextSnapshot.updatedAt;
    await this.saveRoom();
    const meta = {
      playerKey,
      actionType: body.actionType ? String(body.actionType) : null,
      playbackEvents: Array.isArray(body.playbackEvents) ? body.playbackEvents : [],
      operationId: body.operationId ? String(body.operationId) : null
    };
    await this.broadcastSnapshot(meta);
    return jsonResponse(200, {
      ok: true,
      roomId: room.roomId,
      stateVersion: room.stateVersion,
      snapshot: toPublicSnapshot(room, seatKey)
    });
  }
  async handleState(urlObj) {
    await this.loadRoom();
    const room = this.room;
    if (!room) {
      return jsonResponse(404, { ok: false, reason: "ROOM_NOT_FOUND" });
    }
    const seatKey = parseSeatKeyOptional(urlObj && urlObj.searchParams ? urlObj.searchParams.get("seatKey") : null);
    const seatToken = String(urlObj && urlObj.searchParams ? urlObj.searchParams.get("seatToken") || "" : "").trim();
    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    if (!viewerSeatKey) {
      return jsonResponse(403, { ok: false, reason: seatToken ? "SEAT_TOKEN_MISMATCH" : "SEAT_TOKEN_REQUIRED" });
    }
    return jsonResponse(200, {
      ok: true,
      roomId: room.roomId,
      stateVersion: room.stateVersion,
      snapshot: toPublicSnapshot(room, viewerSeatKey)
    });
  }
  async handleStream(request) {
    await this.loadRoom();
    const room = this.room;
    if (!room) {
      return jsonResponse(404, { ok: false, reason: "ROOM_NOT_FOUND" });
    }
    const urlObj = new URL(request.url);
    const seatKey = parseSeatKeyOptional(urlObj.searchParams.get("seatKey") || "");
    const seatToken = String(urlObj.searchParams.get("seatToken") || "").trim();
    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    if (!viewerSeatKey) {
      return jsonResponse(403, { ok: false, reason: seatToken ? "SEAT_TOKEN_MISMATCH" : "SEAT_TOKEN_REQUIRED" });
    }
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    this.streamSeq += 1;
    const streamId = `sse_${this.streamSeq}_${Date.now()}`;
    this.streams.set(streamId, { writer, seatKey: viewerSeatKey });
    const onAbort = /* @__PURE__ */ __name(() => {
      this.closeStream(streamId).catch(() => {
      });
    }, "onAbort");
    try {
      if (request.signal && typeof request.signal.addEventListener === "function") {
        request.signal.addEventListener("abort", onAbort, { once: true });
      }
    } catch (e) {
    }
    const initialPayload = buildSnapshotPayload(room, { playbackEvents: [] }, viewerSeatKey);
    queueMicrotask(() => {
      this.sendSse(streamId, "snapshot", initialPayload).catch(() => {
        this.closeStream(streamId).catch(() => {
        });
      });
    });
    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        ...CORS_HEADERS
      }
    });
  }
  async fetch(request) {
    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname;
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method === "POST" && pathname === "/internal/create") {
      return this.handleInternalCreate(urlObj);
    }
    if (request.method === "POST" && pathname === "/api/match/join") {
      const parsed = parseJsonBody(await request.text());
      if (parsed === null) return jsonResponse(400, { ok: false, reason: "INVALID_JSON" });
      return this.handleJoin(parsed || {});
    }
    if (request.method === "POST" && pathname === "/api/match/leave") {
      const parsed = parseJsonBody(await request.text());
      if (parsed === null) return jsonResponse(400, { ok: false, reason: "INVALID_JSON" });
      return this.handleLeave(parsed || {});
    }
    if (request.method === "POST" && pathname === "/api/match/publish") {
      const parsed = parseJsonBody(await request.text());
      if (parsed === null) return jsonResponse(400, { ok: false, reason: "INVALID_JSON" });
      return this.handlePublish(parsed || {});
    }
    if (request.method === "GET" && pathname === "/api/match/state") {
      return this.handleState(urlObj);
    }
    if (request.method === "GET" && pathname === "/api/match/stream") {
      return this.handleStream(request);
    }
    return jsonResponse(404, { ok: false, reason: "NOT_FOUND" });
  }
};
var match_worker_default = {
  async fetch(request, env2) {
    const urlObj = new URL(request.url);
    if (urlObj.pathname.startsWith("/api/match/")) {
      return handleMatchApi(request, env2);
    }
    if (env2.ASSETS && typeof env2.ASSETS.fetch === "function") {
      return env2.ASSETS.fetch(request);
    }
    return new Response("Not Found", { status: 404 });
  }
};

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-SrNEQW/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = match_worker_default;

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-SrNEQW/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  MatchRoomDurableObject,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=match-worker.js.map
