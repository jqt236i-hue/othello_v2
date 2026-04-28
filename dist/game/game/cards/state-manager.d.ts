export function drawCard(cardState: any, playerKey: any, prng: any): any;
export function addToHand(cardState: any, playerKey: any, cardId: any, opts: any): any;
export function removeFromHand(cardState: any, playerKey: any, handIndex: any): any;
export function getHand(cardState: any, playerKey: any): any;
export function ensureHands(cardState: any): any;
export function addCharge(cardState: any, playerKey: any, amount: any, reason: any, meta: any): any;
export function consumeCharge(cardState: any, playerKey: any, amount: any, reason: any, meta: any): any;
export function getCharge(cardState: any, playerKey: any): number;
export function normalizeCharge(cardState: any, playerKey: any, nextValue: any, reason: any, meta: any): any;
export function addMarker(cardState: any, kind: any, row: any, col: any, owner: any, data: any): any;
export function removeMarker(cardState: any, markerId: any): any;
export function getMarkers(cardState: any): any;
export function updateMarker(cardState: any, markerId: any, updater: any): boolean;
export function shuffleDeck(deck: any, prng: any): any[];
export function createDefaultDeck(prng: any): any[];
export function getDeck(cardState: any, playerKey: any): any;
//# sourceMappingURL=state-manager.d.ts.map