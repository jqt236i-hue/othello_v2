function resolveDocument(docRef?: any): any {
  if (docRef && typeof docRef.createElement === 'function') return docRef;
  try {
    if (typeof document !== 'undefined') return document;
  } catch (e: any) { /* ignore */ }
  return null;
}

async function copyTextToClipboard(rootRef: any, docRef: any, value: any): Promise<boolean> {
  const text = String(value || '');
  if (!text) return false;

  try {
    if (
      rootRef &&
      rootRef.navigator &&
      rootRef.navigator.clipboard &&
      typeof rootRef.navigator.clipboard.writeText === 'function'
    ) {
      await rootRef.navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e: any) { /* ignore and fall back */ }

  try {
    const doc = resolveDocument(docRef);
    if (!doc || !doc.body || typeof doc.createElement !== 'function') {
      return false;
    }
    const hidden = doc.createElement('textarea');
    hidden.value = text;
    hidden.setAttribute('readonly', 'readonly');
    hidden.style.position = 'fixed';
    hidden.style.left = '-9999px';
    hidden.style.top = '0';
    hidden.style.opacity = '0';
    doc.body.appendChild(hidden);
    hidden.focus();
    hidden.select();
    if (typeof hidden.setSelectionRange === 'function') {
      hidden.setSelectionRange(0, hidden.value.length);
    }
    const copied = (typeof doc.execCommand === 'function') ? doc.execCommand('copy') : false;
    doc.body.removeChild(hidden);
    return copied === true;
  } catch (e: any) {
    return false;
  }
}

const MatchModeNetworkClipboard = {
  copyTextToClipboard
};

export = MatchModeNetworkClipboard;
