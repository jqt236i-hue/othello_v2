import { spawn, spawnSync, type ChildProcessByStdio } from 'child_process';
import * as path from 'path';
import type { Readable } from 'stream';
import { chromium, type Browser, type Page } from 'playwright';

const ROOT = path.resolve(__dirname, '..');
const SERVER_READY_PATTERN = /\[serve\] root=(.+?) host=(\S+) port=(\d+)/;
const COMMONJS_REFERENCE_PATTERN = /\b(module|require) is not defined\b/i;
const KNOWN_BROWSER_ENV_ERROR_PATTERNS = [
  /\[W:onnxruntime:.*Unknown CPU vendor/i,
  /No available adapters/i,
  /WebGPU.*provider/i,
  /module is not defined/i
];

interface ServeReady {
  port: number;
  stdout: () => string;
  stderr: () => string;
}

interface CapturedMessage {
  source: string;
  text: string;
}

function isKnownBrowserEnvironmentError(text: unknown): boolean {
  return KNOWN_BROWSER_ENV_ERROR_PATTERNS.some((pattern) => pattern.test(String(text || '')));
}

function serveCommand(): { command: string; args: string[]; detached: boolean } {
  const serveArgs = ['run', 'serve', '--', 'worker-public', '--host', '127.0.0.1', '--port', '0', '--max-attempts', '0'];
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `npm ${serveArgs.join(' ')}`],
      detached: false
    };
  }
  return { command: 'npm', args: serveArgs, detached: true };
}

type SmokeChildProcess = ChildProcessByStdio<null, Readable, Readable>;

function stopProcessTree(child: SmokeChildProcess): void {
  if (!child || !child.pid || child.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    try {
      child.kill('SIGTERM');
    } catch (fallbackError) {
      // Best-effort cleanup only after the smoke result is already known.
    }
  }
}

function startServe(): { child: SmokeChildProcess; ready: Promise<ServeReady> } {
  const launch = serveCommand();
  const child = spawn(launch.command, launch.args, {
    cwd: ROOT,
    detached: launch.detached,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  const ready = new Promise<ServeReady>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`serve did not report a port before timeout\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 20000);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`serve exited before ready: code=${code} signal=${signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const match = stdout.match(SERVER_READY_PATTERN);
      if (!match) return;
      clearTimeout(timeout);
      const root = path.resolve(match[1]);
      const port = Number(match[3]);
      if (!root.endsWith(`${path.sep}worker-public`) || !Number.isInteger(port) || port <= 0) {
        reject(new Error(`unexpected serve target: root=${root} port=${match[3]}`));
        return;
      }
      resolve({ port, stdout: () => stdout, stderr: () => stderr });
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
  });

  return { child, ready };
}

function formatMessages(messages: CapturedMessage[]): string {
  return messages.map((message) => `- [${message.source}] ${message.text}`).join('\n');
}

async function openPage(browser: Browser, route: string, description: string, validate: (page: Page) => Promise<void>): Promise<void> {
  const messages: CapturedMessage[] = [];
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (message) => {
    messages.push({ source: `console:${message.type()}`, text: message.text() });
  });
  page.on('pageerror', (error) => {
    messages.push({ source: 'pageerror', text: error && error.message ? error.message : String(error) });
  });

  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await validate(page);
  await page.waitForTimeout(500);

  const commonjsErrors = messages.filter((message) => COMMONJS_REFERENCE_PATTERN.test(message.text) && !isKnownBrowserEnvironmentError(message.text));
  if (commonjsErrors.length) {
    throw new Error(`${description} loaded CommonJS wrapper ReferenceErrors:\n${formatMessages(commonjsErrors)}`);
  }

  const blockingErrors = messages.filter((message) => {
    if (isKnownBrowserEnvironmentError(message.text)) return false;
    return message.source === 'pageerror' || message.source === 'console:error';
  });
  if (blockingErrors.length) {
    throw new Error(`${description} reported startup console errors:\n${formatMessages(blockingErrors)}`);
  }

  await page.close();
}

async function validateGamePage(page: Page): Promise<void> {
  console.log('[smoke] waiting for #board...');
  await page.waitForSelector('#board', { state: 'visible', timeout: 15000 });
  console.log('[smoke] #board visible, checking board size...');
  const boardRect = await page.evaluate(() => {
    const board = document.querySelector('#board');
    return board ? board.getBoundingClientRect() : null;
  });
  if (!boardRect || boardRect.width < 100 || boardRect.height < 100) {
    throw new Error(`#board too small: ${JSON.stringify(boardRect)}`);
  }
  console.log('[smoke] board size OK, checking text...');

  const mojibakePattern = /縺|繧|螟|蜍|謇|闔|髫|譁|莨|繝|�/;
  const htmlFragmentPattern = /<\/(?:button|div|span)>|(?:^|\s)(?:alt|class|id)=["']?/;
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('[smoke] bodyText sample:', bodyText.substring(0, 200));
  if (mojibakePattern.test(bodyText)) {
    throw new Error('Game page body text contains mojibake');
  }
  if (htmlFragmentPattern.test(bodyText)) {
    throw new Error('Game page body text contains HTML fragments');
  }
  console.log('[smoke] text checks passed');

  const sidePanel = page.locator('#side-panel');
  await sidePanel.waitFor({ state: 'attached', timeout: 10000 });
  console.log('[smoke] #side-panel attached');

  const autoToggleBtn = page.locator('#autoToggleBtn');
  await autoToggleBtn.waitFor({ state: 'visible', timeout: 10000 });
  const autoText = await autoToggleBtn.innerText();
  if (!autoText.includes('AUTO')) {
    throw new Error(`#autoToggleBtn does not show AUTO status: "${autoText}"`);
  }
  console.log('[smoke] #autoToggleBtn OK');

  const requiredTexts = [
    '\u30AB\u30FC\u30C9\u30AA\u30BB\u30ED',
    '\u76E4\u55B0\u3044\u306E\u5C0F\u9B3C',
    '\u30AA\u30BB\u30ED\u306E\u52C7\u8005',
    '\u30AC\u30C1\u30E3',
    '\u30E9\u30F3\u30AD\u30F3\u30B0',
    '\u30C7\u30C3\u30AD',
    'help',
    'SKIN'
  ];
  for (const text of requiredTexts) {
    if (!bodyText.includes(text)) {
      throw new Error(`Required text not found in page body: ${text}`);
    }
  }
  console.log('[smoke] required texts OK');

  const resetButton = page.locator('#resetBtn');
  await resetButton.waitFor({ state: 'visible', timeout: 10000 });
  console.log('[smoke] clicking reset...');
  await resetButton.click({ timeout: 10000 });
  await page.waitForTimeout(2000);
  const boardAfterReset = await page.evaluate(() => {
    const board = document.querySelector('#board');
    return board ? board.getBoundingClientRect() : null;
  });
  if (!boardAfterReset || boardAfterReset.width < 100 || boardAfterReset.height < 100) {
    throw new Error(`#board too small after reset: ${JSON.stringify(boardAfterReset)}`);
  }
  console.log('[smoke] reset OK');
}

(async () => {
  const server = startServe();
  let browser: Browser | undefined;
  try {
    const { port } = await server.ready;
    const baseUrl = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ headless: true });
    await openPage(browser, `${baseUrl}/?debug=1`, 'worker-public/index.html', validateGamePage);
    console.log(`[browser-smoke] success ${baseUrl}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    stopProcessTree(server.child);
  }
})().catch((error) => {
  console.error('[browser-smoke] failed:', error && error.message ? error.message : error);
  process.exit(1);
});
