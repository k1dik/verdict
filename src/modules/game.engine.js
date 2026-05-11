/**
 * game.engine.js — Round resolution. Pure logic, zero DOM.
 *
 * Takes a choice pair, returns a resolution result.
 * Store update happens here — DOM update is the caller's job.
 *
 * Usage:
 *   import { resolveRound, calcTrustRate } from './game.engine.js'
 *   const result = resolveRound('trust', 'take', 25)
 *   // result = { outcome, myDelta, theirDelta, rakeAmt, newBal, ... }
 */

import { G }                      from '../store/store.js';
import { OUTCOMES, RAKE }         from './game.config.js';

/**
 * Resolve a single round. Mutates Store. Returns result for DOM rendering.
 * @param {string} myChoice   - 'trust' | 'take'
 * @param {string} theirChoice - 'trust' | 'take'
 * @param {number} stake
 * @returns {ResolveResult}
 */
export function resolveRound(myChoice, theirChoice, stake) {
  const key = `${myChoice}_${theirChoice}`;
  const outcome = OUTCOMES[key];
  if (!outcome) throw new Error(`Unknown outcome key: ${key}`);

  const { myDelta, theirDelta, rakeAmt } = calcDeltas(outcome, stake);

  // ── Mutate store (triggers all subscribers) ──
  G.bal    = parseFloat(Math.max(0, G.bal + myDelta).toFixed(2));
  G.pnl    = parseFloat((G.pnl + myDelta).toFixed(2));
  G.waged  = parseFloat((G.waged + stake).toFixed(2));
  G.rake   = parseFloat(((G.rake || 0) + rakeAmt).toFixed(2));
  G.rounds = G.rounds + 1;
  if (outcome.type === 'win')   G.wins   = G.wins + 1;
  if (myChoice === 'trust')     G.trusts = G.trusts + 1;

  const entry = { title: outcome.title, t: outcome.type, stake, my: myChoice, them: theirChoice, d: myDelta, rake: rakeAmt };
  G.hist  = [entry,          ...G.hist.slice(0, 19)];
  G.txns  = [{ lbl: `Round ${G.rid}: ${outcome.title}`, d: myDelta }, ...G.txns.slice(0, 19)];
  G.rid   = G.rid + 1;

  return { outcome, myDelta, theirDelta, rakeAmt, newBal: G.bal };
}

/**
 * Calculate deltas from an outcome and stake. Pure function — no side effects.
 */
export function calcDeltas(outcome, stake) {
  let myDelta, theirDelta, rakeAmt = 0;

  if (outcome.mm === -1) {
    // Betrayed: lose full stake, no fee
    myDelta    = -stake;
    theirDelta = parseFloat((stake * (1 - RAKE)).toFixed(2));
    rakeAmt    = 0;
  } else if (outcome.mm === 1) {
    // Defected: win full stake minus fee
    const gross = stake;
    rakeAmt    = parseFloat((gross * RAKE).toFixed(2));
    myDelta    = parseFloat((gross - rakeAmt).toFixed(2));
    theirDelta = -stake;
  } else {
    // Partial win/loss (trust_trust or take_take)
    const gross = parseFloat((stake * outcome.mm).toFixed(2));
    if (gross > 0) {
      // trust_trust: оба выигрывают — rake с выигрыша
      rakeAmt    = parseFloat((gross * RAKE).toFixed(2));
      myDelta    = parseFloat((gross - rakeAmt).toFixed(2));
    } else {
      // take_take: оба проигрывают — потери идут платформе как rake
      rakeAmt    = parseFloat((Math.abs(gross) * 1).toFixed(2)); // вся потеря = rake
      myDelta    = gross; // игрок теряет 20% как и раньше
    }
    theirDelta = parseFloat((stake * outcome.tm).toFixed(2));
  }

  return {
    myDelta:    parseFloat(myDelta.toFixed(2)),
    theirDelta: parseFloat(theirDelta.toFixed(2)),
    rakeAmt,
  };
}

/** Derived stats — computed from current Store state. */
export const stats = {
  trustRate: () => G.rounds ? Math.round((G.trusts / G.rounds) * 100) : 0,
  winRate:   () => G.rounds ? Math.round((G.wins   / G.rounds) * 100) : 0,
  trustColor: () => {
    const tr = stats.trustRate();
    return tr >= 60 ? 'var(--g)' : tr >= 40 ? 'var(--y)' : 'var(--r)';
  },
};
