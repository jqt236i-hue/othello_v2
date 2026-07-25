#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.html', '.css',
  '.scss', '.yaml', '.yml', '.py', '.ps1', '.bat', '.txt', '.toml'
]);

const SURFACES = {
  command: {
    description: 'action schema, command runtime, canonical command planning',
    patterns: [
      /^shared\/network-action-schema\./u,
      /^utils\/match-command-/u,
      /^utils\/match-auto-command\./u,
      /^game\/cpu-network-command-planner\./u,
      /^workers\/match-worker(\.ts|-publish-controller\.ts)$/u,
      /^scripts\/local-match-server\.ts$/u,
      /match-command-runtime/u,
      /network-command-payload/u
    ],
    anchors: [
      'shared/network-action-schema.ts',
      'utils/match-command-runtime.ts',
      'utils/match-publish-controller.ts',
      'workers/match-worker.ts',
      'scripts/local-match-server.ts'
    ]
  },
  publish: {
    description: 'client publish shaping, tracking, idempotency, authority acceptance',
    patterns: [
      /(^|\/)match-publish-/u,
      /^workers\/match-worker(\.ts|-publish-controller\.ts)$/u,
      /^scripts\/local-match-server\.ts$/u,
      /^utils\/match-authority\/(operations|publish)\./u,
      /^ui\/network\/(publish-|command-payload|action-bridge)/u,
      /publish-(contract|idempotency|sanitize|base-version|tracker|request|flow|rejection)/u
    ],
    anchors: [
      'utils/match-publish-controller.ts',
      'ui/network/publish-flow.ts',
      'ui/network/publish-request.ts',
      'ui/network/publish-tracker.ts',
      'ui/network/command-payload.ts',
      'workers/match-worker.ts',
      'scripts/local-match-server.ts'
    ]
  },
  intake: {
    description: 'snapshot envelope, canonical inspection, cross-transport intake, apply',
    patterns: [
      /^ui\/network\/(intake-|snapshot|apply-coordinator)/u,
      /network-(intake|snapshot-canonical)/u,
      /network-client\.(apply-coordinator|result-sync|reconnect-sync)/u
    ],
    anchors: [
      'ui/network/intake-envelope.ts',
      'ui/network/intake-coordinator.ts',
      'ui/network/snapshot-canonical.ts',
      'ui/network/snapshot.ts',
      'ui/network/apply-coordinator.ts'
    ]
  },
  session: {
    description: 'room/session identity, epoch guards, reconnect, transport lifecycle',
    patterns: [
      /^ui\/network\/(session-|reconnect-controller|stream-session|transport)/u,
      /network-client\.(leave-room-cleanup|reconnect-sync|runtime-initialization)/u,
      /network-(session|reconnect|transport)/u
    ],
    anchors: [
      'ui/network/session-lifecycle.ts',
      'ui/network/session-seat.ts',
      'ui/network/stream-session.ts',
      'ui/network/reconnect-controller.ts'
    ]
  },
  stream: {
    description: 'SSE preparation, replay, heartbeat, backpressure, broadcast',
    patterns: [
      /match-stream-/u,
      /match-worker-(stream|broadcast)/u,
      /^scripts\/local-match-server\.ts$/u,
      /^ui\/network\/(stream-|room-events)/u,
      /(stream-sse|heartbeat|sse)/u
    ],
    anchors: [
      'utils/match-stream-preparation-controller.ts',
      'workers/match-worker-stream-controller.ts',
      'workers/match-worker-stream-session-controller.ts',
      'workers/match-worker-stream-route-controller.ts',
      'ui/network/stream-session.ts',
      'ui/network/stream-snapshot.ts',
      'scripts/local-match-server.ts'
    ]
  },
  pending: {
    description: 'pending identity, target selection, signal bridge, authority validation',
    patterns: [
      /pending/u,
      /^workers\/match-worker\.ts$/u,
      /^scripts\/local-match-server\.ts$/u,
      /selection-signal-bridge/u,
      /selection-flow-network-handoff/u,
      /movement-selection/u,
      /fate-will-selection/u
    ],
    anchors: [
      'ui/network/selection-signal-bridge.ts',
      'game/card-effects/selection-flow-network-handoff.ts',
      'game/turn/pending-coordinator.ts',
      'game/logic/cards-internal/pending-selection-registry.ts',
      'utils/match-authority/pending-selection.ts',
      'workers/match-worker.ts',
      'scripts/local-match-server.ts'
    ]
  },
  presentation: {
    description: 'presentation frame, journal, digest, strict ordered replay',
    patterns: [
      /network-presentation-frame/u,
      /presentation-journal/u,
      /^workers\/match-worker\.ts$/u,
      /^scripts\/local-match-server\.ts$/u,
      /^ui\/network\/(presentation-timeline|playback-dispatcher|playback-recovery)/u,
      /network-playback/u,
      /presentation-retry/u,
      /publish-artifacts/u
    ],
    anchors: [
      'shared/network-presentation-frame.ts',
      'utils/match-authority/presentation-journal.ts',
      'ui/network/presentation-timeline.ts',
      'ui/network/playback-dispatcher.ts',
      'ui/network/playback-recovery.ts',
      'workers/match-worker.ts',
      'scripts/local-match-server.ts'
    ]
  },
  visual: {
    description: 'visual cursor/store/settlement, strict playback, board writer recovery',
    patterns: [
      /^ui\/network\/(visual-|presentation-timeline|playback-)/u,
      /^ui\/(playback-|presentation-handler|animation-engine)/u,
      /^ui\/board-visual\//u,
      /^ui\/pixi\//u,
      /strict-network/u,
      /visual-(state|settlement|catchup)/u
    ],
    anchors: [
      'ui/network/visual-state-store.ts',
      'ui/network/visual-settlement.ts',
      'ui/network/presentation-timeline.ts',
      'ui/playback-state-manager.ts',
      'ui/presentation-handler.ts',
      'ui/board-visual/controller.ts'
    ]
  },
  timeout: {
    description: 'authority turn timer, timeout transition, rollback and presentation',
    patterns: [
      /turn-timer/u,
      /timeout-controller/u,
      /^workers\/match-worker\.ts$/u,
      /^scripts\/local-match-server\.ts$/u,
      /timeout.*presentation/u,
      /heartbeat-stateversion/u
    ],
    anchors: [
      'workers/match-worker-timeout-controller.ts',
      'workers/match-worker-turn-timer-controller.ts',
      'workers/match-worker-turn-timer.ts',
      'ui/network/turn-timer.ts',
      'scripts/local-match-server.ts'
    ]
  },
  auto: {
    description: 'network AUTO request, authority replanning, turn-start continuation',
    patterns: [
      /match-auto-command/u,
      /network\/auto-play/u,
      /^workers\/match-worker\.ts$/u,
      /^scripts\/local-match-server\.ts$/u,
      /network-auto-play/u,
      /cpu-network-command-planner/u,
      /auto-turn-authority/u,
      /sub-placement-turn-start/u,
      /network-turn-start/u
    ],
    anchors: [
      'ui/network/auto-play.ts',
      'utils/match-auto-command.ts',
      'game/cpu-network-command-planner.ts',
      'workers/match-worker.ts',
      'scripts/local-match-server.ts'
    ]
  },
  projection: {
    description: 'seat-specific public projection, hidden information, snapshot hashes',
    patterns: [
      /^utils\/match-authority\/(projection|snapshot-state|hand-projection|trap-visibility)\./u,
      /^workers\/match-worker\.ts$/u,
      /^scripts\/local-match-server\.ts$/u,
      /public-snapshot/u,
      /(visibility|projection|projected)/u,
      /^shared\/network-contract\./u
    ],
    anchors: [
      'utils/match-authority/projection.ts',
      'utils/match-authority/snapshot-state.ts',
      'utils/match-authority/hand-projection.ts',
      'utils/match-authority/trap-visibility.ts',
      'workers/match-worker.ts',
      'scripts/local-match-server.ts'
    ]
  },
  identity: {
    description: 'seat/player identity, tokens, leave/recovery and privacy',
    patterns: [
      /player-identity/u,
      /match-authority\/identity/u,
      /^scripts\/local-match-server\.ts$/u,
      /session-seat/u,
      /leave-token/u,
      /leave-contract/u,
      /player-id/u
    ],
    anchors: [
      'workers/match-worker-player-identity.ts',
      'shared/player-identity-contract.ts',
      'utils/match-authority/identity.ts',
      'ui/network/session-seat.ts',
      'scripts/local-match-server.ts'
    ]
  },
  spectator: {
    description: 'spectator authentication, projection, stream and read-only enforcement',
    patterns: [
      /spectat/u,
      /match-spectate-controller/u,
      /^workers\/match-worker\.ts$/u,
      /^scripts\/local-match-server\.ts$/u
    ],
    anchors: [
      'utils/match-spectate-controller.ts',
      'workers/match-worker.ts',
      'scripts/local-match-server.ts'
    ]
  },
  rating: {
    description: 'rated queue/result authority, identity and rating projection',
    patterns: [
      /rated/u,
      /rating/u,
      /leaderboard/u,
      /glicko/u,
      /^scripts\/local-match-server\.ts$/u
    ],
    anchors: [
      'shared/glicko2-rating.ts',
      'workers/match-worker-rating.ts',
      'scripts/local-match-server.ts'
    ]
  },
  'worker-runtime': {
    description: 'Worker preload, generated surface checks and executable bundle',
    patterns: [
      /match-worker-runtime-preload/u,
      /worker-runtime-preload/u,
      /generated-network-surface/u,
      /worker-bundle-smoke/u,
      /match-worker-preload/u,
      /match-worker-card-preload/u
    ],
    anchors: [
      'workers/match-worker-runtime-preload.ts',
      'scripts/check-worker-runtime-preload.ts',
      'scripts/check-generated-network-surface.ts',
      'scripts/worker-bundle-smoke.ts'
    ]
  },
  delivery: {
    description: 'browser build, root-to-worker mirror, bundle and deployment surface',
    patterns: [
      /prepare-worker-assets/u,
      /check-worker-mirror/u,
      /worker-bundle-smoke/u,
      /^worker-public\//u,
      /^vite-dist\//u,
      /^public\/module-registry/u,
      /^browser-vite\/generated\//u,
      /^index(\.classic|\.vite)?\.html$/u
    ],
    anchors: [
      'scripts/prepare-worker-assets.ts',
      'scripts/check-worker-mirror.ts',
      'scripts/worker-bundle-smoke.ts'
    ]
  }
};

