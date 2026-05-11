/**
 * main.js — Entry point.
 *
 * 1. Imports all modules
 * 2. Boots the app
 * 3. Exposes everything on window.* for backward-compat
 *    (HTML still uses onclick="goS(...)", onclick="depPickAmt(...)" etc.)
 *
 * When all HTML is converted to React components, this file
 * shrinks to just imports + boot — no more window.* needed.
 */

import { supabase, signUp, signIn, saveBalance, getCurrentUser } from './supabase.js';
import { Store, G }                           from './store/store.js';
import { resolveRound, stats }                from './modules/game.engine.js';
import { MM, renderOppRep, renderRealPlayerRep } from './modules/matchmaking.js';
import { updateAll, renderHomeRounds }        from './modules/ui.js';
import { goS, switchTab, openSh, closeAll, openM, closeM, refreshM, copyRefLink } from './modules/nav.js';
import { lbUpsert, lbSetTab, renderLeaderboard } from './screens/leaderboard.js';
import {
  addFundsInternal,
  depReset, depPickAmt, depPickMethod, depGoStep1, depGoStep2,
  depClearErr, depSubmitCard, depSubmitCrypto, depSwitchMethod,
  copyCryptoAddr, fmtCard, fmtExpiry,
  openShWithdraw, wdPickMethod, wdGoStep1, wdClearErr,
  wdPickNet, wdSubmit, wdReset,
} from './modules/payments.js';
import { DEMO_START_BAL, OUTCOMES, RAKE }     from './modules/game.config.js';



// ── BOOT ────────────────────────────────────────────────────

// Unique session ID (persists across reloads)
if (!localStorage.getItem('verdict_uid')) {
  localStorage.setItem('verdict_uid', 'u_' + Math.random().toString(36).slice(2, 10));
}
G.uid = localStorage.getItem('verdict_uid');

// Fire initial state through subscribers so DOM paints correctly
;['bal','global','rounds','wins','name'].forEach(k => { G[k] = G[k]; });

// Global counter drift
setInterval(() => { if (Math.random() > 0.5) G.global += Math.floor(Math.random() * 3) + 1; }, 3200);

// Check for challenge link in URL
checkIncomingChallenge();

// Восстанавливаем сессию если уже был залогинен
getCurrentUser().then(result => {
  if (result?.user && result?.player) {
    G.userId  = result.user.id;
    G.uid     = result.user.id;
    G.name    = result.player.name || 'Player';
    G.bal     = result.player.bal  || 100;
    G.realBal = result.player.bal  || 100;  // сохраняем реальный баланс
    G.rounds  = result.player.rounds || 0;
    G.wins    = result.player.wins   || 0;
    enterApp();
  }
});


// ── DEMO GUARD ───────────────────────────────────────────────
// Восстанавливаем реальный баланс при навигации из демо
const _origSwitchTab = switchTab;
function safeSwitchTab(tab) {
  if (G.mode === 'demo') {
    G.mode = 'real';
    G.bal  = G.realBal || 0;
    G.hist = []; G.txns = []; G.pnl = 0;
    updateAll();
  }
  _origSwitchTab(tab);
}

const _origGoS = goS;
function safeGoS(id) {
  if (id === 'S-home' && G.mode === 'demo') {
    G.mode = 'real';
    G.bal  = G.realBal || 0;
    G.hist = []; G.txns = []; G.pnl = 0;
    updateAll();
  }
  _origGoS(id);
}

// ── GAME FUNCTIONS ───────────────────────────────────────────

const O   = OUTCOMES; // alias used in HTML inline handlers
const fmt  = n => n.toFixed(2);
const fmtD = n => (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);

function pickC(el, v) {
  const already = el.classList.contains('sel');
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
  if (already) {
    G.stake = null;
  } else {
    G.stake = v;
    el.classList.add('sel');
  }
}

