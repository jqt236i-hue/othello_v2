declare function getEffectKeyForPendingType(pendingType: any): any;
declare function collectEffectImagePaths(effect: any): any[];
declare function isNormalStoneImagePath(imagePath: any): boolean;
declare function resolveEffectImagePath(effect: any, options?: {}): any;
declare function getCardVisualImagePaths(cardType: any): any[];
declare function resolveCardVisualImagePath(cardType: any, options?: {}): any;
declare function cardTypeUsesNonNormalStoneImage(cardType: any): boolean;
declare function getEffectKeyForSpecialType(type: any): any;
declare function setUIImpl(obj: any): void;
declare function applyStoneVisualEffect(discElement: any, effectKey: any, options?: {}): any;
/**
 * 石要素からビジュアル効果を削除
 * @param {HTMLElement} discElement - .disc 要素
 * @param {string} effectKey - 削除する効果キー
 */
declare function removeStoneVisualEffect(discElement: any, effectKey: any): any;
/**
 * サポート対象のビジュアル効果キー一覧を取得
 * @returns {string[]}
 */
declare function getSupportedEffectKeys(): string[];
/**
 * === 新規カード効果の追加方法 ===
 *
 * STONE_VISUAL_EFFECTS にマップを追加するだけで OK。
 *
 * 例1：背景画像パターン（金の意志と同じ方式）
 *
 *   iceShield: {
 *       cssClass: 'ice-shield',
 *       cssMethod: 'background',
 *       imagePath: 'assets/images/stones/ice-shield.png',
 *       dataAttributes: {}
 *   }
 *
 * 例2：擬似要素パターン（究極反転龍と同じ方式、所有者別画像）
 *
 *   flameOrb: {
 *       cssClass: 'flame-orb',
 *       cssMethod: 'pseudoElement',
 *       imagePathByOwner: {
 *           1: 'assets/images/stones/flame-orb-white.png',    // BLACK owner
 *           '-1': 'assets/images/stones/flame-orb-black.png'   // WHITE owner
 *       },
 *       dataAttributes: { 'data-flame': 'active' }
 *   }
 *
 * 例3：使用コード（ui.js 内の renderBoard 内など）
 *
 *   if (someEffect) {
 *       applyStoneVisualEffect(disc, 'iceShield');
 *   }
 *
 *   if (anotherEffect && owner !== undefined) {
 *       applyStoneVisualEffect(disc, 'flameOrb', { owner });
 *   }
 *
 * 例4：CSS側（styles-board.css）
 *
 *   // iceShield の場合（背景画像）
 *   .disc.ice-shield {
 *       background-image: url('assets/images/stones/ice-shield.png') !important;
 *       background-size: 100% 100% !important;
 *       border: none !important;
 *   }
 *
 *   // flameOrb の場合（::before擬似要素）
 *   .disc.flame-orb::before {
 *       content: '';
 *       background-size: contain;
 *       background-position: center center;
 *       background-repeat: no-repeat;
 *   }
 *
 *   .disc.flame-orb[data-flame="active"] {
 *       // 追加スタイル
 *       box-shadow: 0 0 15px rgba(255, 100, 0, 0.8);
 *   }
 */
