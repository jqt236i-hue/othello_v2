#!/usr/bin/env node
'use strict';

/**
 * SPRT (Sequential Probability Ratio Test) for model evaluation gates.
 *
 * Reference: Stockfish Fishtest implementation
 * Uses Elo-based hypotheses for early stopping with guaranteed error rates.
 */

class SPRT {
    /**
     * @param {object} opts
     * @param {number} [opts.elo0] - Null hypothesis Elo (default 0)
     * @param {number} [opts.elo1] - Alternative hypothesis Elo (default 2.5)
     * @param {number} [opts.alpha] - Type I error rate (default 0.05)
     * @param {number} [opts.beta] - Type II error rate (default 0.10)
     * @param {number} [opts.maxGames] - Maximum games before forced decision (default 400)
     */
    constructor({
        elo0 = 0,
        elo1 = 2.5,
        alpha = 0.05,
        beta = 0.10,
        maxGames = 400,
    } = {}) {
        this.elo0 = elo0;
        this.elo1 = elo1;
        this.alpha = alpha;
        this.beta = beta;
        this.maxGames = maxGames;

        // Log-likelihood ratio bounds
        this.lowerBound = Math.log(beta / (1 - alpha));
        this.upperBound = Math.log((1 - beta) / alpha);

        this.wins = 0;
        this.losses = 0;
        this.draws = 0;
        this.llr = 0.0;
    }

    /**
     * Convert Elo difference to win probability.
     * @param {number} elo
     * @returns {number}
     */
    eloToWinrate(elo) {
        return 1.0 / (1.0 + Math.pow(10, -elo / 400));
    }

    /**
     * Update SPRT with a new game result.
     * @param {number} result - 1 for win, 0 for draw, -1 for loss
     */
    update(result) {
        if (result > 0.5) {
            this.wins++;
        } else if (result < -0.5) {
            this.losses++;
        } else {
            this.draws++;
        }

        const n = this.wins + this.losses + this.draws;
        if (n === 0) return;

        const p0 = this.eloToWinrate(this.elo0);
        const p1 = this.eloToWinrate(this.elo1);
        const d = p1 - p0;

        // LLR calculation for trinomial (W/D/L)
        // Using Bayesian averaging to avoid log(0)
        const a = this.wins + 0.5;
        const b = this.losses + 0.5;
        const c = this.draws + 0.5;
        const total = a + b + c;

        const pW = a / total;
        const pL = b / total;
        const pD = c / total;

        // Expected draw probability under H0 and H1
        const pD0 = Math.max(1e-10, 1 - p0 - (p0 - d));
        const pD1 = Math.max(1e-10, 1 - p1 - (p1 - d));

        const pW0 = Math.max(1e-10, p0);
        const pW1 = Math.max(1e-10, p1);
        const pL0 = Math.max(1e-10, 1 - p0 - pD0);
        const pL1 = Math.max(1e-10, 1 - p1 - pD1);

        this.llr = (
            a * Math.log(pW1 / pW0) +
            b * Math.log(pL1 / pL0) +
            c * Math.log(pD1 / pD0)
        );
    }

    /**
     * Get current SPRT status.
     * @returns {{status: string, llr: number, games: number, wins: number, losses: number, draws: number}}
     *   status: 'accept' | 'reject' | 'continue'
     */
    getStatus() {
        const n = this.wins + this.losses + this.draws;

        if (n >= this.maxGames) {
            // Force decision based on LLR
            if (this.llr > 0) {
                return { status: 'accept', llr: this.llr, games: n, wins: this.wins, losses: this.losses, draws: this.draws };
            } else {
                return { status: 'reject', llr: this.llr, games: n, wins: this.wins, losses: this.losses, draws: this.draws };
            }
        }

        if (this.llr >= this.upperBound) {
            return { status: 'accept', llr: this.llr, games: n, wins: this.wins, losses: this.losses, draws: this.draws };
        }
        if (this.llr <= this.lowerBound) {
            return { status: 'reject', llr: this.llr, games: n, wins: this.wins, losses: this.losses, draws: this.draws };
        }

        return { status: 'continue', llr: this.llr, games: n, wins: this.wins, losses: this.losses, draws: this.draws };
    }

    /**
     * Create a quick gate SPRT (elo0=0, elo1=1.0, maxGames=120)
     * @returns {SPRT}
     */
    static quickGate() {
        return new SPRT({ elo0: 0, elo1: 1.0, alpha: 0.05, beta: 0.10, maxGames: 120 });
    }

    /**
     * Create a final gate SPRT (elo0=0, elo1=2.5, maxGames=400)
     * @returns {SPRT}
     */
    static finalGate() {
        return new SPRT({ elo0: 0, elo1: 2.5, alpha: 0.05, beta: 0.10, maxGames: 400 });
    }
}

module.exports = { SPRT };
