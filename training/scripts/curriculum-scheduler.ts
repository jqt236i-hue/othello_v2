/**
 * @file curriculum-scheduler.ts
 * @description 4-stage curriculum learning scheduler for Card Reversi AI training.
 *
 * Stage 1: Normal Reversi only (no cards) - Basic strategy learning
 * Stage 2: Low-frequency simple cards - Card basics
 * Stage 3: Medium-frequency all cards - Card integration
 * Stage 4: Free play (MCTS optimized) - Strategic integration
 */

interface CurriculumStage {
    name: string;
    description: string;
    startRatio: number;
    endRatio: number;
    cardUsageRate: number;
    allowedCards: string[] | 'all';
    tacticalDepthOpening: number;
    tacticalDepthMid: number;
    tacticalDepthEnd: number;
    tacticalBeamWidth: number;
    startIter?: number;
    endIter?: number;
}

interface StageParams {
    cardUsageRate: number;
    allowedCards: string[] | 'all';
    tacticalDepthOpening: number;
    tacticalDepthMid: number;
    tacticalDepthEnd: number;
    tacticalBeamWidth: number;
}

const CURRICULUM_STAGES: CurriculumStage[] = [
    {
        name: 'basic_strategy',
        description: '基本戦略学習',
        startRatio: 0.0,
        endRatio: 0.3,
        cardUsageRate: 0.0,
        allowedCards: [],
        tacticalDepthOpening: 4,
        tacticalDepthMid: 5,
        tacticalDepthEnd: 6,
        tacticalBeamWidth: 6,
    },
    {
        name: 'card_basics',
        description: 'カード基礎学習',
        startRatio: 0.3,
        endRatio: 0.6,
        cardUsageRate: 0.05,
        allowedCards: ['PROTECTED_NEXT_STONE', 'GHOST_WILL', 'SUPPLY_WILL', 'HEAVEN_BLESSING'],
        tacticalDepthOpening: 4,
        tacticalDepthMid: 5,
        tacticalDepthEnd: 6,
        tacticalBeamWidth: 6,
    },
    {
        name: 'card_integration',
        description: 'カード統合学習',
        startRatio: 0.6,
        endRatio: 0.8,
        cardUsageRate: 0.15,
        allowedCards: 'all',
        tacticalDepthOpening: 5,
        tacticalDepthMid: 6,
        tacticalDepthEnd: 7,
        tacticalBeamWidth: 8,
    },
    {
        name: 'strategic_integration',
        description: '戦略統合学習',
        startRatio: 0.8,
        endRatio: 1.0,
        cardUsageRate: -1, // Let MCTS decide
        allowedCards: 'all',
        tacticalDepthOpening: 6,
        tacticalDepthMid: 7,
        tacticalDepthEnd: 8,
        tacticalBeamWidth: 10,
    },
];

interface SchedulerOptions {
    totalIterations?: number;
    stages?: CurriculumStage[];
}

class CurriculumScheduler {
    totalIterations: number;
    stages: CurriculumStage[];

    constructor({ totalIterations = 100, stages = CURRICULUM_STAGES }: SchedulerOptions = {}) {
        this.totalIterations = totalIterations;
        this.stages = stages.map(s => ({
            ...s,
            startIter: Math.floor(s.startRatio * totalIterations),
            endIter: Math.floor(s.endRatio * totalIterations),
        }));
    }

    /**
     * Get current stage for iteration number.
     */
    getStage(iteration: number): CurriculumStage | null {
        for (const stage of this.stages) {
            if (iteration >= stage.startIter! && iteration < stage.endIter!) {
                return stage;
            }
        }
        // Default to last stage
        return this.stages[this.stages.length - 1];
    }

    /**
     * Get training parameters for current iteration.
     */
    getParams(iteration: number): StageParams {
        const stage = this.getStage(iteration);
        if (!stage) {
            return {
                cardUsageRate: 0.1,
                allowedCards: 'all',
                tacticalDepthOpening: 5,
                tacticalDepthMid: 6,
                tacticalDepthEnd: 7,
                tacticalBeamWidth: 8,
            };
        }

        return {
            cardUsageRate: stage.cardUsageRate,
            allowedCards: stage.allowedCards,
            tacticalDepthOpening: stage.tacticalDepthOpening,
            tacticalDepthMid: stage.tacticalDepthMid,
            tacticalDepthEnd: stage.tacticalDepthEnd,
            tacticalBeamWidth: stage.tacticalBeamWidth,
        };
    }

    /**
     * Check if a card is allowed in current stage.
     */
    isCardAllowed(iteration: number, cardId: string): boolean {
        const stage = this.getStage(iteration);
        if (!stage) return true;
        if (stage.allowedCards === 'all') return true;
        if (Array.isArray(stage.allowedCards)) {
            return stage.allowedCards.includes(cardId);
        }
        return true;
    }

    /**
     * Get card usage rate for current iteration.
     */
    getCardUsageRate(iteration: number): number {
        const stage = this.getStage(iteration);
        if (!stage) return 0.1;
        return stage.cardUsageRate;
    }

    /**
     * Print curriculum schedule.
     */
    printSchedule() {
        console.log('[curriculum] 4-Stage Curriculum Schedule');
        console.log('='.repeat(60));
        for (const stage of this.stages) {
            console.log(`Stage: ${stage.name} (${stage.description})`);
            console.log(`  Iterations: ${stage.startIter} - ${stage.endIter}`);
            console.log(`  Card Usage: ${stage.cardUsageRate}`);
            console.log(`  Allowed Cards: ${Array.isArray(stage.allowedCards) ? stage.allowedCards.join(', ') : stage.allowedCards}`);
            console.log(`  Tactical Depth: ${stage.tacticalDepthOpening}/${stage.tacticalDepthMid}/${stage.tacticalDepthEnd}`);
            console.log(`  Beam Width: ${stage.tacticalBeamWidth}`);
            console.log();
        }
    }
}

export = {  CurriculumScheduler, CURRICULUM_STAGES  } as any;

// CLI
if (require.main === module) {
    const scheduler = new CurriculumScheduler({ totalIterations: 100 });
    scheduler.printSchedule();

    // Test some iterations
    const testIters = [0, 29, 30, 59, 60, 79, 80, 99];
    for (const iter of testIters) {
        const stage = scheduler.getStage(iter);
        const params = scheduler.getParams(iter);
        console.log(`Iteration ${iter}: stage=${stage!.name} cardRate=${params.cardUsageRate}`);
    }
}
