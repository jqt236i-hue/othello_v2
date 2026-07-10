export {};

declare global {
  interface Error {
    code?: any;
    command?: any;
    exitCode?: any;
    trainingCycle?: any;
    trainingProfile?: any;
    resumeCheckpointPaths?: any;
  }
}