function startRound() {
  if ((G.mode === 'real' || G.mode === 'training') && G.bal < G.stake) { openSh('SH-deposit'); return; }
  // Training режим — максимум $2
  if (G.mode === 'training' && G.stake > 2) { G.stake = 2; }
  const stakeVal = (G.stake || 0).toFixed(2);
  const dcStake = document.getElementById('dc-stake'); if (dcStake) dcStake.textContent = '$' + stakeVal;
  const wtStake = document.getElementById('wt-stake'); if (wtStake) wtStake.textContent = stakeVal;
  goS('S-wait');
  MM.start(G.stake);
  // Показываем кнопку отмены только в real режиме (не в training и не в demo)
  const realNote = document.getElementById('wt-real-note');
  if (realNote) realNote.style.display = G.mode === 'real' ? 'block' : 'none';
}

function makeChoice(c) {
  _stopTimer();
  G.myC = c;
  const decArea  = document.getElementById('wt-decision-area');
  const lockArea = document.getElementById('wt-choice-made-area');
  if (decArea)  decArea.style.display  = 'none';
  if (lockArea) lockArea.style.display = 'block';
  const wc = document.getElementById('wt-choice2');
  wc.textContent = c.toUpperCase();
  wc.style.color = c === 'trust' ? 'var(--g)' : 'var(--r)';
  // startDots handled inside MM

  MM.resolveWithChoice(c, (theirChoice, opponent, isReal) => {
    G.theirC     = theirChoice;
    G.lastOpp    = opponent;
    G.lastOppReal = isReal;
    isReal ? MM.renderRealPlayerRep(opponent) : MM.renderOppRep(opponent);

    // Use engine to resolve and update state
    const result = resolveRound(G.myC, G.theirC, G.stake);
    _renderResultScreen(result.outcome, result.myDelta, result.theirDelta, result.rakeAmt);
    goS('S-result');
    updateAll();
    lbUpsert();
    // Сохраняем баланс в Supabase после каждого раунда
    // Сохраняем только в real и training режимах — не в demo
    if (G.userId && G.mode !== 'demo') saveBalance(G.userId, G.bal, G.rounds, G.wins, G.pnl, G.name).catch(e => console.error('save error:', e));
  });
}

function _renderResultScreen(o, md, td, rakeAmt) {
  // Перенесено в ResultScreen.jsx
  // Insight sheet всё ещё обновляем через старый DOM
  const shIns = document.getElementById('sh-ins');
  if (shIns) shIns.textContent = o.ins;
}

function playAgain() { MM.cleanup(); G.myC = null; G.theirC = null; _stopTimer(); goS('S-new'); }

// ── TIMER ────────────────────────────────────────────────────
let _timerInterval = null;

function _stopTimer() {
  clearInterval(_timerInterval);
  _timerInterval = null;
}

function startDecisionTimer() {
  _stopTimer();
  let secs = 20;
  const el = document.getElementById('wt-timer');
  if (!el) return;
  el.textContent = secs + 's';
  el.style.color = 'var(--y)';
  el.style.background = 'var(--yd)';
  el.style.borderColor = 'var(--ym)';

  _timerInterval = setInterval(() => {
    secs--;
    if (!el) { _stopTimer(); return; }
    el.textContent = secs + 's';

    if (secs <= 5) {
      el.style.color = 'var(--r)';
      el.style.background = 'var(--rd)';
      el.style.borderColor = 'var(--rm)';
    } else if (secs <= 10) {
      el.style.color = 'var(--r2)';
    }

    if (secs <= 0) {
      _stopTimer();
      // Auto-pick randomly if no choice made
      if (!G.myC) makeChoice(Math.random() > 0.5 ? 'trust' : 'take');
    }
  }, 1000);
}

// ── MODE ─────────────────────────────────────────────────────