const SURFACE_ALIASES = {
  snapshot: ['intake'],
  reconnect: ['session'],
  sse: ['stream'],
  journal: ['presentation'],
  privacy: ['projection', 'identity'],
  worker: ['worker-runtime']
};

const RELEVANT_PACKAGE_SCRIPTS = [
  'typecheck',
  'build:ts',
  'check:window',
  'check:dependency-boundaries',
  'test:match:parity',
  'test:network:parity',
  'match:check',
  'match:turnstart-browser-check',
  'match:pixijs-board-playback-check',
  'match:cross-platform-smoke:vite',
  'build:browser',
  'build:vite',
  'check:generated-network-surface',
  'worker:prepare',
  'check:worker-mirror',
  'worker:bundle:smoke',
  'worker:deploy'
];

function fail(message) {
  console.error(`inventory-network-contract: ${message}`);
  process.exit(1);
}

function readOptionValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${optionName} requires a value`);
  return value;
}

function printSurfaceList() {
  for (const [name, definition] of Object.entries(SURFACES)) {
    console.log(`${name}: ${definition.description}`);
  }
}

function expandSurface(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'all') return Object.keys(SURFACES);
  if (SURFACE_ALIASES[normalized]) return SURFACE_ALIASES[normalized];
  if (SURFACES[normalized]) return [normalized];
  fail(`unknown surface: ${value}; use --list-surfaces`);
}

function parseArgs(argv) {
  const options = {
    repo: process.cwd(),
    surfaces: [],
    terms: [],
    json: false,
    listSurfaces: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') {
      options.repo = readOptionValue(argv, index, '--repo');
      index += 1;
    } else if (arg === '--surface') {
      options.surfaces.push(...expandSurface(readOptionValue(argv, index, '--surface')));
      index += 1;
    } else if (arg === '--term') {
      options.terms.push(readOptionValue(argv, index, '--term'));
      index += 1;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--list-surfaces') {
      options.listSurfaces = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log([
        'Usage: inventory-network-contract.mjs --surface <surface> [--surface <surface>...] [options]',
        '',
        'Options:',
        '  --repo <path>       Repository root or nested path (default: cwd)',
        '  --surface <name>    Repeatable surface, alias, or all',
        '  --term <text>       Repeatable symbol/action/error/card term searched across text and paths',
        '  --list-surfaces     List supported surfaces',
        '  --json              Emit structured JSON'
      ].join('\n'));
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  options.surfaces = [...new Set(options.surfaces)];
  options.terms = uniqueTerms(options.terms);
  if (options.listSurfaces) {
    printSurfaceList();
    process.exit(0);
  }
  if (options.surfaces.length === 0 && options.terms.length === 0) {
    fail('provide at least one --surface or --term');
  }
  return options;
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

function normalizePath(value) {
  return normalize(value).replaceAll('\\', '/').replace(/^\.\/+/u, '');
}

function uniqueTerms(values) {
  const byNormalized = new Map();
  for (const value of values) {
    const original = String(value ?? '').trim();
    const normalized = normalize(original);
    if (normalized && !byNormalized.has(normalized)) byNormalized.set(normalized, original);
  }
  return [...byNormalized.values()];
}

function runGit(repoRoot, args) {
  return spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    windowsHide: true
  });
}

function resolveRepoRoot(repoPath) {
  const candidate = resolve(repoPath || process.cwd());
  const result = runGit(candidate, ['rev-parse', '--show-toplevel']);
  if (result.status !== 0) {
    fail(`cannot resolve a git repository from ${candidate}: ${(result.stderr || '').trim()}`);
  }
  return resolve((result.stdout || '').trim());
}

function validateRepository(repoRoot) {
  const packagePath = resolve(repoRoot, 'package.json');
  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${packagePath}: ${error.message}`);
  }
  if (packageJson.name !== 'card-reversi') fail(`${repoRoot} is not the card-reversi repository`);
  return packageJson;
}

