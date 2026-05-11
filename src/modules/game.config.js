/**
 * game.config.js — Outcome matrix, player pool, strategy metadata.
 * Pure data — no DOM, no Store. Importable anywhere including tests.
 */

export const DEMO_START_BAL = 1000;
export const RAKE = 0.05; // 5% platform fee on winnings only

/**
 * Prisoner's Dilemma outcome matrix.
 * Key format: `${myChoice}_${theirChoice}`
 */
export const OUTCOMES = {
  trust_trust: {
    title: 'Mutual Trust',
    sub:   'Both cooperated. You each gain +10%, minus 5% platform fee.',
    ico: '✓', ib: 'var(--gd)', ic: 'var(--g)', tc: 'var(--g)',
    mm: 0.1, tm: 0.1, type: 'win',
    ins: 'When both cooperate, everyone wins — the only true positive-sum outcome. A 5% fee is taken from each player\'s profit.',
  },
  trust_take: {
    title: 'Betrayed',
    sub:   'You trusted. They took. Your stake is gone.',
    ico: '✗', ib: 'var(--rd)', ic: 'var(--r)', tc: 'var(--r)',
    mm: -1, tm: 1, type: 'loss',
    ins: 'The defector wins your stake, minus a 5% fee on their gain. Your cooperative instinct still has higher expected value over many rounds.',
  },
  take_trust: {
    title: 'You Defected',
    sub:   'They trusted you. You took their stake.',
    ico: '!', ib: 'var(--yd)', ic: 'var(--y)', tc: 'var(--y)',
    mm: 1, tm: -1, type: 'mixed',
    ins: 'Maximum individual gain — you take their stake, minus a 5% platform fee on your profit. In repeated games with reputation, this destroys future value.',
  },
  take_take: {
    title: 'Mutual Defection',
    sub:   'Both defected. Both lose 20%. No fee on losses.',
    ico: '×', ib: 'var(--rd)', ic: 'var(--r)', tc: 'var(--r)',
    mm: -0.2, tm: -0.2, type: 'loss',
    ins: 'Both players acted rationally in isolation and produced the worst collective result. Nash equilibrium — and why cooperation is so rare and so valuable.',
  },
};

export const PLAYER_POOL = [
  { name: 'anon_k7x',  rounds: 34,  trust: 71, wins: 21,  strategy: 'tit_for_tat',    hist: 'TTTRTTTTTRTTT' },
  { name: 'silent_b',  rounds: 8,   trust: 50, wins: 4,   strategy: 'random',          hist: 'TRTTRTTR' },
  { name: 'p_valeria', rounds: 127, trust: 82, wins: 89,  strategy: 'generous_tft',    hist: 'TTTTTTTRTTTTTTT' },
  { name: 'cr0w',      rounds: 19,  trust: 26, wins: 8,   strategy: 'defector',        hist: 'RRRTRRRRRTRR' },
  { name: 'anon_r9',   rounds: 55,  trust: 62, wins: 31,  strategy: 'tit_for_tat',     hist: 'TTRTTRTTTTT' },
  { name: 'marco_d',   rounds: 3,   trust: 67, wins: 2,   strategy: 'random',          hist: 'TTR' },
  { name: 'f_anon',    rounds: 89,  trust: 44, wins: 34,  strategy: 'suspicious_tft',  hist: 'RRTRTTRRTTRR' },
  { name: 'player_z',  rounds: 201, trust: 78, wins: 143, strategy: 'generous_tft',    hist: 'TTTTTRTTTTTTTRT' },
  { name: 'anon_9j2',  rounds: 12,  trust: 55, wins: 6,   strategy: 'random',          hist: 'TRTRTRTTRRT' },
  { name: 'nightowl',  rounds: 41,  trust: 33, wins: 10,  strategy: 'defector',        hist: 'RRRRTRRRTRRR' },
];

/**
 * Training AI — анализирует последние 10 игр игрока и адаптируется.
 * Логика:
 *  - Если игрок доверяет >= 70% — ИИ начинает брать (эксплуатирует)
 *  - Если игрок берёт >= 60% — ИИ тоже берёт (наказывает)
 *  - Если игрок непредсказуем — ИИ играет tit-for-tat
 *  - Первые 3 раунда — ИИ всегда доверяет (устанавливает контакт)
 */
export function trainingAiChoice(playerHist) {
  const last10 = (playerHist || []).slice(0, 10);

  // Первые 3 раунда — доверяем
  if (last10.length < 3) return 'trust';

  const trustCount = last10.filter(h => h.my === 'trust').length;
  const takeCount  = last10.length - trustCount;
  const trustRate  = trustCount / last10.length;

  // Игрок слишком доверчив — эксплуатируем
  if (trustRate >= 0.7) return Math.random() < 0.75 ? 'take' : 'trust';

  // Игрок агрессивен — отвечаем тем же
  if (takeCount / last10.length >= 0.6) return Math.random() < 0.8 ? 'take' : 'trust';

  // Игрок непредсказуем — tit-for-tat по последнему ходу
  const lastMove = last10[0]?.my;
  return lastMove === 'trust' ? 'trust' : 'take';
}

export const TRAINING_STAKES = [1, 2]; // доступные ставки в training режиме

export const STRATEGY_META = {
  training_ai:    { label: 'Training AI',   color: 'var(--y)',  bg: 'var(--yd)',  border: 'var(--ym)',   desc: 'Adapts to your last 10 moves. Exploits predictable trust, punishes aggression, mirrors uncertainty.' },
  tit_for_tat:    { label: 'Tit-for-Tat',    color: 'var(--y)',  bg: 'var(--yd)',  border: 'var(--ym)',   desc: 'Mirrors your last move. Cooperated with you? They\'ll likely Trust. Betrayed them? Expect a Take.' },
  generous_tft:   { label: 'Cooperator',     color: 'var(--g)',  bg: 'var(--gd)',  border: 'var(--gm)',   desc: 'Strongly prefers Trust and rarely defects even after betrayal. High value in mutual rounds.' },
  suspicious_tft: { label: 'Skeptic',        color: 'var(--r)',  bg: 'var(--rd)',  border: 'var(--rm)',   desc: 'Opens with Take, then mirrors. First round against them is risky — they defect by default.' },
  defector:       { label: 'Defector',       color: 'var(--r)',  bg: 'var(--rd)',  border: 'var(--rm)',   desc: 'Strongly favors Take. Low trust rate. Expect a Take unless you\'ve cooperated many times.' },
  random:         { label: 'Unpredictable',  color: 'var(--t2)', bg: 'var(--l2)',  border: 'var(--rim2)', desc: 'No clear pattern — choices appear random. Hard to model. Flip a mental coin.' },
};