function applyMode() {
  const isReal     = G.mode === 'real';
  const isTraining = G.mode === 'training';
  const isDemo     = G.mode === 'demo';

  document.querySelectorAll('[data-mode-demo]').forEach(el => el.style.display = isReal || isTraining ? 'none' : '');
  document.querySelectorAll('[data-mode-real]').forEach(el => el.style.display = isReal ? '' : 'none');
  document.querySelectorAll('[data-mode-training]').forEach(el => el.style.display = isTraining ? '' : 'none');

  const dot = document.getElementById('hm-mode-dot'), lbl = document.getElementById('hm-mode-lbl');
  if (dot) dot.style.background = isReal ? 'var(--g)' : isTraining ? 'var(--r)' : 'var(--y)';
  if (lbl) {
    lbl.textContent = isReal ? 'Live' : isTraining ? 'Training' : 'Demo';
    lbl.style.color = isReal ? 'var(--g)' : isTraining ? 'var(--r)' : 'var(--y)';
  }

  const addBtn = document.getElementById('hm-add-btn'), outBtn = document.getElementById('hm-out-btn');
  if (addBtn) { addBtn.style.opacity = isReal ? '1' : '.35'; addBtn.style.pointerEvents = isReal ? 'auto' : 'none'; }
  if (outBtn) { outBtn.style.opacity = isReal ? '1' : '.35'; outBtn.style.pointerEvents = isReal ? 'auto' : 'none'; }

  const pfBadge = document.getElementById('pf-mode-badge');
  if (pfBadge) pfBadge.textContent = isReal ? 'Real Money Player' : isTraining ? 'Training Player' : 'Demo Player';

  const pfFooter = document.getElementById('pf-footer');
  if (pfFooter) pfFooter.innerHTML = isReal
    ? 'Real money mode · <span style="color:var(--r);cursor:pointer" onclick="goS(\'S-mode\')">Switch mode →</span>'
    : isTraining
    ? 'Training mode · Real money vs AI · <span style="color:var(--r);cursor:pointer" onclick="goS(\'S-mode\')">Switch mode →</span>'
    : 'Demo mode · <span style="color:var(--r);cursor:pointer" onclick="goS(\'S-mode\')">Switch to real money →</span>';

  // Показываем нужные чипы ставок в зависимости от режима
  const trainingChips = ['chip-1', 'chip-2'];
  const realChips     = ['chip-5', 'chip-10', 'chip-25', 'chip-50', 'chip-100'];
  trainingChips.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isTraining ? '' : 'none';
  });
  realChips.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isTraining ? 'none' : '';
  });

  // Сбрасываем выбранную ставку при смене режима
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('sel'));
  G.stake = isTraining ? 1 : 25;
}

function startDemo() {
  // Сохраняем текущий реальный баланс перед входом в демо
  if (G.mode !== 'demo') G.realBal = G.bal;
  G.mode = 'demo';
  G.bal = DEMO_START_BAL;
  G.pnl = 0; G.rounds = 0; G.wins = 0; G.trusts = 0; G.hist = []; G.txns = [];
  applyMode(); updateAll(); goS('S-new');
}
function startReal() {
  // Восстанавливаем реальный баланс из realBal (не из Supabase чтобы не ждать)
  G.bal    = G.realBal || 0;
  G.mode   = 'real';
  G.hist   = []; G.txns = []; G.pnl = 0;
  updateAll();
  if (G.bal <= 0) { openSh('SH-deposit'); return; }
  applyMode(); goS('S-new');
}
function startTraining() {
  if (G.bal <= 0) { openSh('SH-deposit'); return; }
  G.mode = 'training';
  // Training режим — только $1 или $2
  if (!G.stake || G.stake > 2) G.stake = 1;
  applyMode();
  goS('S-new');
}
function resetDemo()     { Store.reset({ bal: DEMO_START_BAL, uid: G.uid, name: G.name, mode: 'demo' }); closeAll(); updateAll(); goS('S-home'); }

// ── AUTH ─────────────────────────────────────────────────────

let authMode = 'reg', regCurrentStep = 1;

function authToggle() {
  authMode = authMode === 'reg' ? 'login' : 'reg';
  const isL = authMode === 'login';
  document.getElementById('auth-reg').style.display   = isL ? 'none' : 'block';
  document.getElementById('auth-login').style.display = isL ? 'block' : 'none';
  document.getElementById('auth-toggle-btn').textContent = isL ? 'Register' : 'Sign In';
  document.getElementById('auth-steps-bar').style.display = isL ? 'none' : 'flex';
}

