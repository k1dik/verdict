/**
 * matchmaking.js — P2P matchmaking engine.
 *
 * Responsibilities:
 *  - Supabase Realtime P2P (реальные игроки через интернет)
 *  - Simulated opponent fallback (demo mode)
 *  - Opponent reputation rendering across all UI slots
 *  - Live feed + dots animation
 */

import { G }                             from '../store/store.js';
import { PLAYER_POOL, STRATEGY_META, trainingAiChoice } from './game.config.js';
import { supabase }                      from '../supabase.js';

const $ = id => document.getElementById(id);
const fmt = n => n.toFixed(2);

// ── REPUTATION RENDERING ────────────────────────────────────

function histDotsHtml(hist, size = 10) {
  if (!hist) return '<span style="font-size:10px;color:var(--t3);font-family:var(--mono)">No data</span>';
  return hist.split('').map(c => {
    const isTrust = c === 'T';
    return `<div class="hdot" style="width:${size}px;height:${size}px;background:${isTrust ? 'var(--g)' : 'var(--r)'}"></div>`;
  }).join('');
}

function trustBarColor(pct) {
  if (pct >= 65) return 'var(--g)';
  if (pct >= 40) return 'var(--y)';
  return 'var(--r)';
}

function applyBadge(el, sm) {
  if (!el || !sm) return;
  el.textContent       = sm.label;
  el.style.background  = sm.bg;
  el.style.color       = sm.color;
  el.style.border      = `1px solid ${sm.border}`;
}

export function renderOppRep(opp) {
  if (!opp || typeof opp.trust === 'string') return;
  const sm       = STRATEGY_META[opp.strategy] || STRATEGY_META.random;
  const pct      = opp.trust;
  const hist     = opp.hist || '';
  const barColor = trustBarColor(pct);

  const oppCard = $('wt-opp-card');
  if (oppCard) oppCard.className = 'matched-opp-card' + (pct >= 65 ? ' trust-heavy' : pct < 40 ? ' take-heavy' : ' balanced');
  set('wt-trust-big',    el => { el.textContent = pct + '%'; el.style.color = barColor; });
  set('wt-rounds-total', el => el.textContent = opp.rounds);
  set('wt-trust-bar',    el => { el.style.width = pct + '%'; el.style.background = barColor; });
  set('wt-hist-dots',    el => el.innerHTML = histDotsHtml(hist.slice(0, 12), 12));
  set('wt-strat-badge',  el => applyBadge(el, sm));
  set('wt-tendency',     el => el.textContent = sm.desc);

  set('nr-av',         el => { el.textContent = opp.name[0].toUpperCase(); el.style.color = barColor; el.style.borderColor = barColor + '66'; });
  set('nr-name',       el => el.textContent = opp.name);
  set('nr-rounds-lbl', el => el.textContent = `${opp.rounds} rounds played`);
  set('nr-trust-pct',  el => { el.textContent = pct + '%'; el.style.color = barColor; });
  set('nr-trust-bar',  el => { el.style.width = pct + '%'; el.style.background = barColor; });
  set('nr-hist-dots',  el => el.innerHTML = histDotsHtml(hist.slice(0, 10), 9));
  set('nr-hist-note',  el => el.textContent = `Last ${Math.min(hist.length, 10)} decisions shown · Tap for full profile →`);
  set('nr-strat-badge',el => applyBadge(el, sm));

  set('sh-opp-av',       el => { el.textContent = opp.name[0].toUpperCase(); el.style.color = barColor; el.style.borderColor = barColor + '55'; });
  set('sh-opp-name',     el => el.textContent = opp.name);
  set('sh-trust-pct-big',el => { el.textContent = pct + '%'; el.style.color = barColor; });
  set('sh-rounds-desc',  el => el.textContent = `${opp.rounds} rounds played`);
  set('sh-wins-desc',    el => el.textContent = opp.wins !== undefined ? `${opp.wins} wins · ${100 - pct}% Take rate` : `${100 - pct}% Take rate`);
  set('sh-trust-bar',    el => { el.style.width = pct + '%'; el.style.background = barColor; });
  set('sh-hist-dots',    el => el.innerHTML = histDotsHtml(hist, 12));
  set('sh-hist-count',   el => el.textContent = `Last ${hist.length} decisions`);
  set('sh-opp-strat-tag',el => applyBadge(el, sm));
  set('sh-tendency-long',el => el.textContent = sm.desc);

  set('rs-opp-rep-av',   el => { el.textContent = opp.name[0].toUpperCase(); el.style.color = barColor; });
  set('rs-opp-rep-name', el => el.textContent = opp.name);
  set('rs-opp-rep-bar',  el => { el.style.width = pct + '%'; el.style.background = barColor; });
  set('rs-opp-rep-pct',  el => el.textContent = pct + '% Trust Rate');
  set('rs-opp-rep-badge',el => applyBadge(el, sm));
  set('rs-opp-rep-dots', el => el.innerHTML = histDotsHtml(hist.slice(0, 5), 8));
}

