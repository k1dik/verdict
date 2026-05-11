/**
 * nav.js — Screen navigation, sheets, modals.
 * Owns: goS, switchTab, openSh, closeAll, openM, closeM, refreshM
 */

import { G }              from '../store/store.js';
import { stats }          from './game.engine.js';
import { MM }             from './matchmaking.js';
import { openShWithdraw, depReset } from './payments.js';

const $ = id => document.getElementById(id);
const fmt  = n => n.toFixed(2);
const fmtD = n => (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);

// ── SCREENS ─────────────────────────────────────────────────

export function goS(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  // Скрываем splash и auth если переходим на другой экран
  const splash = $('S-splash'), auth = $('S-auth');
  if (splash && id !== 'S-splash') splash.style.display = 'none';
  if (auth   && id !== 'S-auth')   { auth.style.display = 'none'; auth.style.zIndex = '-1'; }
  const s = $(id);
  if (s) { s.classList.add('active'); s.scrollTop = 0; }
  if (id === 'S-new') { try { MM.previewOpponent(); } catch (e) {} }

  // Скрываем нижнее меню во время игры
  const hideNav = ['S-wait', 'S-decision', 'S-result', 'S-new', 'S-mode', 'S-splash', 'S-auth', 'S-waitlist'];
  const nav = $('TABNAV');
  if (nav) nav.style.display = hideNav.includes(id) ? 'none' : 'grid';

  // Убираем активный класс с кнопок при переходе на игровые экраны
  if (hideNav.includes(id)) {
    document.querySelectorAll('.bni').forEach(n => n.classList.remove('on'));
  }

  // При возврате на home — подсвечиваем Home
  if (id === 'S-home') {
    document.querySelectorAll('.bni').forEach(n => n.classList.remove('on'));
    const homeBtn = $('bn-home');
    if (homeBtn) homeBtn.classList.add('on');
  }
}

export function switchTab(t) {
  document.querySelectorAll('.bni').forEach(n => n.classList.remove('on'));
  if (t === 'home')        { $('bn-home').classList.add('on');     goS('S-home'); }
  if (t === 'profile')     { $('bn-profile').classList.add('on');  goS('S-profile'); }
  if (t === 'leaderboard') { $('bn-lb').classList.add('on');       goS('S-leaderboard'); renderLeaderboard(); }
  if (t === 'referral')    { $('bn-referral').classList.add('on'); goS('S-referral'); _refreshReferral(); }
}

// ── SHEETS ──────────────────────────────────────────────────

export function openSh(id) {
  closeAll(false);
  $('BDR').classList.add('open');
  if (id === 'SH-withdraw') openShWithdraw();
  if (id === 'SH-deposit')  depReset();
  const s = $(id);
  if (s) requestAnimationFrame(() => s.classList.add('open'));
}

export function closeAll() {
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'));
  $('BDR').classList.remove('open');
}

// ── MODALS ──────────────────────────────────────────────────

export function openM(id) { closeAll(); refreshM(id); const m = $(id); if (m) requestAnimationFrame(() => m.classList.add('open')); }
export function closeM(id) { $(id).classList.remove('open'); }

export function refreshM(id) {
  if (id === 'M-balance') _refreshBalance();
  if (id === 'M-history') _refreshHistory();
  if (id === 'M-stats')   _refreshStats();
  if (id === 'M-today')   _refreshToday();
}

function _refreshBalance() {
  set('mb-bal', el => el.textContent = fmt(G.bal));
  const pe = $('mb-pnl');
  if (pe) { pe.textContent = fmtD(G.pnl) + ' P&L'; pe.className = 'tag ' + (G.pnl >= 0 ? 't-g' : 't-r'); }
  const h = $('mb-hist');
  if (!h) return;
  if (!G.txns.length) { h.innerHTML = '<div style="padding:24px;font-size:13px;color:var(--t3);text-align:center;font-family:var(--mono)">No transactions yet</div>'; return; }
  h.innerHTML = G.txns.slice(0, 10).map(t =>
    `<div style="display:flex;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--rim);font-size:14px">
       <span style="color:var(--t2)">${t.lbl}</span>
       <span style="font-family:var(--mono);font-weight:700;color:${t.d>=0?'var(--g)':'var(--r)'}">${t.d>=0?'+':'-'}$${Math.abs(t.d).toFixed(2)}</span>
     </div>`
  ).join('');
}

