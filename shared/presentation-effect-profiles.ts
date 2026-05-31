interface CauseReasonProfile {
    cause?: unknown;
    causes?: unknown[];
    reasonPrefix?: unknown;
    spawnIntent?: unknown;
    [key: string]: unknown;
}

interface PresentationSubject {
    cause?: unknown;
    reason?: unknown;
    meta?: {
        spawnIntent?: unknown;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

const STONE_SALVATION_GOD_CAUSE = 'STONE_SALVATION_GOD';
const STONE_SALVATION_GOD_REVIVE_REASON = 'stone_salvation_god_revive';

const SPECIAL_DESTROY_TARGET_PROFILES = Object.freeze({
    sniperShot: Object.freeze({
        causes: Object.freeze(['SNIPER_WILL']),
        reasonPrefix: 'sniper_shot'
    }),
    lightningDestroyed: Object.freeze({
        causes: Object.freeze(['LIGHTNING_WILL']),
        reasonPrefix: 'lightning_destroyed'
    }),
    destroyDragonBreath: Object.freeze({
        causes: Object.freeze(['DESTROY_DRAGON_WILL', 'DESTROY_DRAGON']),
        reasonPrefix: 'destroy_dragon_breath'
    }),
    udgDestroyed: Object.freeze({
        causes: Object.freeze(['ULTIMATE_DESTROY_GOD']),
        reasonPrefix: 'udg_destroyed'
    }),
    robotVacuumSuck: Object.freeze({
        causes: Object.freeze(['ROBOT_VACUUM']),
        reasonPrefix: 'robot_vacuum_suck'
    }),
    gluttonousEat: Object.freeze({
        causes: Object.freeze(['GLUTTONOUS_WILL']),
        reasonPrefix: 'gluttonous_eat'
    }),
    willHunterKingSlash: Object.freeze({
        causes: Object.freeze(['WILL_HUNTER_KING']),
        reasonPrefix: 'will_hunter_king_slash'
    })
});

const POSITIVE_SPAWN_LIKE_EFFECTS = Object.freeze([
    Object.freeze({ spawnIntent: 'breeding_spawn', cause: 'BREEDING', reasonPrefix: 'breeding_spawn' }),
    Object.freeze({ spawnIntent: 'normal_spawn', cause: 'EQUALITY_WILL', reasonPrefix: 'equality_will_spawn' }),
    Object.freeze({ spawnIntent: 'normal_spawn', cause: 'REINFORCEMENT_WILL', reasonPrefix: 'reinforcement_will_spawn' }),
    Object.freeze({ spawnIntent: 'normal_spawn', cause: 'SUPPORT_TROOPS_WILL', reasonPrefix: 'support_troops_will_spawn' }),
    Object.freeze({ spawnIntent: 'salvation_spawn', cause: 'SALVATION_WILL', reasonPrefix: 'salvation_spawn' }),
    Object.freeze({ spawnIntent: 'salvation_spawn', cause: STONE_SALVATION_GOD_CAUSE, reasonPrefix: STONE_SALVATION_GOD_REVIVE_REASON }),
    Object.freeze({ spawnIntent: 'normal_spawn', cause: 'SEED_WILL', reasonPrefix: 'seed_sprout' }),
    Object.freeze({ spawnIntent: 'clone_spawn', cause: 'CLONE_WILL', reasonPrefix: 'clone_spawn' }),
    Object.freeze({ spawnIntent: 'proliferation_spawn', cause: 'PROLIFERATION_WILL', reasonPrefix: 'proliferation_spawn' })
]);

const POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS = Object.freeze([
    Object.freeze({ spawnIntent: 'normal_spawn', cause: 'EQUALITY_WILL', reasonPrefix: 'equality_will_spawn' }),
    Object.freeze({ spawnIntent: 'normal_spawn', cause: 'REINFORCEMENT_WILL', reasonPrefix: 'reinforcement_will_spawn' }),
    Object.freeze({ spawnIntent: 'normal_spawn', cause: 'SUPPORT_TROOPS_WILL', reasonPrefix: 'support_troops_will_spawn' }),
    Object.freeze({ spawnIntent: 'salvation_spawn', cause: 'SALVATION_WILL', reasonPrefix: 'salvation_spawn' }),
    Object.freeze({ spawnIntent: 'normal_spawn', cause: 'SEED_WILL', reasonPrefix: 'seed_sprout' }),
    Object.freeze({ spawnIntent: 'salvation_spawn', cause: STONE_SALVATION_GOD_CAUSE, reasonPrefix: STONE_SALVATION_GOD_REVIVE_REASON })
]);

function getProfileCauses(profile: CauseReasonProfile | null | undefined): unknown[] {
    if (!profile) return [];
    if (Array.isArray(profile.causes)) return profile.causes;
    return profile.cause ? [profile.cause] : [];
}

function matchesCauseAndReasonPrefix(cause: unknown, reason: unknown, profile: CauseReasonProfile | null | undefined): boolean {
    if (!profile) return false;
    const normalizedCause = String(cause || '').toUpperCase();
    const normalizedReason = String(reason || '').toLowerCase();
    const causes = getProfileCauses(profile);
    const matchesCause = !causes.length || causes.some((expectedCause) => (
        normalizedCause === String(expectedCause || '').toUpperCase()
    ));
    return matchesCause &&
        normalizedReason.indexOf(String(profile.reasonPrefix || '').toLowerCase()) === 0;
}

function matchesCauseReasonProfile(subject: PresentationSubject | null | undefined, profile: CauseReasonProfile | null | undefined): boolean {
    return matchesCauseAndReasonPrefix(
        subject && subject.cause,
        subject && subject.reason,
        profile
    );
}

function matchesSpawnProfileTarget(target: PresentationSubject | null | undefined, cause: unknown, reason: unknown, profile: CauseReasonProfile | null | undefined): boolean {
    if (!matchesCauseAndReasonPrefix(cause, reason, profile)) return false;
    const expectedIntent = profile && profile.spawnIntent;
    const actualIntent = target && target.meta && target.meta.spawnIntent;
    if (!expectedIntent || actualIntent === undefined || actualIntent === null || actualIntent === '') return true;
    return String(actualIntent).toLowerCase() === String(expectedIntent).toLowerCase();
}

function isSpawnEventLike(ev: PresentationSubject | null | undefined, profile: CauseReasonProfile | null | undefined): boolean {
    if (!profile) return false;
    const eventIntent = ev && ev.meta ? String(ev.meta.spawnIntent || '').toLowerCase() : '';
    if (profile.spawnIntent && eventIntent && eventIntent !== String(profile.spawnIntent).toLowerCase()) {
        return false;
    }
    return matchesCauseReasonProfile(ev, profile);
}

export = {
    STONE_SALVATION_GOD_CAUSE,
    STONE_SALVATION_GOD_REVIVE_REASON,
    SPECIAL_DESTROY_TARGET_PROFILES,
    POSITIVE_SPAWN_LIKE_EFFECTS,
    POSITIVE_SPAWN_MIN_VISIBLE_EFFECTS,
    matchesCauseAndReasonPrefix,
    matchesCauseReasonProfile,
    matchesSpawnProfileTarget,
    isSpawnEventLike
};
