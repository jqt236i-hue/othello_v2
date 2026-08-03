import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

function bindDynamicBubbleRect(element) {
  element.getBoundingClientRect = () => {
    const maxWidth = Number.parseFloat(element.style.maxWidth) || 420;
    const contentWidth = Math.max(140, Math.ceil(String(element.textContent || '').length * 7.2) + 24);
    const width = Math.min(maxWidth, contentWidth);
    const height = 62;
    const centerX = Number.parseFloat(element.style.left) || 0;
    const bottom = Number.parseFloat(element.style.top) || 0;
    return {
      left: centerX - (width / 2),
      top: bottom - height,
      right: centerX + (width / 2),
      bottom,
      width,
      height
    };
  };
}

function setupPortraitBubbleDom() {
  const dom = new JSDOM(
    '<!doctype html><html><body>' +
    '<div id="board-frame"></div>' +
    '<div id="cpu-character-panel"></div>' +
    '<img id="cpu-character-img" />' +
    '<div id="hero-character-panel"></div>' +
    '<img id="hero-character-img" />' +
    '</body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' }
  );

  const { window } = dom;
  const boardFrame = window.document.getElementById('board-frame');
  const heroImg = window.document.getElementById('hero-character-img');
  const cpuImg = window.document.getElementById('cpu-character-img');
  const nativeAppendChild = window.document.body.appendChild.bind(window.document.body);

  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });

  heroImg.setAttribute('src', 'hero.png');
  cpuImg.setAttribute('src', 'cpu.png');

  boardFrame.getBoundingClientRect = () => ({
    left: 356,
    top: 110,
    width: 404,
    height: 404,
    right: 760,
    bottom: 514
  });
  heroImg.getBoundingClientRect = () => ({
    left: 90,
    top: 590,
    width: 210,
    height: 140,
    right: 300,
    bottom: 730
  });
  cpuImg.getBoundingClientRect = () => ({
    left: 812,
    top: 70,
    width: 140,
    height: 140,
    right: 952,
    bottom: 210
  });

  window.document.body.appendChild = (node) => {
    if (node && (node.id === 'cpu-speech-bubble' || node.id === 'hero-speech-bubble')) {
      bindDynamicBubbleRect(node);
    }
    return nativeAppendChild(node);
  };

  global.window = window;
  global.document = window.document;
  jest.resetModules();
  const statusDisplay = require(path.join(__dirname, '..', 'ui', 'status-display.js'));
  window.showCpuSpeechBubble = statusDisplay.showCpuSpeechBubble;
  window.showHeroSpeechBubble = statusDisplay.showHeroSpeechBubble;

  return { dom, window, boardFrame };
}

function teardownPortraitBubbleDom(dom) {
  delete global.window;
  delete global.document;
  if (dom && dom.window) dom.window.close();
}