function regStep(n) {
  regCurrentStep = n;
  document.querySelectorAll('.auth-step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('reg-step-' + n); if (el) el.classList.add('active');
  for (let i = 1; i <= 3; i++) { const d = document.getElementById('sd-' + i); if (!d) continue; d.className = 'step-dot'; if (i < n) d.classList.add('done'); else if (i === n) d.classList.add('on'); }
}
function regNext1() {
  const u = document.getElementById('reg-username'), e = document.getElementById('reg-email'); let ok = true;
  if (u.value.trim().length < 3)                        { showErr('reg-username-err','Min 3 characters'); u.classList.add('err'); ok=false; } else { clearErr('reg-username-err'); u.classList.remove('err'); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.value.trim())) { showErr('reg-email-err','Invalid email'); e.classList.add('err'); ok=false; } else { clearErr('reg-email-err'); e.classList.remove('err'); }
  if (ok) regStep(2);
}
function regNext2() {
  const p = document.getElementById('reg-pwd'), p2 = document.getElementById('reg-pwd2');
  if (p.value.length < 8) { showErr('reg-pwd-err','Min 8 characters'); p.classList.add('err'); return; }
  if (p.value !== p2.value) { showErr('reg-pwd-err','Passwords do not match'); p2.classList.add('err'); return; }
  clearErr('reg-pwd-err'); p.classList.remove('err'); p2.classList.remove('err');
  const un = document.getElementById('reg-username').value.trim();
  document.getElementById('reg-preview-name').textContent  = un;
  document.getElementById('reg-preview-email').textContent = document.getElementById('reg-email').value.trim();
  document.getElementById('reg-av-preview').textContent    = (un[0] || 'P').toUpperCase();
  regStep(3);
}
function regBack() { regStep(regCurrentStep - 1); }
function toggleCheck(id) {
  const el = document.getElementById(id); const c = el.dataset.checked === 'true';
  el.dataset.checked = c ? 'false' : 'true'; el.style.background = !c ? 'var(--r)' : 'transparent'; el.style.borderColor = !c ? 'var(--r)' : 'var(--rim2)';
  el.innerHTML = !c ? '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"><path d="M2 6.5l3 3L11 3"/></svg>' : '';
}
async function regSubmit() {
  const t = document.getElementById('chk-terms').dataset.checked === 'true', a = document.getElementById('chk-age').dataset.checked === 'true';
  if (!t || !a) { document.getElementById('reg-terms-err').style.display = 'block'; return; }
  document.getElementById('reg-terms-err').style.display = 'none';
  const un = document.getElementById('reg-username').value.trim();
  const em = document.getElementById('reg-email').value.trim();
  const pw = document.getElementById('reg-pwd').value;
  const btn = document.getElementById('reg-submit-btn');
  if (btn) { btn.style.opacity = '.5'; btn.textContent = 'Creating account...'; btn.style.pointerEvents = 'none'; }
  const { user, error } = await signUp(em, pw, un);
  if (error) {
    if (btn) { btn.style.opacity = '1'; btn.textContent = 'Create Account'; btn.style.pointerEvents = 'auto'; }
    showErr('reg-terms-err', error.message || 'Registration failed'); return;
  }
  G.name = un; G.uid = user.id; G.userId = user.id;
  enterApp();
}
async function doLogin() {
  const e = document.getElementById('login-email').value.trim(), p = document.getElementById('login-pwd').value;
  if (!e || !p) { showErr('login-err','Fill in all fields'); return; }
  clearErr('login-err');
  const btn = document.getElementById('login-btn');
  if (btn) { btn.style.opacity = '.5'; btn.textContent = 'Signing in...'; btn.style.pointerEvents = 'none'; }
  const { user, player, error } = await signIn(e, p);
  if (error) {
    if (btn) { btn.style.opacity = '1'; btn.textContent = 'Sign In'; btn.style.pointerEvents = 'auto'; }
    showErr('login-err', error.message || 'Login failed'); return;
  }
  G.name    = player?.name   || 'Player';
  G.bal     = player?.bal    || 100;
  G.realBal = player?.bal    || 100;  // сохраняем реальный баланс отдельно
  G.rounds  = player?.rounds || 0;
  G.wins    = player?.wins   || 0;
  G.uid     = user.id;
  G.userId  = user.id;
  enterApp();
}
function enterApp() {
  const s = document.getElementById('S-auth');
  s.style.transition = 'opacity .35s ease,transform .35s var(--ease)'; s.style.opacity = '0'; s.style.transform = 'scale(.96)';
  setTimeout(() => { s.style.display = 'none'; s.style.zIndex = '-1'; closeAll(); switchTab('home'); setTimeout(showChallengerBanner, 800); }, 350);
}
function togglePwd(id, btn) { const inp = document.getElementById(id); const h = inp.type === 'password'; inp.type = h ? 'text' : 'password'; btn.style.color = h ? 'var(--r)' : 'var(--t3)'; }
// ── NICKNAME GENERATOR ──────────────────────────────────────
const _adj = ['silent','shadow','neon','iron','frost','void','steel','dark','swift','wild','cold','sharp','bold','sly','grim','lone','calm','rogue','blaze','zero'];
const _noun = ['player','wolf','fox','hawk','ghost','blade','storm','cipher','dealer','judge','pawn','king','ace','raven','viper','monk','glitch','oracle','phantom','comet'];