declare const _default: {
    STONE_VISUAL_EFFECTS: {
        goldStone: {
            cssClass: string;
            cssMethod: string;
            imagePath: string;
            dataAttributes: {};
        };
        silverStone: {
            cssClass: string;
            cssMethod: string;
            imagePath: string;
            dataAttributes: {};
        };
        rainbowStone: {
            cssClass: string;
            cssMethod: string;
            imagePath: string;
            dataAttributes: {};
        };
        crystalStone: {
            cssClass: string;
            cssMethod: string;
            imagePath: string;
            dataAttributes: {};
        };
        protectedStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            backgroundSize: string;
            dataAttributes: {};
            clearStyles: {
                'background-color': string;
            };
        };
        absoluteProtectedStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            backgroundSize: string;
            dataAttributes: {};
            clearStyles: {
                'background-color': string;
            };
        };
        protectedStoneTemporary: {
            cssClass: string;
            cssMethod: string;
            imagePath: string;
            backgroundSize: string;
            dataAttributes: {};
            clearStyles: {
                'background-color': string;
            };
        };
        ultimateDragon: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        breedingStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        proliferationStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        ultimateDestroyGod: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        sniperStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        lightningStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        observerStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        ghostStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        afterimageStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        willHunterKingStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        destroyDragonStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        hyperactiveStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        escapeHyperactiveStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        extremeHyperactiveStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        robotVacuumStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        gluttonousStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        ultimateHyperactiveGod: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        regenStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        workStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            backgroundSize: string;
            dataAttributes: {};
        };
        timeBombStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        timeStopStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        crossBombStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        xBombStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
        trapStone: {
            cssClass: string;
            cssMethod: string;
            imagePathByOwner: {
                '1': string;
                '-1': string;
            };
            dataAttributes: {};
        };
    };
    PENDING_TYPE_TO_EFFECT_KEY: {
        PROTECTED_NEXT_STONE: string;
        PERMA_PROTECT_NEXT_STONE: string;
        ULTIMATE_REVERSE_DRAGON: string;
        BREEDING_WILL: string;
        PROLIFERATION_WILL: string;
        ULTIMATE_DESTROY_GOD: string;
        SNIPER_WILL: string;
        LIGHTNING_WILL: string;
        OBSERVER_WILL: string;
        GHOST_WILL: string;
        AFTERIMAGE_WILL: string;
        WILL_HUNTER_KING: string;
        DESTROY_DRAGON_WILL: string;
        ULTIMATE_HYPERACTIVE_GOD: string;
        HYPERACTIVE_WILL: string;
        HYPERACTIVE_INHERIT_WILL: string;
        EXTREME_HYPERACTIVE_WILL: string;
        ESCAPE_WILL: string;
        ROBOT_VACUUM_WILL: string;
        GLUTTONOUS_WILL: string;
        INSTANT_HYPERACTIVE_WILL: string;
        REGEN_WILL: string;
        GOLD_STONE: string;
        RAINBOW_STONE: string;
        SILVER_STONE: string;
        CRYSTAL_STONE: string;
        WORK_WILL: string;
        TIME_BOMB: string;
        TIME_STOP_GOD: string;
        CROSS_BOMB: string;
        X_BOMB: string;
        TRAP_WILL: string;
    };
    getEffectKeyForPendingType: typeof getEffectKeyForPendingType;
    collectEffectImagePaths: typeof collectEffectImagePaths;
    resolveEffectImagePath: typeof resolveEffectImagePath;
    getCardVisualImagePaths: typeof getCardVisualImagePaths;
    resolveCardVisualImagePath: typeof resolveCardVisualImagePath;
    isNormalStoneImagePath: typeof isNormalStoneImagePath;
    cardTypeUsesNonNormalStoneImage: typeof cardTypeUsesNonNormalStoneImage;
    SPECIAL_TYPE_TO_EFFECT_KEY: {
        PROTECTED: string;
        PERMA_PROTECTED: string;
        DRAGON: string;
        BREEDING: string;
        PROLIFERATION: string;
        ULTIMATE_DESTROY_GOD: string;
        SNIPER: string;
        LIGHTNING: string;
        OBSERVER: string;
        GHOST: string;
        AFTERIMAGE_WILL: string;
        WILL_HUNTER_KING: string;
        DESTROY_DRAGON: string;
        ULTIMATE_HYPERACTIVE: string;
        HYPERACTIVE: string;
        INHERITED_HYPERACTIVE: string;
        EXTREME_HYPERACTIVE: string;
        ESCAPE_HYPERACTIVE: string;
        ROBOT_VACUUM: string;
        GLUTTONOUS: string;
        REGEN: string;
        GOLD: string;
        RAINBOW: string;
        SILVER: string;
        CRYSTAL: string;
        WORK: string;
        TIME_BOMB: string;
        TIME_STOP: string;
        CROSS_BOMB: string;
        X_BOMB: string;
        TRAP: string;
        TRAP_REVEAL: string;
        ABSOLUTE_PROTECTED: string;
    };
    getEffectKeyForSpecialType: typeof getEffectKeyForSpecialType;
    applyStoneVisualEffect: typeof applyStoneVisualEffect;
    removeStoneVisualEffect: typeof removeStoneVisualEffect;
    getSupportedEffectKeys: typeof getSupportedEffectKeys;
    setUIImpl: typeof setUIImpl;
};
export = _default;
//# sourceMappingURL=visual-effects-map.d.ts.map