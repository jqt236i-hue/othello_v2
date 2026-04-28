declare function buildCommentaryContext(options?: any): any;
declare function formatCommentaryEntry(playerKey: string, speakerRole: string, text: string): any;
declare function showCommentaryEntry(entry: any, options?: any): any;
declare function requestCommentaryAndShow(options?: any): Promise<any>;
declare function initBroker(config: any): any;
declare function resetState(): any;
declare const CommentaryBroker: {
    initBroker: typeof initBroker;
    resetState: typeof resetState;
    buildCommentaryContext: typeof buildCommentaryContext;
    formatCommentaryEntry: typeof formatCommentaryEntry;
    showCommentaryEntry: typeof showCommentaryEntry;
    requestCommentaryAndShow: typeof requestCommentaryAndShow;
};
export = CommentaryBroker;
//# sourceMappingURL=commentary-broker.d.ts.map