function genNick() {
  const adj  = _adj[Math.floor(Math.random() * _adj.length)];
  const noun = _noun[Math.floor(Math.random() * _noun.length)];
  const num  = Math.floor(Math.random() * 900) + 100;
  return `${adj}_${noun}${num}`;
}

export function rerollNick() {
  const input = document.getElementById('reg-username');
  if (!input) return;
  const nick = genNick();
  input.value = nick;
  input.classList.remove('err');
  clearErr('reg-username-err');
  // animate
  input.style.opacity = '0.4';
  setTimeout(() => { input.style.transition = 'opacity .15s'; input.style.opacity = '1'; }, 50);
}

function splashGoAuth(mode) {
  const sp = document.getElementById('S-splash'), auth = document.getElementById('S-auth');
  sp.classList.add('out');
  setTimeout(() => {
    sp.style.display = 'none'; if (mode === 'login' && authMode !== 'login') authToggle();
    auth.style.opacity = '0'; auth.style.transform = 'translateY(18px)'; auth.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => { auth.style.transition = 'opacity .38s var(--ease),transform .38s var(--ease)'; auth.style.opacity = '1'; auth.style.transform = 'none'; }));
    if (mode !== 'login') rerollNick();
  }, 500);
}
function showErr(id, msg) { const e = document.getElementById(id); if (e) { e.textContent = msg; e.style.display = 'block'; } }
function clearErr(id) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }

// ── CHALLENGE ─────────────────────────────────────────────────