function listCandidateFiles(repoRoot) {
  const result = runGit(repoRoot, [
    '-c',
    'core.quotePath=false',
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard'
  ]);
  if (result.status !== 0) fail(`git ls-files failed: ${(result.stderr || '').trim()}`);
  return uniqueTerms(
    (result.stdout || '')
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean)
  ).sort((left, right) => left.localeCompare(right, 'en'));
}

function isGeneratedOrMirror(path, contents = '') {
  return path.startsWith('worker-public/')
    || path.startsWith('dist/')
    || path.startsWith('vite-dist/')
    || path.startsWith('browser-vite/generated/')
    || path === 'public/module-registry.js'
    || path.includes('.generated.')
    || /^\/\/ Auto-generated\b/u.test(contents);
}

function classify(file, contents = '') {
  const path = file.replaceAll('\\', '/');
  if (isGeneratedOrMirror(path, contents)) return 'generated-or-mirror';
  if (path.startsWith('docs/archive/') || path.startsWith('docs/implementation/')) return 'historical-docs';
  if (path === 'AGENTS.md' || path.endsWith('/AGENTS.md') || path === 'docs/architecture-contracts.md') return 'contract-docs';
  if (path.startsWith('test/') || path.startsWith('tests/') || path.includes('/__tests__/')) return 'tests';
  if (path.startsWith('shared/')) return 'shared-contracts';
  if (path.startsWith('utils/match-')) return 'authority-core';
  if (path.startsWith('workers/')) return 'worker-adapter';
  if (path.startsWith('scripts/local-match-server.')) return 'local-server-adapter';
  if (path.startsWith('ui/network/') || path === 'ui/network-client.ts') return 'network-client';
  if (path.startsWith('game/')) return 'game-bridge';
  if (path.startsWith('ui/board-visual/') || path.startsWith('ui/pixi/')) return 'board-visual';
  if (path.startsWith('ui/')) return 'ui-presentation';
  if (path.startsWith('scripts/') || path === 'package.json') return 'tooling';
  if (path.startsWith('docs/') || path === '01-rulebook.md' || path.startsWith('正本/')) return 'docs';
  return 'other';
}

