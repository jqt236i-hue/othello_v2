import fs = require('node:fs');
import path = require('node:path');
import { validateCpuDecks, formatCpuDecksSource, parseCpuDecksSource, isEditableCpuDeckProfile, CPU_DECKS_SOURCE, CPU_DECK_MAX_CARDS } from '../scripts/cpu-deck-editor';
import Profiles = require('../shared/cpu-opponent-profiles');
import Startup = require('../shared/cpu-opponent-startup-options');
import DeckSpec = require('../shared/deck-spec');
const CpuOpponentDecks = require('../shared/cpu-opponent-decks');

const profiles = Profiles.getCpuOpponentProfiles().map((profile: any) => ({ id: profile.id, level: profile.level, name: profile.name,
    editable: isEditableCpuDeckProfile(profile) }));
const enabled = new Set<string>(DeckSpec.getEnabledCardIds());
const catalogOrder = JSON.parse(fs.readFileSync(path.join(__dirname, '../cards/catalog.json'), 'utf8')).cards.map((card: any) => card.id);

test('every CPU except Lv9 has an editable deck entry in the source of truth', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', CPU_DECKS_SOURCE), 'utf8');
    const decks = parseCpuDecksSource(source);
    expect(Object.keys(decks).sort()).toEqual(profiles.filter((p: any) => p.editable).map((p: any) => p.id).sort());
    expect(profiles.find((p: any) => p.level === 9)!.editable).toBe(false);
    expect(CpuOpponentDecks.CPU_OPPONENT_DECKS).toEqual(decks);
    // The file is exactly what the editor writes for its own content.
    expect(formatCpuDecksSource(decks, profiles, catalogOrder)).toBe(source.replace(/\r\n/g, '\n'));
});

test('startup options use the fixed deck of each CPU and keep Lv9 on the all-cards deck', () => {
    for (const profile of profiles) {
        const options = Startup.getCpuOpponentStartupOptions(profile.id, 'white');
        const fixed = CpuOpponentDecks.CPU_OPPONENT_DECKS[profile.id];
        if (profile.level === 9) {
            expect(options.deckCardIds).toEqual(DeckSpec.getCpuLv9EndingAshDeckCardIds());
        } else if (Array.isArray(fixed)) {
            expect(options.deckCardIds).toEqual(fixed);
            expect(options.deckCode).toBeNull();
        } else {
            expect(options.deckCardIds).toBeNull();
            expect(options.deckCode).toBeNull();
        }
    }
});

test('deck validation allows any copies and size up to the search limit, and rejects other input', () => {
    const lv12 = '12-strategy-cpu';
    expect(validateCpuDecks({ [lv12]: Array(40).fill('chest_01') }, profiles, enabled)[lv12]).toHaveLength(40);
    expect(validateCpuDecks({ '1': null }, profiles, enabled)).toEqual({ '1': null });
    expect(() => validateCpuDecks({ [lv12]: [] }, profiles, enabled)).toThrow('1〜512枚');
    expect(() => validateCpuDecks({ [lv12]: Array(CPU_DECK_MAX_CARDS + 1).fill('chest_01') }, profiles, enabled)).toThrow('1〜512枚');
    expect(() => validateCpuDecks({ [lv12]: ['no_such_card'] }, profiles, enabled)).toThrow('使えないカード');
    expect(() => validateCpuDecks({ '9-ending-ash': ['chest_01'] }, profiles, enabled)).toThrow('編集できないCPU');
    expect(() => validateCpuDecks([], profiles, enabled)).toThrow();
});

test('the written source round-trips duplicates in catalog order', () => {
    const decks = { '6': ['swap_01', 'chest_01', 'chest_01'], '1': null };
    const text = formatCpuDecksSource(decks, profiles, catalogOrder);
    expect(parseCpuDecksSource(text)).toEqual({ '1': null, '6': ['chest_01', 'chest_01', 'swap_01'] });
});

test('every enabled card has an effect group and 特殊石 follows the game judgment', () => {
    const { resolveCardRoles, listCardRoles, CARD_ROLE_DEFINITIONS } = require('../scripts/cpu-deck-card-roles');
    const Registry = require('../shared/special-stone-registry-static');
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../cards/catalog.json'), 'utf8')).cards;
    const knownTypes = new Set(catalog.map((card: any) => card.type));
    for (const card of catalog.filter((card: any) => enabled.has(card.id))) {
        const special = !!Registry.getMarkerTypeForSpecialStoneCard(card.type);
        const roles = resolveCardRoles(card.type, special);
        expect([card.name_ja, roles.length > 0]).toEqual([card.name_ja, true]);
        expect(roles.includes('special-stone')).toBe(special);
    }
    for (const role of CARD_ROLE_DEFINITIONS) for (const type of role.types) expect(knownTypes.has(type)).toBe(true);
    expect(listCardRoles()[0]).toEqual({ key: 'special-stone', label: '特殊石' });
});
