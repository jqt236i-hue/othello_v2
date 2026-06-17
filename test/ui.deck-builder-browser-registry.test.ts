import fs from 'fs';
import path from 'path';

describe('deck builder browser registry', () => {
  const registryPaths = [
    'public/module-registry.js',
    'worker-public/public/module-registry.js'
  ];

  test.each(registryPaths)('%s includes the six-slot deck preset build', (relativePath) => {
    const registry = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

    expect(registry).toContain('6つまで保存できます');
    expect(registry).toContain('const PRESET_LIMIT = 6');
    expect(registry).toContain("'preset_6'");
    expect(registry).not.toContain('3つまで保存できます');
    expect(registry).not.toContain('const PRESET_LIMIT = 3');
  });
});