function sourceRole(file, category, candidateSet) {
  if (category === 'generated-or-mirror') return category;
  const path = file.replaceAll('\\', '/');
  if (path.endsWith('.js') && candidateSet.has(`${path.slice(0, -3)}.ts`)) return 'paired-js';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript-source';
  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) return 'javascript-source';
  return 'data-or-doc';
}

function matchedSurfaces(path, selectedSurfaces) {
  return selectedSurfaces.filter((surface) => SURFACES[surface].patterns.some((pattern) => pattern.test(path)));
}

function collectInventory(repoRoot, files, selectedSurfaces, terms) {
  const candidateSet = new Set(files.map((file) => file.replaceAll('\\', '/')));
  const termRecords = terms.map((term) => ({ original: term, normalized: normalize(term) }));
  const hits = [];
  const skipped = [];

  for (const rawFile of files) {
    const file = rawFile.replaceAll('\\', '/');
    const normalizedFile = normalizePath(file);
    const surfaces = matchedSurfaces(file, selectedSurfaces);
    const pathMatchedTerms = termRecords
      .filter((term) => normalizedFile.includes(term.normalized.replaceAll('\\', '/')))
      .map((term) => term.original);
    const extension = extname(file).toLocaleLowerCase('en-US');
    let contents = '';
    const contentMatchedTerms = new Set();
    const lines = [];
    const snippets = [];
    const shouldRead = TEXT_EXTENSIONS.has(extension);

    if (shouldRead) {
      try {
        contents = readFileSync(resolve(repoRoot, file), 'utf8');
      } catch (error) {
        skipped.push({
          file,
          category: classify(file),
          error: error instanceof Error ? error.message : String(error)
        });
      }
      if (contents && termRecords.length > 0) {
        contents.split(/\r?\n/u).forEach((line, index) => {
          const normalizedLine = normalize(line);
          const matched = termRecords
            .filter((term) => normalizedLine.includes(term.normalized))
            .map((term) => term.original);
          if (matched.length === 0) return;
          lines.push(index + 1);
          matched.forEach((term) => contentMatchedTerms.add(term));
          if (snippets.length < 8) {
            snippets.push({
              line: index + 1,
              text: line.trim().slice(0, 220),
              matchedTerms: matched
            });
          }
        });
      }
    }

    if (surfaces.length === 0 && pathMatchedTerms.length === 0 && contentMatchedTerms.size === 0) continue;
    const category = classify(file, contents);
    hits.push({
      file,
      category,
      sourceRole: sourceRole(file, category, candidateSet),
      surfaces,
      matchKinds: [
        ...(surfaces.length > 0 ? ['surface'] : []),
        ...(pathMatchedTerms.length > 0 ? ['path'] : []),
        ...(contentMatchedTerms.size > 0 ? ['content'] : [])
      ],
      matchedTerms: uniqueTerms([...pathMatchedTerms, ...contentMatchedTerms]),
      lines,
      snippets
    });
  }

  return { hits, skipped };
}

