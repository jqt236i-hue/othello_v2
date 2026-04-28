#!/usr/bin/env node
// @ts-nocheck
'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function readArgValue(name) {
    const key = `--${name}`;
    const idx = process.argv.indexOf(key);
    if (idx >= 0 && idx + 1 < process.argv.length) {
        return String(process.argv[idx + 1] || '').trim();
    }
    return '';
}
const HOST = readArgValue('host') || process.env.CPU_COMMENTARY_HOST || '127.0.0.1';
const PORT = Number(readArgValue('port') || process.env.CPU_COMMENTARY_PORT || 8789);
const MODEL_ENDPOINT = readArgValue('model-endpoint') || process.env.CPU_COMMENTARY_MODEL_ENDPOINT || 'http://127.0.0.1:8080/v1/chat/completions';
const MODEL_NAME = readArgValue('model') || process.env.CPU_COMMENTARY_MODEL || 'local-model';
const REQUEST_TIMEOUT_MS = Number(readArgValue('timeout-ms') || process.env.CPU_COMMENTARY_TIMEOUT_MS || 2500);
function writeJson(res, statusCode, payload) {
    const body = JSON.stringify(payload || {});
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(body);
}
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > 512 * 1024) {
                reject(new Error('payload_too_large'));
            }
        });
        req.on('end', () => {
            if (!raw) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            }
            catch (e) {
                reject(new Error('invalid_json'));
            }
        });
        req.on('error', reject);
    });
}
function normalizeText(text, maxChars) {
    const normalized = String(text || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!normalized)
        return '';
    const chars = Array.from(normalized);
    if (!Number.isFinite(maxChars) || maxChars <= 0 || chars.length <= maxChars) {
        return normalized;
    }
    return chars.slice(0, maxChars).join('');
}
function toEventLabel(eventType) {
    const key = String(eventType || 'turn_start');
    if (key === 'card_used')
        return 'カード使用';
    if (key === 'card_targeted')
        return 'カード対象';
    if (key === 'pass')
        return 'パス';
    return '通常手番';
}
function toPhaseLabel(phase) {
    const key = String(phase || 'middle');
    if (key === 'opening')
        return '序盤';
    if (key === 'endgame')
        return '終盤';
    return '中盤';
}
function toAdvantageLabel(advantage) {
    const key = String(advantage || 'even');
    if (key === 'ahead')
        return '優勢';
    if (key === 'behind')
        return '劣勢';
    return '拮抗';
}
function buildUserPrompt(context) {
    const eventLabel = toEventLabel(context.eventType);
    const phaseLabel = toPhaseLabel(context.phase);
    const advantageLabel = toAdvantageLabel(context.advantage);
    const legalMoves = Number.isFinite(context.legalMovesCount) ? context.legalMovesCount : '不明';
    const turnNumber = Number.isFinite(context.turnNumber) ? context.turnNumber : '不明';
    const cardId = context.cardId ? String(context.cardId) : 'なし';
    const pendingType = context.pendingType ? String(context.pendingType) : 'なし';
    const blackCount = context.counts && Number.isFinite(context.counts.black) ? context.counts.black : '不明';
    const whiteCount = context.counts && Number.isFinite(context.counts.white) ? context.counts.white : '不明';
    return [
        `イベント: ${eventLabel}`,
        `局面: ${phaseLabel}`,
        `形勢: ${advantageLabel}`,
        `ターン: ${turnNumber}`,
        `合法手数: ${legalMoves}`,
        `黒石: ${blackCount}`,
        `白石: ${whiteCount}`,
        `使用カード: ${cardId}`,
        `選択中効果: ${pendingType}`,
        '条件: 1文のみ、40文字以内、句点は任意、解説禁止。'
    ].join('\n');
}
function buildFallbackLine(context) {
    const eventType = String(context.eventType || 'turn_start');
    const phase = toPhaseLabel(context.phase);
    const advantage = toAdvantageLabel(context.advantage);
    if (eventType === 'card_used') {
        return `${phase}、ここでカードを切る。${advantage}を取りにいく。`;
    }
    if (eventType === 'card_targeted') {
        return `${phase}、その効果は見えている。崩される前に組み直す。`;
    }
    if (eventType === 'pass') {
        return `${phase}、ここは打てない。次の一手に備える。`;
    }
    return `${phase}、形勢は${advantage}。丁寧に石を伸ばす。`;
}
async function requestModelLine(context, maxChars) {
    if (typeof fetch !== 'function')
        return null;
    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timeoutId = controller
        ? setTimeout(() => {
            try {
                controller.abort();
            }
            catch (e) { /* ignore */ }
        }, REQUEST_TIMEOUT_MS)
        : null;
    const body = {
        model: MODEL_NAME,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 64,
        messages: [
            {
                role: 'system',
                content: 'あなたはカードオセロの白CPU。短い一言だけ返す。40文字以内。日本語。'
            },
            {
                role: 'user',
                content: buildUserPrompt(context)
            }
        ]
    };
    try {
        const response = await fetch(MODEL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller ? controller.signal : undefined
        });
        if (!response || !response.ok)
            return null;
        const data = await response.json();
        const content = data && data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : '';
        const line = normalizeText(content, maxChars);
        return line || null;
    }
    catch (e) {
        return null;
    }
    finally {
        if (timeoutId)
            clearTimeout(timeoutId);
    }
}
const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        writeJson(res, 204, {});
        return;
    }
    if (req.method === 'GET' && req.url === '/health') {
        writeJson(res, 200, {
            ok: true,
            host: HOST,
            port: PORT,
            modelEndpoint: MODEL_ENDPOINT,
            model: MODEL_NAME
        });
        return;
    }
    if (req.method === 'POST' && req.url === '/commentary') {
        try {
            const body = await parseBody(req);
            const maxChars = Number.isFinite(Number(body.maxChars)) ? Number(body.maxChars) : 40;
            const context = {
                eventType: body.eventType,
                phase: body.phase,
                advantage: body.advantage,
                turnNumber: body.turnNumber,
                legalMovesCount: body.legalMovesCount,
                cardId: body.cardId,
                pendingType: body.pendingType,
                counts: body.counts
            };
            const modelText = await requestModelLine(context, maxChars);
            const fallbackText = normalizeText(buildFallbackLine(context), maxChars);
            const text = modelText || fallbackText;
            writeJson(res, 200, {
                ok: true,
                text,
                source: modelText ? 'model' : 'fallback'
            });
            return;
        }
        catch (e) {
            writeJson(res, 400, {
                ok: false,
                reason: e && e.message ? e.message : 'request_failed'
            });
            return;
        }
    }
    writeJson(res, 404, { ok: false, reason: 'not_found' });
});
server.listen(PORT, HOST, () => {
    console.log(`[cpu-commentary] listening on http://${HOST}:${PORT}`);
    console.log(`[cpu-commentary] model endpoint: ${MODEL_ENDPOINT}`);
    console.log(`[cpu-commentary] model name: ${MODEL_NAME}`);
});
//# sourceMappingURL=local-cpu-commentary-server.js.map