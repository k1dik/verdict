/**
 * ui.js — Global DOM sync layer.
 * Extracted from verdict-v27.
 *
 * updateAll()         — re-renders all persistent UI from current G state.
 * renderHomeRounds()  — renders last 3 rounds on home screen.
 *
 * Does NOT own business logic — reads G, writes DOM. That's it.
 */

import { G, Store }  from '../store/store.js';
import { stats }     from './game.engine.js';

const $ = id => document.getElementById(id);
const fmt  = n => n.toFixed(2);
const fmtD = n => (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);

export function updateAll() {
  const tr  = stats.trustRate();
  const tc  = stats.trustColor();
  const trS = G.rounds ? tr + '%' : '—';
  const bf  = fmt(G.bal);

  ['hm-bal','mb-bal','wd-bal','nr-bal'].forEach(id => { const e = $(id); if (e) e.textContent = bf; });
  set('pf-b',    el => el.textContent = G.bal.toFixed(2));
  set('hm-rnd',  el => el.textContent = G.rounds);
  set('hm-wins', el => el.textContent = G.wins + ' wins');
  set('hm-tr',   el => { el.textContent = trS; el.style.color = tc; });
  set('hm-trb',  el => { el.style.width = (G.rounds ? tr : 0) + '%'; el.style.background = tc; });
  set('pf-r',    el => el.textContent = G.rounds);
  set('pf-t',    el => { el.textContent = trS; el.style.color = tc; });

  const lh = G.hist[0], ch = $('hm-change');
  if (lh && ch) {
    const cls = lh.d >= 0 ? 'tag t-g' : 'tag t-r';
    const sym = lh.d >= 0 ? '▲ +$' : '▼ -$';
    ch.innerHTML = `<span class="${cls}">${sym}${Math.abs(lh.d).toFixed(2)} last round</span>`;
  }

  renderHomeRounds();
}

export function renderHomeRounds() {
  const c = $('hm-rounds');
  if (!c) return;

  if (!G.hist.length) {
    c.innerHTML = `<div style="padding:40px 20px;text-align:center">
      <div style="font-size:56px;font-weight:700;color:var(--t4);font-family:var(--mono);margin-bottom:12px">0</div>
      <div style="font-size:14px;color:var(--t2);margin-bottom:24px;line-height:1.6">No rounds yet.<br>Make your first decision.</div>
    </div>`;
    return;
  }

  const icon = t => t === 'win'
    ? '<path d="M2 7l3 3 7-6"/>'
    : '<path d="M3 3l8 8M11 3l-8 8"/>';

  c.innerHTML = G.hist.slice(0, 3).map(h => `
    <div class="round-item">
      <div class="round-icon" style="border:1px solid ${h.t==='win'?'var(--gm)':h.t==='loss'?'var(--rm)':'var(--ym)'};background:${h.t==='win'?'var(--gd)':h.t==='loss'?'var(--rd)':'var(--yd)'}">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="${h.t==='win'?'var(--g)':h.t==='loss'?'var(--r)':'var(--y)'}" stroke-width="2">${icon(h.t)}</svg>
      </div>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:700">${h.title}</div>
        <div class="lbl" style="margin-top:3px">$${h.stake.toFixed(2)} stake</div>
      </div>
      <div style="font-family:var(--mono);font-size:16px;font-weight:700;color:${h.d>=0?'var(--g)':'var(--r)'}">${h.d>=0?'+':'-'}$${Math.abs(h.d).toFixed(2)}</div>
    </div>
  `).join('');
}

// ── REACTIVE BINDINGS ───────────────────────────────────────
// Subscribe to Store changes → update only affected DOM slices.
// This replaces the "call updateAll() after every mutation" pattern.

Store.subscribe('bal', val => {
  const bf = val.toFixed(2);
  ['hm-bal','mb-bal','wd-bal','nr-bal'].forEach(id => { const e = $(id); if (e) e.textContent = bf; });
  set('pf-b', el => el.textContent = parseFloat(val).toFixed(2));
});

Store.subscribe('global', val => {
  const txt = val.toLocaleString();
  ['hm-global','st-gl','sp-global'].forEach(id => { const e = $(id); if (e) e.textContent = txt; });
});

Store.subscribe('rounds', val => {
  set('hm-rnd', el => el.textContent = val);
  set('pf-r',   el => el.textContent = val);
});

Store.subscribe('wins', val => {
  set('hm-wins', el => el.textContent = val + ' wins');
});

Store.subscribe('name', val => {
  ['hm-name','pf-name'].forEach(id => { const e = $(id); if (e) e.textContent = val; });
  ['pf-av','rs-yav'].forEach(id => { const e = $(id); if (e) e.textContent = (val[0] || 'P').toUpperCase(); });
  set('st-name', el => el.textContent = val);
});

function set(id, fn) { const el = $(id); if (el) fn(el); }
