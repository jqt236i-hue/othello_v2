const LEADERBOARD_STYLESHEET_ATTR = 'data-leaderboard-styles';
const LEADERBOARD_STYLESHEET_HREF = 'styles-leaderboard.css';

function resolveDocument(docRef?: any): any {
  if (docRef && docRef.head && typeof docRef.createElement === 'function') return docRef;
  try {
    if (typeof document !== 'undefined') return document;
  } catch (e: any) { /* ignore */ }
  return null;
}

function ensureLeaderboardStylesheet(docRef?: any): void {
  try {
    const doc = resolveDocument(docRef);
    if (!doc || !doc.head) return;
    const existing = doc.querySelector(`link[${LEADERBOARD_STYLESHEET_ATTR}="true"]`);
    if (existing) return;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEADERBOARD_STYLESHEET_HREF;
    link.setAttribute(LEADERBOARD_STYLESHEET_ATTR, 'true');
    doc.head.appendChild(link);
  } catch (e: any) { /* ignore */ }
}

const MatchModeLeaderboardStyles = {
  ensureLeaderboardStylesheet
};

export = MatchModeLeaderboardStyles;