function checkIncomingChallenge() {
  const p = new URLSearchParams(window.location.search), ch = p.get('challenger');
  if (!ch) return;
  G._challenger = { name: ch, tr: p.get('tr'), rounds: p.get('rounds'), bal: p.get('bal') };
}
function showChallengerBanner() {
  if (!G._challenger) return;
  const c = G._challenger, banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:calc(60px + var(--safe-top));left:0;right:0;max-width:430px;margin:0 auto;z-index:400;padding:0 16px;animation:scrIn .3s var(--ease) both';
  banner.innerHTML = `<div style="background:var(--rd);border:1.5px solid var(--rm);border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px"><div style="font-size:20px">⚔️</div><div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--r);margin-bottom:2px">${c.name} challenges you!</div><div style="font-size:11px;color:var(--t2);font-family:var(--mono)">Their score: ${c.tr}% trust · ${c.rounds} rounds · $${c.bal}</div></div><button onclick="this.closest('div').parentElement.parentElement.remove()" style="width:28px;height:28px;border-radius:50%;background:var(--l3);border:none;color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button></div>`;
  document.querySelector('.app').appendChild(banner);
  setTimeout(() => { try { banner.remove(); } catch (e) {} }, 7000);
}
function openChallengeSheet() {
  closeAll();
  const tr = G.rounds ? Math.round((G.trusts / G.rounds) * 100) : 0;
  const preview = document.getElementById('ch-preview');
  if (preview) preview.innerHTML = `<span style="color:var(--r)">${G.name}</span> challenges you to Verdict<br>Their stats: <span style="color:var(--g)">${tr}%</span> trust · <span style="color:var(--t1)">${G.rounds}</span> rounds · <span style="color:var(--y)">$${G.bal.toFixed(0)}</span> balance<br><span style="color:var(--t3)">Can you do better?</span>`;
  const params = new URLSearchParams({ challenger: G.name, tr, rounds: G.rounds, bal: Math.round(G.bal) });
  const url = window.location.href.split('?')[0] + '?' + params.toString();
  const linkEl = document.getElementById('ch-link'); if (linkEl) linkEl.textContent = url;
  document.getElementById('BDR').classList.add('open');
  requestAnimationFrame(() => document.getElementById('SH-challenge').classList.add('open'));
}
function copyChallenge() {
  const linkEl = document.getElementById('ch-link'); if (!linkEl) return;
  navigator.clipboard.writeText(linkEl.textContent).then(() => {
    const copied = document.getElementById('ch-copied');
    if (copied) { copied.style.display = 'block'; setTimeout(() => copied.style.display = 'none', 2000); }
  }).catch(() => {});
}
function shareResult() {
  const text = `I just played Verdict — ${G.rounds} rounds, ${G.rounds?Math.round((G.trusts/G.rounds)*100):0}% Trust Rate. verdict.game`;
  if (navigator.share) navigator.share({ title: 'Verdict', text }).catch(() => {});
  else navigator.clipboard.writeText(text).then(() => alert('Copied!')).catch(() => {});
}
function openShareOverlay() {
  const ov = document.getElementById('share-overlay'); if (!ov) return;
  const tr = G.rounds ? Math.round((G.trusts / G.rounds) * 100) : 0;
  const lastH = G.hist[0];
  if (lastH) {
    const sc = id => document.getElementById(id);
    sc('sc-outcome').textContent = lastH.title; sc('sc-outcome').style.color = lastH.t==='win'?'var(--g)':lastH.t==='loss'?'var(--r)':'var(--y)';
    sc('sc-sub').textContent = lastH.sub;
    sc('sc-my-choice').textContent = lastH.my.toUpperCase(); sc('sc-my-choice').style.color = lastH.my==='trust'?'var(--g)':'var(--r)';
    sc('sc-my-delta').textContent = (lastH.d>=0?'+$':'-$')+Math.abs(lastH.d).toFixed(2); sc('sc-my-delta').style.color = lastH.d>=0?'var(--g)':'var(--r)';
    sc('sc-their-choice').textContent = lastH.them.toUpperCase(); sc('sc-their-choice').style.color = lastH.them==='trust'?'var(--g)':'var(--r)';
  }
  document.getElementById('sc-trust-rate').textContent = G.rounds ? tr + '%' : '—';
  document.getElementById('sc-rounds').textContent = G.rounds;
  ov.style.display = 'flex';
}
function closeShareOverlay() { document.getElementById('share-overlay').style.display = 'none'; }
function addFunds(n) { addFundsInternal(n); closeAll(); }
function doWithdraw() { openSh('SH-withdraw'); }
function joinWaitlist() { alert('You\'re on the waitlist!'); }

// ── EXPOSE TO window.* ───────────────────────────────────────
// Required while HTML still uses onclick="fnName(...)"
// Once HTML is converted to React, delete this entire block.

Object.assign(window, {
  G, Store, MM,
  // nav
  goS: safeGoS, openSh, closeAll, openM, closeM, refreshM, copyRefLink,
  switchTab: safeSwitchTab,
  // game
  pickC, startRound, makeChoice, playAgain,
  // mode
  applyMode, startDemo, startReal, startTraining, resetDemo,
  // auth
  authToggle, regStep, regNext1, regNext2, regBack,
  toggleCheck, regSubmit, doLogin, enterApp, togglePwd,
  splashGoAuth, showErr, clearErr, rerollNick,
  // leaderboard
  lbSetTab, renderLeaderboard, lbUpsert,
  // payments
  depReset, depPickAmt, depPickMethod, depGoStep1, depGoStep2,
  depClearErr, depSubmitCard, depSubmitCrypto, depSwitchMethod,
  copyCryptoAddr, fmtCard, fmtExpiry,
  wdPickMethod, wdGoStep1, wdClearErr, wdPickNet, wdSubmit, wdReset,
  addFunds, doWithdraw,
  // challenge / share
  openChallengeSheet, copyChallenge, shareResult,
  openShareOverlay, closeShareOverlay,
  joinWaitlist,
  // ui
  updateAll,
  // timer
  startDecisionTimer,
});
