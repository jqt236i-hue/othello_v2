import ExecutionCore = require('./selection-flow-execution-core');

function executePendingSelection(options: any, deps: any) {
    return ExecutionCore.executePendingSelectionCore(options, deps);
}

const SelectionFlowPendingExecutionModule = {
    executePendingSelection
};

const pendingExecutionRoot = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);
if (pendingExecutionRoot && !pendingExecutionRoot.SelectionFlowPendingExecution) {
    pendingExecutionRoot.SelectionFlowPendingExecution = SelectionFlowPendingExecutionModule;
}

export = SelectionFlowPendingExecutionModule;