export function renderRealPlayerRep() {
  ['wt-trust-big', 'wt-rounds-total', 'wt-tendency'].forEach(id => set(id, el => el.textContent = '—'));
  ['nr-trust-pct', 'nr-rounds-lbl'].forEach(id => set(id, el => el.textContent = ''));
  ['wt-strat-badge', 'nr-strat-badge', 'rs-opp-rep-badge', 'sh-opp-strat-tag'].forEach(id =>
    set(id, el => { el.textContent = 'Real Player'; el.style.background = 'var(--l2)'; el.style.color = 'var(--t3)'; el.style.border = '1px solid var(--rim2)'; })
  );
  ['wt-trust-bar', 'nr-trust-bar', 'sh-trust-bar', 'rs-opp-rep-bar'].forEach(id => set(id, el => el.style.width = '0%'));
  ['wt-hist-dots', 'nr-hist-dots', 'sh-hist-dots', 'rs-opp-rep-dots'].forEach(id =>
    set(id, el => el.innerHTML = '<span style="font-size:10px;color:var(--t3);font-family:var(--mono)">No history — new match</span>')
  );
  set('nr-hist-note',    el => el.textContent = 'First-time match — no prior history');
  set('sh-tendency-long',el => el.textContent = 'This is a real player. No behavioral data is available — decisions are fully hidden until reveal.');
}

// ── STRATEGY SIMULATION ─────────────────────────────────────

function simulateChoice(player, myLastChoice) {
  switch (player.strategy) {
    case 'tit_for_tat':
      return (myLastChoice === null || myLastChoice === 'trust') ? 'trust' : 'take';
    case 'generous_tft':
      if (myLastChoice === 'take' && Math.random() < 0.3) return 'trust';
      return (myLastChoice === null || myLastChoice === 'trust') ? 'trust' : 'take';
    case 'suspicious_tft':
      return myLastChoice === null ? 'take' : (myLastChoice === 'trust' ? 'trust' : 'take');
    case 'defector':
      return Math.random() < 0.8 ? 'take' : 'trust';
    case 'random':
    default:
      return Math.random() < 0.5 ? 'trust' : 'take';
  }
}

// ── LIVE FEED ───────────────────────────────────────────────

const FEED_MESSAGES = [
  v => `anon_${Math.floor(Math.random() * 900 + 100)} joined at $${v}`,
  v => `player found · $${v} · round starting`,
  v => `anon_${Math.floor(Math.random() * 900 + 100)} is deciding…`,
  () => `match completed · both chose TRUST`,
  () => `match completed · betrayal detected`,
  v => `new player at $${v} stake`,
  () => `3 players in queue`,
  () => `match completed · mutual defect`,
];

let dotInterval  = null;
let feedInterval = null;
let feedIndex    = 0;

