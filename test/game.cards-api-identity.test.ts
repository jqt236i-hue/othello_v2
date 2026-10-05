import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  FACADE_IDENTITY_BASELINE,
  IMPORTANT_CARD_CONSTANTS,
  inventoryReviewedModuleStateOwners
} from './helpers/card-runtime-contract-fixtures';

const cardsModulePath = require.resolve('../game/logic/cards');
const cardsWrapperPath = require.resolve('../game/logic/cards.js');

function descriptorSchema(value: Record<string, unknown>) {
  return Reflect.ownKeys(value).map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return {
      key: typeof key === 'symbol' ? key.toString() : key,
      kind: typeof value[key as keyof typeof value],
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
      writable: 'writable' in descriptor ? descriptor.writable : null,
      hasGetter: typeof descriptor.get === 'function',
      hasSetter: typeof descriptor.set === 'function'
    };
  });
}

describe('CardLogic facade identity contract', () => {
  test('pins own keys, descriptors, symbols, prototype, aliases, and important constants', () => {
    const first = require(cardsModulePath);
    const second = require(cardsModulePath);
    const ownKeys = Reflect.ownKeys(first);
    const functions = ownKeys.filter((key) => typeof first[key] === 'function');
    const symbols = ownKeys.filter((key) => typeof key === 'symbol');
    const aliasGroups = new Map<unknown, string[]>();
    for (const key of functions) {
      const fn = first[key];
      const aliases = aliasGroups.get(fn) || [];
      aliases.push(String(key));
      aliasGroups.set(fn, aliases);
    }

    expect(first).toBe(second);
    expect(require(cardsWrapperPath)).toBe(first);
    const ModuleExportUtils = require('../shared/module-export-utils');
    expect(ModuleExportUtils.unwrapModuleExport(first)).toBe(first);
    expect(ownKeys).toHaveLength(FACADE_IDENTITY_BASELINE.ownKeyCount);
    expect(functions).toHaveLength(FACADE_IDENTITY_BASELINE.functionCount);
    expect(symbols).toHaveLength(FACADE_IDENTITY_BASELINE.symbolCount);
    expect(Object.getPrototypeOf(first)).toBe(Object.prototype);
    expect([...aliasGroups.values()].filter((keys) => keys.length > 1)).toHaveLength(
      FACADE_IDENTITY_BASELINE.functionAliasGroupCount
    );
    for (const descriptor of descriptorSchema(first)) {
      expect(descriptor).toMatchObject(FACADE_IDENTITY_BASELINE.descriptor);
      expect(descriptor.hasGetter).toBe(false);
      expect(descriptor.hasSetter).toBe(false);
    }
    expect(first).toMatchObject(IMPORTANT_CARD_CONSTANTS);

    const schemaHash = crypto.createHash('sha256')
      .update(JSON.stringify(descriptorSchema(first)))
      .digest('hex');
    expect(schemaHash).toBe('82c79782644f00b6663bb52634a70311f765f5d27d682291a938b5780c760e52');
  });

  test('fresh module reconstruction is a new facade with the same schema and no function alias drift', () => {
    const original = require(cardsModulePath);
    const parityFixture = require('./fixtures/card-runtime-parity-fixture.js');
    const originalSchema = descriptorSchema(original);
    const warmedResult = parityFixture.run(original);
    const PendingCoordinator = require('../game/turn/pending-coordinator');
    PendingCoordinator.storePendingSelectionAction(
      'black',
      { type: 'pending_selection', cardId: 'destroy_01', turnIndex: 12 },
      'DESTROY_ONE_STONE'
    );
    expect(PendingCoordinator.readPendingSelectionAction('black')).not.toBeNull();
    jest.resetModules();
    const reconstructed = require(cardsModulePath);
    const reconstructedPendingCoordinator = require('../game/turn/pending-coordinator');
    expect(reconstructed).not.toBe(original);
    expect(descriptorSchema(reconstructed)).toEqual(originalSchema);
    expect(Reflect.ownKeys(reconstructed)).toEqual(Reflect.ownKeys(original));
    expect(require(cardsWrapperPath)).toBe(reconstructed);
    expect(reconstructedPendingCoordinator.readPendingSelectionAction('black')).toBeNull();
    expect(parityFixture.run(reconstructed)).toEqual(warmedResult);
  });

  test('pins every reachable module-scoped mutable owner, reset policy, and reconstruction family', () => {
    const root = path.resolve(__dirname, '..');
    const owners = inventoryReviewedModuleStateOwners(root);
    expect(owners.length).toBeGreaterThan(40);
    expect(new Set(owners.map((owner) => owner.id)).size).toBe(owners.length);
    expect(new Set(owners.map((owner) => owner.family))).toEqual(new Set([
      'runtime-service-or-cache',
      'mutable-container-or-registry',
      'lifecycle-flag-counter-or-promise',
      'module-mutable-binding'
    ]));
    for (const owner of owners) {
      const source = fs.readFileSync(path.join(root, owner.file), 'utf8');
      expect(source).toMatch(new RegExp(`\\b(?:let|var|const)\\s+${owner.declarationName}\\b`));
      expect(owner.owner).toContain(owner.file);
      expect(owner.resetOwner).toContain(owner.file);
      expect(owner.reconstructionPolicy).toContain('reconstruct');
    }
    expect(owners.map((owner) => owner.id)).toEqual(expect.arrayContaining([
      'game/logic/card-runtime-composer.ts#defaultServices',
      'game/logic/card-runtime-errors.ts#locallyCreatedRuntimeFailures',
      'game/logic/presentation.ts#warnedNoBoardOps',
      'game/logic/presentation.ts#presentationRuntime',
      'game/logic/cards/hyperactive.ts#hyperactiveRuntime',
      'game/logic/cards-internal/hand-manager.ts#selectorObjectIdentities',
      'game/turn/pending-coordinator.ts#pendingSelectionActionByPlayer',
      'game/turn/turn_pipeline_phases.ts#turnPipelinePhasesRuntime'
    ]));
    const inventoryHash = crypto.createHash('sha256')
      .update(JSON.stringify(owners))
      .digest('hex');
    // CPU advice adds one in-flight owner; its finally block releases the lease.
    // The other 86 owners retain their reset policies (source evidence lines moved).
    expect(owners).toHaveLength(87);
    expect(owners.find((owner) => owner.id === 'game/cpu-turn-handler.ts#advisedTurnInFlight'))
      .toMatchObject({ resetOwner: 'game/cpu-turn-handler.ts module/isolate/page reconstruction' });
    // Pending regeneration removal shifted card-interaction evidence by five lines.
    // The stone-supply import shifted match-worker evidence by one line.
    // The 87 owner identities, mutation kinds, and reset policies are unchanged.
    expect(inventoryHash).toBe('9db3bffe9042246bd8b5017a4efaeefc080bdfa9ff1af7bbc87f03c0067a0c8e');
  });

  test('pins classic registration/global installation cardinality and ordering', () => {
    const root = path.resolve(__dirname, '..');
    const registry = fs.readFileSync(path.join(root, 'public', 'module-registry.js'), 'utf8');
    const entry = fs.readFileSync(path.join(root, 'entry-browser.js'), 'utf8');
    const registryMatches = registry.match(/_r\("game\/logic\/cards",/g) || [];
    const globalMatches = entry.match(/moduleKey:\s*"\.\/dist\/game\/logic\/cards",\s*globalNames:\s*\["CardLogic"\]/g) || [];
    const resolverIndex = entry.indexOf('./dist/game/logic/cards-internal/module-resolver');
    const facadeIndex = entry.indexOf('./dist/game/logic/cards", globalNames: ["CardLogic"]');
    const bootstrapIndex = entry.indexOf('./dist/ui/bootstrap", initUIBootstrap: true');

    expect(registryMatches).toHaveLength(FACADE_IDENTITY_BASELINE.classicRegistrationCount);
    expect(globalMatches).toHaveLength(FACADE_IDENTITY_BASELINE.classicGlobalInstallCount);
    expect(resolverIndex).toBeGreaterThanOrEqual(0);
    expect(facadeIndex).toBeGreaterThan(resolverIndex);
    expect(bootstrapIndex).toBeGreaterThan(facadeIndex);
  });
});