function _refreshHistory() {
  const h = $('mh-list'); if (!h) return;
  if (!G.hist.length) {
    h.innerHTML = `<div style="padding:32px;text-align:center;font-size:14px;color:var(--t3);line-height:1.7;font-family:var(--mono)">No rounds.<br><span onclick="closeM('M-history');goS('S-new')" style="color:var(--r);cursor:pointer">Play now →</span></div>`;
    return;
  }
  h.innerHTML = G.hist.map(h =>
    `<div class="round-item">
       <div class="round-icon" style="border:1px solid ${h.t==='win'?'var(--gm)':h.t==='loss'?'var(--rm)':'var(--ym)'};background:${h.t==='win'?'var(--gd)':h.t==='loss'?'var(--rd)':'var(--yd)'}">
         <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="${h.t==='win'?'var(--g)':h.t==='loss'?'var(--r)':'var(--y)'}" stroke-width="2">${h.t==='win'?'<path d="M2 7l3 3 7-6"/>':'<path d="M3 3l8 8M11 3l-8 8"/>'}</svg>
       </div>
       <div style="flex:1">
         <div style="font-size:15px;font-weight:700">${h.title}</div>
         <div class="lbl" style="margin-top:3px">$${h.stake.toFixed(2)} · You ${h.my} / Them ${h.them}</div>
       </div>
       <div style="font-family:var(--mono);font-size:15px;font-weight:700;color:${h.d>=0?'var(--g)':'var(--r)'}">${h.d>=0?'+':'-'}$${Math.abs(h.d).toFixed(2)}</div>
     </div>`
  ).join('');
}

function _refreshStats() {
  const tr = stats.trustRate(), wr = stats.winRate(), tc = stats.trustColor();
  set('st-tr',   el => { el.textContent = G.rounds ? tr + '%' : '—'; el.style.color = tc; });
  set('st-trb',  el => { el.style.width = (G.rounds ? tr : 0) + '%'; el.style.background = tc; });
  set('st-wr',   el => el.textContent = G.rounds ? wr + '%' : '—');
  set('st-wrb',  el => el.style.width = (G.rounds ? wr : 0) + '%');
  set('st-tot',  el => el.textContent = G.rounds);
  set('st-wn',   el => el.textContent = G.wins);
  set('st-bal',  el => el.textContent = fmt(G.bal));
  set('st-wag',  el => el.textContent = fmt(G.waged));
  set('st-rake', el => el.textContent = fmt(G.rake || 0));
  const pe = $('st-pnl'); if (pe) { pe.textContent = fmtD(G.pnl); pe.style.color = G.pnl >= 0 ? 'var(--g)' : 'var(--r)'; }
  set('st-gl',   el => el.textContent = G.global.toLocaleString());
}

function _refreshToday() {
  // Данные из G.global (реальные) + симулированные дневные метрики
  const rounds  = G.global ?? 12483;
  const volume  = (rounds * 11.87).toFixed(0); // ~средний стейк $11.87
  const volFmt  = volume > 999 ? '$' + Math.round(volume/1000) + 'k' : '$' + volume;
  const trust   = G.globalTrust ?? 68;
  const take    = 100 - trust;
  const players = Math.round(rounds * 0.096); // ~9.6% уникальных игроков от раундов

  set('td-rounds',    el => el.textContent = rounds.toLocaleString());
  set('td-volume',    el => el.textContent = volFmt);
  set('td-trust',     el => { el.textContent = trust + '%'; });
  set('td-players',   el => el.textContent = players.toLocaleString());
  set('td-trust-pct', el => el.textContent = trust + '%');
  set('td-take-pct',  el => el.textContent = take + '%');
  set('td-trust-bar', el => el.style.width = trust + '%');
}

// circular dep shim — leaderboard imported lazily
function renderLeaderboard() { window.renderLeaderboard?.(); }

// ── REFERRAL ────────────────────────────────────────────────

function _refreshReferral() {
  const user = G.user;
  const code = user?.id?.slice(0, 8) ?? 'guest';
  const link = `verdict.game?ref=${code}`;
  set('ref-link-text', el => el.textContent = link);
  set('ref-count',     el => el.textContent = G.refCount  ?? 0);
  set('ref-earned',    el => el.textContent = '$' + (G.refEarned ?? 0).toFixed(2));
}

export function copyRefLink() {
  const user = G.user;
  const code = user?.id?.slice(0, 8) ?? 'guest';
  const link = `https://verdict.game?ref=${code}`;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.querySelector('#S-referral button');
    if (!btn) return;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy link', 2000);
  });
}
function set(id, fn) { const el = $(id); if (el) fn(el); }
