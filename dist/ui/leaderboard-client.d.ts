declare function resolveServerBaseUrl(options?: any): string;
declare function getPlayerName(): string;
declare function setPlayerName(value: string): string;
declare function getPlayerId(): string;
declare function fetchLeaderboard(options?: any): Promise<any>;
declare function submitScore(scoreSummary: any, options?: any): Promise<any>;
declare const LeaderboardClient: {
    getPlayerName: typeof getPlayerName;
    setPlayerName: typeof setPlayerName;
    getPlayerId: typeof getPlayerId;
    fetchLeaderboard: typeof fetchLeaderboard;
    submitScore: typeof submitScore;
    resolveServerBaseUrl: typeof resolveServerBaseUrl;
};
export = LeaderboardClient;
//# sourceMappingURL=leaderboard-client.d.ts.map