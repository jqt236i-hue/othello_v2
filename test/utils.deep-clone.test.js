const deepClone = require('../utils/deepClone');

describe('deepClone', () => {
  test('falls back to JSON clone when structuredClone rejects function-valued helpers', () => {
    const originalStructuredClone = globalThis.structuredClone;
    globalThis.structuredClone = () => {
      const error = new Error('cannot clone helper functions');
      error.name = 'DataCloneError';
      throw error;
    };

    try {
      const source = {
        keep: { row: 2, col: 3 },
        meta: {
          owner: 'black',
          random: {
            shuffle: (array) => array,
            random: () => 0.5
          }
        }
      };

      const cloned = deepClone(source);

      expect(cloned).toEqual({
        keep: { row: 2, col: 3 },
        meta: {
          owner: 'black',
          random: {}
        }
      });
      expect(cloned).not.toBe(source);
      expect(cloned.keep).not.toBe(source.keep);
    } finally {
      globalThis.structuredClone = originalStructuredClone;
    }
  });
});
