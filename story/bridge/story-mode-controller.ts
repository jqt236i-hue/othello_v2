import { prologueStory } from '../content/chapters/prologue.story';
import { storyAssets } from '../content/story-assets';
import { storyBattleStages } from '../content/story-battle-stages';
import { storyDeckPresets } from '../content/story-deck-presets';
import { StoryAudio } from '../ui/story-audio';
import { StoryScreen } from '../ui/story-screen';
import { createStoryBaseBgmSession } from './story-base-bgm-session';
import { createMockStoryBattleHost, StoryBattleBridge } from './story-battle-bridge';
import type { StoryHost } from './story-host';
import { createStoryRealBattleHost } from './story-real-battle-host';

export type StoryModeControllerOptions = {
  root: HTMLElement;
  openButton?: HTMLElement | null;
  battleHost?: StoryHost;
  allowMockBattleHost?: boolean;
};

export type StoryModeController = {
  start: () => void;
  close: () => void;
  isOpen: () => boolean;
};

export function createStoryModeController(options: StoryModeControllerOptions): StoryModeController {
  let screen: StoryScreen | null = null;
  const doc = options.root.ownerDocument;
  const rootScope = globalThis as any;
  const host = options.battleHost ?? createDefaultStoryBattleHost(rootScope, options.allowMockBattleHost === true);
  const battleBridge = new StoryBattleBridge({
    stages: storyBattleStages,
    host
  });
  const baseBgmSession = createStoryBaseBgmSession(rootScope);
  let open = false;

  function start(): void {
    baseBgmSession.enterStoryMode();
    setRootVisible(true);
    if (!screen) {
      screen = new StoryScreen({
        root: options.root,
        scenario: prologueStory,
        assets: storyAssets,
        audio: new StoryAudio({ assets: storyAssets }),
        onClose: () => close(),
        onBattle: (step) => {
          const activeScreen = screen;
          setRootVisible(false);
          void battleBridge.start(step.battle).then((result) => {
            if (screen === activeScreen) {
              setRootVisible(true);
              screen?.resumeFromBattle(result);
            }
          }).catch((error) => {
            if (screen === activeScreen) {
              setRootVisible(true);
            }
            console.error('[story] battle bridge failed:', error);
          });
        }
      });
    }
    open = true;
    screen.start();
  }

  function close(): void {
    if (screen) {
      screen.destroy();
      screen = null;
    }
    setRootVisible(false);
    baseBgmSession.leaveStoryMode();
    open = false;
  }

  function setRootVisible(visible: boolean): void {
    options.root.hidden = !visible;
    options.root.setAttribute('aria-hidden', visible ? 'false' : 'true');
    options.openButton?.setAttribute('aria-expanded', visible ? 'true' : 'false');
    setStoryModeActive(doc, visible);
  }

  options.openButton?.addEventListener('click', () => {
    if (open) {
      close();
      return;
    }
    start();
  });

  return {
    start,
    close,
    isOpen: () => open
  };
}

function setStoryModeActive(doc: Document, active: boolean): void {
  doc.body?.classList.toggle('story-mode-active', active);
}

function createDefaultStoryBattleHost(rootScope: any, allowMockBattleHost: boolean): StoryHost {
  if (typeof rootScope.resetGame === 'function') {
    return createStoryRealBattleHost({
      root: rootScope,
      stages: storyBattleStages,
      deckPresets: storyDeckPresets
    });
  }
  if (allowMockBattleHost) {
    return createMockStoryBattleHost('win');
  }
  return {
    startBattle(request) {
      return Promise.reject(new Error(`resetGame is required to start story battle: ${request.stageId}`));
    }
  };
}

export function initStoryModeBrowser(doc: Document = document): StoryModeController | null {
  const root = doc.getElementById('story-root');
  if (!root) return null;
  const openButton = doc.getElementById('storyModeOpenBtn');
  const controller = createStoryModeController({ root, openButton });
  (globalThis as any).StoryModeController = controller;
  return controller;
}
