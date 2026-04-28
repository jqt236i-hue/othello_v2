export function resolveStaticFilePath(root: any, requestUrl: any): {
    statusCode: number;
    body: string;
    filePath?: undefined;
} | {
    filePath: string;
    statusCode?: undefined;
    body?: undefined;
};
export function startStaticServer(port?: number): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
export function stopStaticServer(server: any): Promise<void>;
export function stopPlaywrightPage(page: any, timeoutMs?: number): Promise<void>;
export function stopPlaywrightBrowser(browser: any, timeoutMs?: number): Promise<void>;
import http = require("http");
//# sourceMappingURL=e2e-runtime-helpers.d.ts.map