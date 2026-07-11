type PresenceToastOptions = {
  getDocument: () => any;
  scheduleTimeout: (callback: () => void, ms: number) => any;
  clearTimeout: (handle: any) => void;
  toastId: string;
  visibleMs: number;
  fadeMs: number;
};

function createNetworkPresenceToastController(options: PresenceToastOptions) {
  let hideTimer: any = 0;
  let clearTimer: any = 0;

  const getDocument = () => {
    try {
      const doc = options.getDocument();
      return doc && doc.body ? doc : null;
    } catch (e) { return null; }
  };
  const getToast = () => {
    const doc = getDocument();
    return doc && typeof doc.getElementById === 'function' ? doc.getElementById(options.toastId) : null;
  };
  const ensureToast = () => {
    const doc = getDocument();
    if (!doc || !doc.body || typeof doc.createElement !== 'function') return null;
    const existing = getToast();
    if (existing) return existing;
    const toast = doc.createElement('div');
    toast.id = options.toastId;
    toast.className = 'network-presence-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    toast.setAttribute('aria-hidden', 'true');
    const rail = doc.createElement('span');
    rail.className = 'network-presence-toast__rail';
    rail.setAttribute('aria-hidden', 'true');
    toast.appendChild(rail);
    const text = doc.createElement('span');
    text.className = 'network-presence-toast__text';
    toast.appendChild(text);
    doc.body.appendChild(toast);
    return toast;
  };
  const clearTimers = () => {
    if (hideTimer) options.clearTimeout(hideTimer);
    if (clearTimer) options.clearTimeout(clearTimer);
    hideTimer = 0;
    clearTimer = 0;
  };
  const hide = () => {
    hideTimer = 0;
    const toast = getToast();
    if (!toast) return;
    toast.classList.add('is-hiding');
    clearTimer = options.scheduleTimeout(() => {
      clearTimer = 0;
      const current = getToast();
      if (!current) return;
      current.classList.remove('is-visible', 'is-hiding', 'is-join', 'is-leave');
      current.setAttribute('aria-hidden', 'true');
    }, options.fadeMs);
  };
  return {
    show(message: any, kind: any) {
      const textValue = String(message || '').trim();
      if (!textValue) return false;
      const toast = ensureToast();
      if (!toast) return false;
      clearTimers();
      const text = typeof toast.querySelector === 'function' ? toast.querySelector('.network-presence-toast__text') : null;
      if (text) text.textContent = textValue;
      else toast.textContent = textValue;
      toast.classList.remove('is-visible', 'is-hiding', 'is-join', 'is-leave');
      toast.classList.add(String(kind || '') === 'leave' ? 'is-leave' : 'is-join');
      toast.setAttribute('aria-hidden', 'false');
      try { void toast.offsetWidth; } catch (e) { /* ignore */ }
      toast.classList.add('is-visible');
      hideTimer = options.scheduleTimeout(hide, options.visibleMs);
      return true;
    },
    clear: clearTimers
  };
}

export = { createNetworkPresenceToastController };
