import * as FeatureStylesheetLoader from '../../assets/feature-stylesheet-loader';

function resolveDocument(docRef?: any): any {
  if (docRef && docRef.head && typeof docRef.createElement === 'function') return docRef;
  try {
    if (typeof document !== 'undefined') return document;
  } catch (e: any) { /* ignore */ }
  return null;
}

function ensureLeaderboardStylesheet(docRef?: any): Promise<any> {
  try {
    const doc = resolveDocument(docRef);
    return FeatureStylesheetLoader.ensureFeatureStylesheet('leaderboard', doc);
  } catch (e: any) {
    return Promise.resolve({ ok: false, group: 'leaderboard', href: '', warning: String(e && e.message || e) });
  }
}

const MatchModeLeaderboardStyles = {
  ensureLeaderboardStylesheet
};

export = MatchModeLeaderboardStyles;
