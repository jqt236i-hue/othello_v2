import EvasionStatus = require('./evasion-status');
import ManifestStoneRegistry = require('./manifest-stone-registry');
import MultiCellStone = require('./multi-cell-stone');
import createSpecialStoneRegistry = require('./special-stone-registry-factory');

const SpecialStoneRegistry = createSpecialStoneRegistry(
    EvasionStatus,
    ManifestStoneRegistry,
    MultiCellStone
);

export = SpecialStoneRegistry;