function readWorkingTreeStatus(repoRoot) {
  const result = runGit(repoRoot, ['status', '--short']);
  if (result.status !== 0) fail(`git status failed: ${(result.stderr || '').trim()}`);
  return (result.stdout || '').split(/\r?\n/u).map((line) => line.trimEnd()).filter(Boolean);
}

function findGoverningAgentFiles(repoRoot, files) {
  const found = new Set();
  if (existsSync(resolve(repoRoot, 'AGENTS.md'))) found.add('AGENTS.md');
  for (const rawFile of files) {
    let current = dirname(rawFile.replaceAll('\\', '/')).replaceAll('\\', '/');
    while (current && current !== '.') {
      const candidate = `${current}/AGENTS.md`;
      if (existsSync(resolve(repoRoot, candidate))) found.add(candidate);
      const parent = dirname(current).replaceAll('\\', '/');
      if (!parent || parent === current || parent === '.') break;
      current = parent;
    }
  }
  return [...found].sort((left, right) => left.localeCompare(right, 'en'));
}

function buildAnchorStatus(repoRoot, selectedSurfaces) {
  const anchors = [];
  for (const surface of selectedSurfaces) {
    for (const path of SURFACES[surface].anchors) {
      if (!anchors.some((entry) => entry.path === path)) {
        anchors.push({ path, exists: existsSync(resolve(repoRoot, path)), surfaces: [surface] });
      } else {
        anchors.find((entry) => entry.path === path).surfaces.push(surface);
      }
    }
  }
  return anchors;
}

