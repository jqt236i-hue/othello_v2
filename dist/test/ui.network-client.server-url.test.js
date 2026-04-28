"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
function loadClientWithLocation(pageUrl, storedServerUrl) {
    jest.resetModules();
    const dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>', { url: pageUrl });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;
    if (storedServerUrl) {
        dom.window.localStorage.setItem('network_match_server_url', storedServerUrl);
    }
    require('../ui/network-client');
    return dom.window.NetworkMatchClient;
}
describe('NetworkMatchClient server URL initialization', () => {
    afterEach(() => {
        try {
            delete global.window;
        }
        catch (e) { /* ignore */ }
        try {
            delete global.document;
        }
        catch (e) { /* ignore */ }
        try {
            delete global.location;
        }
        catch (e) { /* ignore */ }
        try {
            delete global.localStorage;
        }
        catch (e) { /* ignore */ }
    });
    test('uses same origin on deployed https page when persisted server URL is loopback', () => {
        const client = loadClientWithLocation('https://card.othello.workers.dev/', 'http://127.0.0.1:8787');
        expect(client.getServerUrl()).toBe('https://card.othello.workers.dev');
    });
    test('keeps persisted loopback URL on local development page', () => {
        const client = loadClientWithLocation('http://localhost:3000/', 'http://127.0.0.1:8787');
        expect(client.getServerUrl()).toBe('http://127.0.0.1:8787');
    });
    test('uses query override before persisted URL', () => {
        const client = loadClientWithLocation('https://card.othello.workers.dev/?matchServer=https://match.example.test', 'http://127.0.0.1:8787');
        expect(client.getServerUrl()).toBe('https://match.example.test');
    });
});
//# sourceMappingURL=ui.network-client.server-url.test.js.map