function startDots(id) {
  let d = 0;
  if (dotInterval) clearInterval(dotInterval);
  dotInterval = setInterval(() => {
    const el = $(id);
    if (el) el.textContent = '.'.repeat(++d % 4);
  }, 500);
}

function stopDots() {
  if (dotInterval) { clearInterval(dotInterval); dotInterval = null; }
}

function startFeed(stake) {
  const container = $('wt-feed-items');
  if (!container) return;
  const addRow = () => {
    const msg = FEED_MESSAGES[feedIndex % FEED_MESSAGES.length](fmt(stake));
    feedIndex++;
    const row = document.createElement('div');
    row.style.cssText = 'padding:10px 16px;border-bottom:1px solid var(--rim);display:flex;align-items:center;justify-content:space-between;animation:scrIn .3s ease both';
    const now  = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
    row.innerHTML = `<span style="font-size:11px;color:var(--t3)">${msg}</span><span style="font-size:10px;color:var(--t4);font-family:var(--mono)">${time}</span>`;
    if (container.children.length >= 3) container.removeChild(container.firstChild);
    container.appendChild(row);
  };
  addRow();
  if (feedInterval) clearInterval(feedInterval);
  feedInterval = setInterval(addRow, 1800 + Math.random() * 1400);
}

function stopFeed() {
  if (feedInterval) { clearInterval(feedInterval); feedInterval = null; }
}

// ── SUPABASE REALTIME MATCHMAKING ───────────────────────────

let realtimeChannel = null;
let matched         = false;
let currentOpponent = null;
let onResolveCallback = null;
let myRoomId        = null;

function updateOnlineCount() {
  const base = 23 + Math.floor(Math.sin(Date.now() / 60000) * 8 + 8);
  set('wt-online-count', el => el.textContent = base + ' online');
}

function showMatchedPhase(opponent) {
  currentOpponent = opponent;
  $('wt-phase-search').style.display = 'none';
  $('wt-phase-matched').style.display = 'flex';
  set('wt-opp-name', el => el.textContent = opponent.name);
  const decArea  = $('wt-decision-area');
  const lockArea = $('wt-choice-made-area');
  if (decArea)  decArea.style.display  = 'flex';
  if (lockArea) lockArea.style.display = 'none';
  opponent.real ? renderRealPlayerRep(opponent) : renderOppRep(opponent);
  if (typeof window.startDecisionTimer === 'function') window.startDecisionTimer();
}

function cleanupRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function trySupabaseRealtime(stake) {
  if (!G.userId) return false;

  myRoomId = G.userId + '_' + Date.now();
  const channelName = `mm_stake_${Math.round(stake)}`;

  realtimeChannel = supabase.channel(channelName, {
    config: { broadcast: { self: false } }
  });

  realtimeChannel
    .on('broadcast', { event: 'seeking' }, ({ payload }) => {
      if (matched || payload.roomId === myRoomId) return;
      matched = true;
      stopFeed(); stopDots();
      realtimeChannel.send({
        type: 'broadcast', event: 'match',
        payload: { to: payload.roomId, from: myRoomId, name: G.name, rounds: G.rounds, trust: G.rounds ? Math.round((G.trusts / G.rounds) * 100) : 50 }
      });
      showMatchedPhase({
        name:    payload.name   || ('anon_' + payload.roomId.slice(0, 6)),
        rounds:  payload.rounds || 0,
        trust:   payload.trust  || 50,
        real:    true,
        _roomId: payload.roomId,
      });
    })
    .on('broadcast', { event: 'match' }, ({ payload }) => {
      if (matched || payload.to !== myRoomId) return;
      matched = true;
      stopFeed(); stopDots();
      showMatchedPhase({
        name:    payload.name   || ('anon_' + payload.from.slice(0, 6)),
        rounds:  payload.rounds || 0,
        trust:   payload.trust  || 50,
        real:    true,
        _roomId: payload.from,
      });
    })
    .on('broadcast', { event: 'choice' }, ({ payload }) => {
      if (payload.to !== myRoomId) return;
      stopDots(); stopFeed();
      if (onResolveCallback) {
        onResolveCallback(payload.choice, currentOpponent, true);
        cleanupRealtime();
      } else {
        if (currentOpponent) currentOpponent._theirChoice = payload.choice;
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        realtimeChannel.send({
          type: 'broadcast', event: 'seeking',
          payload: { roomId: myRoomId, name: G.name, rounds: G.rounds, trust: G.rounds ? Math.round((G.trusts / G.rounds) * 100) : 50, stake }
        });
      }
    });

  return true;
}

