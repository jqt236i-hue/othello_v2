declare function initLvMaxModels(): Promise<void>;
declare function loadCpuPolicy(): Promise<void>;
declare function initPolicyOnnxModel(): Promise<void>;
declare function initPolicyTableModel(): Promise<void>;
declare const CpuPolicyModule: {
    initLvMaxModels: typeof initLvMaxModels;
    loadCpuPolicy: typeof loadCpuPolicy;
    initPolicyOnnxModel: typeof initPolicyOnnxModel;
    initPolicyTableModel: typeof initPolicyTableModel;
};
export = CpuPolicyModule;
//# sourceMappingURL=cpu-policy.d.ts.map