import * as fs from 'fs';
import * as path from 'path';

describe('retired card source references', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const sourceFiles = [
    'cards/card-interaction-effects.ts',
    'game/ai/cpu-policy-card-type-flags.ts',
    'game/ai/cpu-policy-card-use-decision.ts',
    'game/ai/cpu-policy-core.ts',
    'game/ai/cpu-policy-retention-score.ts',
    'game/visual-effects-map.ts'
  ];

  test('legacy retired observer/theory implementation hooks do not remain in active card source', () => {
    const retiredTokens = [
      'OBSERVER_WILL_TURNS',
      'THEORY_INCARNATION_TURNS',
      'processObserverWillEffectsAtTurnStartAnchor',
      'processTheoryIncarnationEffectsAtTurnStartAnchor',
      'isTheoryIncarnation'
    ];

    const violations = sourceFiles.flatMap((relativePath) => {
      const absolutePath = path.join(repoRoot, relativePath);
      const text = fs.readFileSync(absolutePath, 'utf8');
      return retiredTokens
        .filter((token) => text.includes(token))
        .map((token) => `${relativePath}: ${token}`);
    });

    expect(violations).toEqual([]);
  });

  test('legacy theory auto-end wording does not remain in active docs and focused tests', () => {
    const retiredTokens = [
      'theory_auto_end',
      'theory_incarnation_auto_turn_end',
      '_theoryIncarnationAutoTurnEndByPlayer',
      '_theoryIncarnationPendingAutoExpireByPlayer',
      'finalizeTheoryIncarnationAutoTurnEndExpiration',
      'consumeTheoryIncarnationAutoTurnEnd',
      '自ターン開始時に理論数字',
      'ターン開始時に理論数字',
      '所有者ターン開始時の出現',
      'そのままターンを終了する',
      'カード使用も石配置もできない',
      'theory placement lock'
    ];
    const scanTargets = [
      '01-rulebook.md',
      'docs/Card_Strategy_Full_Catalog.md',
      '正本/カード仕様正本.md',
      '正本/演出正本.md',
      '正本/効果音対応表.md',
      'cards/card-interaction-effects.ts',
      'test/game.network-turn-handoff.test.ts',
      'test/ui.pass-stale-busy.test.ts',
      'test/cpu.turn-handler.programmed-card-policy.test.ts'
    ];

    const violations = scanTargets.flatMap((relativePath) => {
      const absolutePath = path.join(repoRoot, relativePath);
      const text = fs.readFileSync(absolutePath, 'utf8');
      return retiredTokens
        .filter((token) => text.includes(token))
        .map((token) => `${relativePath}: ${token}`);
    });

    expect(violations).toEqual([]);
  });

  test('hyperactive inherit identifiers do not remain in active source and specs', () => {
    const retiredTokens = [
      'hyperactive_inherit_01',
      'HYPERACTIVE_INHERIT_WILL',
      'INHERITED_HYPERACTIVE',
      'hyperactiveInheritTarget',
      'hyperactive_inherit',
      'hyperactive_inherit_selected',
      'inherited_hyperactive',
      'inherited-hyperactive',
      '継承多動',
      '多動の継承'
    ];
    const scanTargets = [
      '01-rulebook.md',
      'cards',
      'game',
      'shared',
      'ui',
      'workers',
      'test',
      '正本'
    ];
    const ignoredPaths = [
      `${path.sep}node_modules${path.sep}`,
      `${path.sep}dist${path.sep}`,
      `${path.sep}worker-public${path.sep}`,
      `${path.sep}docs${path.sep}archive${path.sep}`,
      path.join('docs', 'superpowers', 'plans', '2026-06-04-remove-hyperactive-inherit-will-plan.md'),
      path.join('test', 'retired-card-references.test.ts')
    ];

    const walk = (relativePath: string): string[] => {
      const absolutePath = path.join(repoRoot, relativePath);
      if (!fs.existsSync(absolutePath)) return [];
      const stat = fs.statSync(absolutePath);
      if (stat.isFile()) return [absolutePath];
      return fs.readdirSync(absolutePath).flatMap((entry) => walk(path.join(relativePath, entry)));
    };

    const isScannable = (absolutePath: string): boolean => {
      if (ignoredPaths.some((ignoredPath) => absolutePath.includes(ignoredPath))) return false;
      return /\.(ts|js|json|md|html|css)$/.test(absolutePath);
    };

    const violations = scanTargets
      .flatMap((target) => walk(target))
      .filter(isScannable)
      .flatMap((absolutePath) => {
        const relativePath = path.relative(repoRoot, absolutePath);
        const text = fs.readFileSync(absolutePath, 'utf8');
        return retiredTokens
          .filter((token) => text.includes(token))
          .map((token) => `${relativePath}: ${token}`);
      });

    expect(violations).toEqual([]);
  });
});