// ── PUBLIC API ──────────────────────────────────────────────

export const MM = {
  previewOpponent() {
    const opp = PLAYER_POOL[Math.floor(Math.random() * PLAYER_POOL.length)];
    renderOppRep(opp);
    set('nr-hist-note', el => el.textContent = 'Preview · actual opponent assigned at start · Tap for full profile →');
  },

  start(stake) {
    onResolveCallback = null;
    matched           = false;
    currentOpponent   = null;
    feedIndex         = 0;

    $('wt-phase-search').style.display  = 'flex';
    $('wt-phase-matched').style.display = 'none';
    $('wt-feed-items').innerHTML = '';
    startDots('wt-dots');
    startFeed(stake);
    updateOnlineCount();

    // Training режим — мгновенно показываем ИИ противника
    if (G.mode === 'training') {
      matched = true;
      stopFeed(); stopDots();
      showMatchedPhase({
        name:     'Training AI',
        rounds:   999,
        trust:    50,
        wins:     0,
        strategy: 'training_ai',
        hist:     '',
        real:     false,
        isAI:     true,
      });
      return;
    }

    // Training режим — только AI, без Realtime
    if (G.mode !== 'training') trySupabaseRealtime(stake);

    if (G.mode === 'real') return;

    const searchTime    = 2200 + Math.random() * 2800;
    const searchTimeout = setTimeout(() => {
      if (matched) return;
      const opp = PLAYER_POOL[Math.floor(Math.random() * PLAYER_POOL.length)];
      matched = true;
      stopFeed(); stopDots();
      showMatchedPhase({ ...opp, real: false });
    }, searchTime);

    const cancelCheck = setInterval(() => {
      if (matched) { clearTimeout(searchTimeout); clearInterval(cancelCheck); }
    }, 100);
  },

  resolveWithChoice(myChoice, onResolve) {
    if (!currentOpponent) return;
    G.myC = myChoice;

    if (currentOpponent.real && realtimeChannel) {
      // Если соперник уже прислал свой выбор — сразу резолвим
      if (currentOpponent._theirChoice) {
        stopDots(); stopFeed();
        onResolve(currentOpponent._theirChoice, currentOpponent, true);
        cleanupRealtime();
        return;
      }
      onResolveCallback = onResolve;
      realtimeChannel.send({
        type:    'broadcast',
        event:   'choice',
        payload: { choice: myChoice, to: currentOpponent._roomId, from: myRoomId },
      });
    } else {
      const decideTime = 1200 + Math.random() * 2000;
      setTimeout(() => {
        stopDots();
        cleanupRealtime();
        const theirChoice = currentOpponent?.isAI
          ? trainingAiChoice(G.hist)
          : simulateChoice(currentOpponent, G.hist.length ? G.hist[0].my : null);
        onResolve(theirChoice, currentOpponent, false);
      }, decideTime);
    }
  },

  cleanup() {
    matched = true; // блокируем поздние broadcast-события после отмены
    stopDots(); stopFeed();
    cleanupRealtime();
  },

  renderOppRep,
  renderRealPlayerRep,
};

// ── HELPERS ─────────────────────────────────────────────────
function set(id, fn) { const el = $(id); if (el) fn(el); }
