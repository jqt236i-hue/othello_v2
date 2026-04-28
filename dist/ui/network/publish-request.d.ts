/**
 * @file publish-request.ts
 * @description Network publish request builder
 */
interface CommandPayload {
    actionType?: string;
    turnIndex?: number;
    actor?: string;
    params?: Record<string, unknown>;
    actionId?: string;
}
interface PublishRequestInfo {
    actionType?: string;
    action?: Record<string, unknown>;
}
interface PublishRequestOptions {
    playerKey?: string;
    operationId?: string;
    buildPublishCommandPayload?: (source: PublishRequestInfo, playerKey?: string) => CommandPayload | null;
    commandPayloadOptions?: {
        playerKey?: string;
    };
    roomId?: string;
    seatKey?: string;
    seatToken?: string;
    baseVersion?: number;
    turnIndex?: number;
}
interface PublishRequestResult {
    commandPayload: CommandPayload;
    queuedActionType: string | null;
    requestPayload: {
        roomId: string | null;
        seatKey: string | null;
        seatToken: string | null;
        playerKey: string | undefined;
        actionType: string | null;
        operationId: string | undefined;
        baseVersion: number | undefined;
        actor: string | undefined;
        params: Record<string, unknown>;
        actionId?: string;
        turnIndex?: number;
        action?: Record<string, unknown>;
    };
}
declare function buildPublishRequest(info: PublishRequestInfo, options: PublishRequestOptions): PublishRequestResult | null;
declare const _default: {
    buildPublishRequest: typeof buildPublishRequest;
};
export = _default;
//# sourceMappingURL=publish-request.d.ts.map