function selectPackageScripts(packageJson) {
  const scripts = packageJson && packageJson.scripts && typeof packageJson.scripts === 'object'
    ? packageJson.scripts
    : {};
  return RELEVANT_PACKAGE_SCRIPTS
    .filter((name) => typeof scripts[name] === 'string')
    .map((name) => ({ name, command: scripts[name] }));
}

function buildCategoryCounts(hits) {
  return hits.reduce((counts, hit) => {
    counts[hit.category] = (counts[hit.category] || 0) + 1;
    return counts;
  }, {});
}

function printHuman(result) {
  console.log(`Repository: ${result.repoRoot}`);
  console.log(`Surfaces: ${result.surfaces.join(' | ') || 'term-only'}`);
  console.log(`Terms: ${result.terms.join(' | ') || 'none'}`);
  console.log(`Matched files: ${result.hits.length}`);
  console.log(`Working tree entries: ${result.workingTreeStatus.length}`);
  console.log(`Governing instructions: ${result.governingAgentFiles.join(' | ') || 'none found'}`);

  const categories = new Map();
  for (const hit of result.hits) {
    if (!categories.has(hit.category)) categories.set(hit.category, []);
    categories.get(hit.category).push(hit);
  }
  for (const [category, hits] of categories) {
    console.log(`\n[${category}] ${hits.length}`);
    for (const hit of hits) {
      const shown = hit.lines.slice(0, 8).join(',');
      const suffix = hit.lines.length > 8 ? `,+${hit.lines.length - 8}` : '';
      console.log(
        `- ${hit.file}${shown ? `:${shown}${suffix}` : ''}`
        + ` [${hit.surfaces.join('+') || 'term'}; ${hit.sourceRole}; ${hit.matchedTerms.join(' | ') || '-'}]`
      );
    }
  }
  const missing = result.anchorStatus.filter((entry) => !entry.exists);
  if (missing.length > 0) {
    console.log(`\nWarning: ${missing.length} current ownership anchor(s) are absent; rediscover owners instead of recreating stale paths.`);
  }
  if (result.skippedCanonical.length > 0) {
    console.log(`\nFailure: ${result.skippedCanonical.length} selected canonical candidate file(s) could not be read.`);
  }
}

const options = parseArgs(process.argv.slice(2));
const repoRoot = resolveRepoRoot(options.repo);
const packageJson = validateRepository(repoRoot);
const candidateFiles = listCandidateFiles(repoRoot);
const inventory = collectInventory(repoRoot, candidateFiles, options.surfaces, options.terms);
const anchorStatus = buildAnchorStatus(repoRoot, options.surfaces);
const skippedCanonical = inventory.skipped.filter(
  (entry) => !['generated-or-mirror', 'historical-docs'].includes(entry.category)
);
const result = {
  schemaVersion: 1,
  repoRoot,
  packageName: packageJson.name,
  surfaces: options.surfaces,
  surfaceDescriptions: Object.fromEntries(
    options.surfaces.map((surface) => [surface, SURFACES[surface].description])
  ),
  terms: options.terms,
  hits: inventory.hits,
  categoryCounts: buildCategoryCounts(inventory.hits),
  anchorStatus,
  missingAnchors: anchorStatus.filter((entry) => !entry.exists),
  packageScripts: selectPackageScripts(packageJson),
  governingAgentFiles: findGoverningAgentFiles(repoRoot, inventory.hits.map((hit) => hit.file)),
  workingTreeStatus: readWorkingTreeStatus(repoRoot),
  skipped: inventory.skipped,
  skippedCanonical
};

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  printHuman(result);
}

if (skippedCanonical.length > 0) process.exitCode = 2;
