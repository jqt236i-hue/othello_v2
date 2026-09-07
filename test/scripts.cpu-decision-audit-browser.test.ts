const AuditInstaller = require('../scripts/cpu-decision-audit-browser');
const AuditVm = require('vm');

test('decision audit observes the current card state after replacement', () => {
    const initial = { pendingEffectByPlayer: { black: null } };
    const current = { pendingEffectByPlayer: { black: { type: 'GUARD_WILL', stage: 'selectTarget' } } };
    const root: any = { gameState: { currentPlayer: 1 }, cardState: initial,
        selectCpuMoveWithPolicy: () => ({ row: 2, col: 3 }),
        require: (name: string) => name === 'card-system' ? { getCardState: () => initial, getGamePrng: () => ({getState: () => ({ seed: 1, calls: 0 })}) } : {}
    };
    AuditVm.runInNewContext(`(${AuditInstaller.installCpuDecisionAudit.toString()})({maxRecords:10})`, { window: root });
    root.cardState = current;
    root.selectCpuMoveWithPolicy();
    const decision = root.__cpuDecisionAudit.decisions[0];
    expect(decision.before.cardState).toEqual(current);
    expect(decision.stateUnchanged).toBe(true);
});
