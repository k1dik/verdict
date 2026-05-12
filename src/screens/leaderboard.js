/**
 * leaderboard.js — Global leaderboard from Supabase.
 */

import { G }        from '../store/store.js';
import { supabase } from '../supabase.js';

let lbTab  = 'bal';
let lbData = []; // кэш данных

// ── UPSERT ──────────────────────────────────────────────────
// Вызывается после каждого раунда — но saveBalance уже пишет в Supabase
// Здесь просто обновляем локальный кэш
export function lbUpsert() {
  if (!G.rounds || G.mode === 'demo') return;
  const tr = G.rounds ? Math.round((G.trusts / G.rounds) * 100) : 0;
  const existing = lbData.findIndex(e => e.player_id === G.userId);
  const record = {
    player_id: G.userId,
    name: G.name,
    bal: G.bal,
    rounds: G.rounds,
    wins: G.wins,
    trust_rate: tr,
  };
  if (existing >= 0) lbData[existing] = record;
  else lbData.push(record);
}

// ── TAB ─────────────────────────────────────────────────────
export function lbSetTab(t) {
  lbTab = t;
  ['bal', 'pnl', 'trust'].forEach(k => {
    const el = document.getElementById('lb-tab-' + k);
    if (!el) return;
    el.style.color             = k === t ? 'var(--r)' : 'var(--t3)';
    el.style.borderBottomColor = k === t ? 'var(--r)' : 'transparent';
  });
  renderLeaderboard();
}

// ── RENDER ───────────────────────────────────────────────────
export async function renderLeaderboard() {
  const list = document.getElementById('lb-list');
  if (!list) return;

  // Показываем лоадер
  list.innerHTML = '<div style="padding:40px 20px;text-align:center;font-size:13px;color:var(--t3);font-family:var(--mono)">Loading...</div>';

  // Загружаем из Supabase
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order(lbTab === 'trust' ? 'trust_rate' : 'bal', { ascending: false })
    .limit(50);

  if (error || !data) {
    list.innerHTML = '<div style="padding:40px 20px;text-align:center;font-size:13px;color:var(--t3);font-family:var(--mono)">Could not load leaderboard.</div>';
    return;
  }

  lbData = data;

  // Сортировка
  const sorted = [...data].sort((a, b) => {
    if (lbTab === 'bal')   return b.bal        - a.bal;
    if (lbTab === 'trust') return b.trust_rate - a.trust_rate;
    return b.bal - a.bal;
  });

  // Мой ранк
  const myIdx  = sorted.findIndex(e => e.player_id === G.userId);
  const rankEl = document.getElementById('lb-my-rank-num');
  if (rankEl) rankEl.textContent = myIdx >= 0 ? '#' + (myIdx + 1) : '#—';

  if (!sorted.length) {
    list.innerHTML = '<div style="padding:40px 20px;text-align:center;font-size:14px;color:var(--t3);font-family:var(--mono)">No players yet. Play a round to appear here.</div>';
    return;
  }

  const rankClass  = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
  const rankSymbol = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);

  list.innerHTML = sorted.slice(0, 20).map((e, i) => {
    const isMe       = e.player_id === G.userId;
    const trust      = e.trust_rate ?? 0;
    const scoreVal   = lbTab === 'trust'
      ? trust + '%'
      : '$' + (e.bal || 0).toFixed(2);
    const scoreColor = lbTab === 'trust'
      ? (trust >= 60 ? 'var(--g)' : trust >= 40 ? 'var(--y)' : 'var(--r)')
      : 'var(--t0)';

    return `<div class="lb-row" ${isMe ? 'style="background:rgba(232,25,44,.04)"' : ''}>
      <div class="lb-rank ${rankClass(i)}">${rankSymbol(i)}</div>
      <div class="lb-av ${isMe ? 'me' : ''}">${(e.name?.[0] || '?').toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div class="lb-name">${e.name}${isMe ? ' <span style="font-size:9px;color:var(--r);font-family:var(--mono)">(you)</span>' : ''}</div>
        <div style="font-size:10px;color:var(--t3);font-family:var(--mono);margin-top:2px">${e.rounds} rnd · ${trust}% trust</div>
      </div>
      <div class="lb-score" style="color:${scoreColor}">${scoreVal}</div>
    </div>`;
  }).join('');
}
