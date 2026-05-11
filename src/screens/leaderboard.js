/**
 * leaderboard.js — localStorage leaderboard.
 * Extracted from verdict-v27.
 */

import { G } from '../store/store.js';

const LB_KEY = 'verdict_lb_v1';

export function lbLoad()          { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch (e) { return []; } }
export function lbSave(entries)   { localStorage.setItem(LB_KEY, JSON.stringify(entries)); }

export function lbUpsert() {
  if (!G.rounds) return;
  const entries = lbLoad();
  const tr      = G.rounds ? Math.round((G.trusts / G.rounds) * 100) : 0;
  const existing = entries.findIndex(e => e.id === G.uid);
  const record   = { id: G.uid, name: G.name, bal: G.bal, pnl: G.pnl, rounds: G.rounds, wins: G.wins, trust: tr, ts: Date.now() };
  if (existing >= 0) entries[existing] = record;
  else entries.push(record);
  lbSave(entries);
}

let lbTab = 'bal';

export function lbSetTab(t) {
  lbTab = t;
  ['bal','pnl','trust'].forEach(k => {
    const el = document.getElementById('lb-tab-' + k); if (!el) return;
    el.style.color            = k === t ? 'var(--r)' : 'var(--t3)';
    el.style.borderBottomColor = k === t ? 'var(--r)' : 'transparent';
  });
  renderLeaderboard();
}

export function renderLeaderboard() {
  lbUpsert();
  const entries = lbLoad();
  const sorted  = [...entries].sort((a, b) => {
    if (lbTab === 'bal')   return b.bal   - a.bal;
    if (lbTab === 'pnl')   return b.pnl   - a.pnl;
    if (lbTab === 'trust') return b.trust - a.trust;
    return 0;
  });

  const myIdx  = sorted.findIndex(e => e.id === G.uid);
  const rankEl = document.getElementById('lb-my-rank-num');
  if (rankEl) rankEl.textContent = myIdx >= 0 ? '#' + (myIdx + 1) : '#—';

  const list = document.getElementById('lb-list');
  if (!list) return;
  if (!sorted.length) {
    list.innerHTML = '<div style="padding:40px 20px;text-align:center;font-size:14px;color:var(--t3);font-family:var(--mono)">Play a round to appear here.</div>';
    return;
  }

  const rankClass  = i => i === 0 ? 'gold'  : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  const rankSymbol = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);

  list.innerHTML = sorted.slice(0, 20).map((e, i) => {
    const isMe      = e.id === G.uid;
    const scoreVal  = lbTab === 'bal'   ? '$' + e.bal.toFixed(0)
                    : lbTab === 'pnl'   ? (e.pnl >= 0 ? '+$' : '-$') + Math.abs(e.pnl).toFixed(0)
                    : e.trust + '%';
    const scoreColor = lbTab === 'pnl'   ? (e.pnl >= 0 ? 'var(--g)' : 'var(--r)')
                     : lbTab === 'trust' ? (e.trust >= 60 ? 'var(--g)' : e.trust >= 40 ? 'var(--y)' : 'var(--r)')
                     : 'var(--t0)';
    return `<div class="lb-row" ${isMe ? 'style="background:rgba(232,25,44,.04)"' : ''}>
      <div class="lb-rank ${rankClass(i)}">${rankSymbol(i)}</div>
      <div class="lb-av ${isMe ? 'me' : ''}">${(e.name[0] || '?').toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div class="lb-name">${e.name}${isMe ? ' <span style="font-size:9px;color:var(--r);font-family:var(--mono)">(you)</span>' : ''}</div>
        <div style="font-size:10px;color:var(--t3);font-family:var(--mono);margin-top:2px">${e.rounds} rnd · ${e.trust}% trust</div>
      </div>
      <div class="lb-score" style="color:${scoreColor}">${scoreVal}</div>
    </div>`;
  }).join('');
}