describe('status-display portrait commentary bubbles', () => {
  test('cpu speech bubble uses premium portrait-callout styling', () => {
    const cssPath = path.join(__dirname, '..', 'styles-layout-characters.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/#cpu-speech-bubble[\s\S]*clip-path:\s*polygon\(/);
    expect(css).toMatch(/#cpu-speech-bubble[\s\S]*backdrop-filter:\s*blur/);
    expect(css).toMatch(/#cpu-speech-bubble[\s\S]*--portrait-speech-accent/);
    expect(css).toMatch(/#cpu-speech-bubble::before[\s\S]*linear-gradient\(90deg,\s*transparent,\s*rgba\(242,\s*201,\s*95/);
    expect(css).toMatch(/#cpu-speech-bubble[\s\S]*rgba\(26,\s*21,\s*16,\s*0\.62\)/);
    expect(css).toMatch(/#cpu-speech-bubble::after[\s\S]*border-top-color:\s*rgba\(26,\s*21,\s*16,\s*0\.62\)/);
    expect(css).toMatch(/#cpu-speech-bubble\.is-visible[\s\S]*animation:\s*portrait-speech-enter/);
  });

  test('showPortraitSpeechBubble only resets the same speaker role', () => {
    const jsPath = path.join(__dirname, '..', 'ui', 'status-display.ts');
    const js = fs.readFileSync(jsPath, 'utf8');

    expect(js).toMatch(/function\s+showPortraitSpeechBubble[\s\S]*hidePortraitSpeechBubble\(config\.role\);/);
    expect(js).not.toMatch(/function\s+showPortraitSpeechBubble[\s\S]*hidePortraitSpeechBubble\(\);/);
  });

  test('caps desktop cpu portrait bubble width for tighter character callouts', () => {
    const jsPath = path.join(__dirname, '..', 'ui', 'status-display.ts');
    const js = fs.readFileSync(jsPath, 'utf8');

    expect(js).toMatch(/return\s+Math\.min\(Math\.floor\(viewportWidth\s*\*\s*0\.38\),\s*360\);/);
    expect(js).not.toMatch(/return\s+Math\.min\(Math\.floor\(viewportWidth\s*\*\s*0\.46\),\s*420\);/);
  });

  test('keeps cpu portrait bubble outside the board on tablet widths', () => {
    const { dom, window, boardFrame } = setupPortraitBubbleDom();
    try {
      const line = 'よし、言っとくけど盤面の機嫌がこっち向いてる。このくらいなら片手で読めるし、このまま先回りして終わらせる。';
      const boardRect = boardFrame.getBoundingClientRect();

      window.showCpuSpeechBubble(line);
      const cpuBubble = window.document.getElementById('cpu-speech-bubble');
      expect(cpuBubble).not.toBeNull();
      expect(cpuBubble.getBoundingClientRect().left).toBeGreaterThanOrEqual(boardRect.right + 12);
    } finally {
      teardownPortraitBubbleDom(dom);
    }
  });

  test('shows hero speech bubble anchored to the hero portrait without clearing cpu bubble', () => {
    const { dom, window } = setupPortraitBubbleDom();
    try {
      window.showCpuSpeechBubble('相手の発言');
      window.showHeroSpeechBubble('自分の発言');

      const cpuBubble = window.document.getElementById('cpu-speech-bubble');
      const heroBubble = window.document.getElementById('hero-speech-bubble');

      expect(cpuBubble).not.toBeNull();
      expect(heroBubble).not.toBeNull();
      expect(cpuBubble.textContent).toBe('相手の発言');
      expect(heroBubble.textContent).toBe('自分の発言');
      expect(cpuBubble.classList.contains('is-visible')).toBe(true);
      expect(heroBubble.classList.contains('is-visible')).toBe(true);
      expect(heroBubble.getBoundingClientRect().right).toBeLessThan(520);
    } finally {
      teardownPortraitBubbleDom(dom);
    }
  });

  test('skips hidden portrait bubble layout reads on phone portrait', () => {
    const { dom, window, boardFrame } = setupPortraitBubbleDom();
    try {
      window.document.documentElement.classList.add('layout-profile-phone-portrait');
      const cpuImg = window.document.getElementById('cpu-character-img');
      const boardRectSpy = jest.spyOn(boardFrame, 'getBoundingClientRect');
      const anchorRectSpy = jest.spyOn(cpuImg, 'getBoundingClientRect');

      window.showCpuSpeechBubble('非表示中の発言');

      const cpuBubble = window.document.getElementById('cpu-speech-bubble');
      expect(cpuBubble).not.toBeNull();
      expect(cpuBubble.textContent).toBe('非表示中の発言');
      expect(cpuBubble.classList.contains('is-visible')).toBe(true);
      expect(boardRectSpy).not.toHaveBeenCalled();
      expect(anchorRectSpy).not.toHaveBeenCalled();
    } finally {
      teardownPortraitBubbleDom(dom);
    }
  });
});
