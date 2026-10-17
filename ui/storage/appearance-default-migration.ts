/** One-time adoption of the product's standard appearance, before skin restoration. */
const STANDARD_APPEARANCE_VERSION_KEY = 'reversi.appearance.standardVersion';
const STANDARD_APPEARANCE_VERSION = 'study-ebony-jade-v1';
const STANDARD_APPEARANCE = Object.freeze({
  handSkin: 'default',
  backgroundSkin: 'desk-quiet-fantasy',
  boardSkin: 'study-forest-baize',
  boardFrameSkin: 'study-ebony-jade',
  handMatSkin: 'midnight-bookcloth',
  fontSkin: 'shippori-mincho',
  stoneSkin: 'o-stone'
});

function migrateStandardAppearance(root: { localStorage?: Storage } | null | undefined): boolean {
  try {
    const storage = root && root.localStorage;
    if (!storage || storage.getItem(STANDARD_APPEARANCE_VERSION_KEY) === STANDARD_APPEARANCE_VERSION) return false;
    const fields = Object.keys(STANDARD_APPEARANCE) as Array<keyof typeof STANDARD_APPEARANCE>;
    const hasSavedAppearance = fields.some((field) =>
      storage.getItem(`reversi.${field}`) !== null || storage.getItem(`othello.${field}`) !== null);
    if (hasSavedAppearance) {
      // Both namespaces must change together: older clients can have only the legacy keys.
      for (const field of fields) {
        storage.setItem(`reversi.${field}`, STANDARD_APPEARANCE[field]);
        storage.setItem(`othello.${field}`, STANDARD_APPEARANCE[field]);
      }
    }
    // Mark new installs too, so a later intentional skin choice survives the next boot.
    // Store this last: interrupted/failed migrations can safely retry next time.
    storage.setItem(STANDARD_APPEARANCE_VERSION_KEY, STANDARD_APPEARANCE_VERSION);
    return true;
  } catch (e) {
    // Storage-disabled browsers still boot with the catalog defaults.
    return false;
  }
}

export = {
  STANDARD_APPEARANCE_VERSION_KEY,
  STANDARD_APPEARANCE_VERSION,
  STANDARD_APPEARANCE,
  migrateStandardAppearance
};
