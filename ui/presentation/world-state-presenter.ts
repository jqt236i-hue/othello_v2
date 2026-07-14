function createWorldStatePresenter() {
  let timeStopPausedBgm = false;
  return Object.freeze({
    presentTimeStop(options: {
      active: boolean;
      document?: Document | null;
      soundEngine?: any;
      isBgmPlaying?: (engine: any) => boolean;
    }) {
      const active = options.active === true;
      const soundEngine = options.soundEngine;
      if (soundEngine && typeof soundEngine.pauseBgm === 'function' && typeof soundEngine.playBgm === 'function') {
        if (active && !timeStopPausedBgm && (!options.isBgmPlaying || options.isBgmPlaying(soundEngine))) {
          try {
            soundEngine.pauseBgm();
            timeStopPausedBgm = true;
          } catch (e) { /* presentation only */ }
        } else if (!active && timeStopPausedBgm) {
          timeStopPausedBgm = false;
          try { soundEngine.playBgm(); } catch (e) { /* presentation only */ }
        }
      } else if (!active) {
        timeStopPausedBgm = false;
      }
      const documentValue = options.document;
      documentValue?.documentElement?.classList.toggle('time-stop-active', active);
      documentValue?.body?.classList.toggle('time-stop-active', active);
    },
    presentManifest(options: {
      cardState: unknown;
      syncWorldEffects: (cardState: unknown) => void;
      syncEffectPanel: (cardState: unknown) => void;
    }) {
      options.syncWorldEffects(options.cardState);
      options.syncEffectPanel(options.cardState);
    }
  });
}

export = { createWorldStatePresenter };
