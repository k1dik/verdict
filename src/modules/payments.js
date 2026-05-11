/**
 * payments.js — Deposit & withdraw flows.
 * Extracted verbatim from verdict-v27.
 *
 * Owns: depReset, depPickAmt, depPickMethod, depGoStep2,
 *       depSubmitCard, depSubmitCrypto, depSwitchMethod,
 *       openSh_withdraw, wdPickMethod, wdSubmit, wdReset
 *
 * Does NOT know about: game rounds, matchmaking, auth.
 */

import { G }       from '../store/store.js';
import { updateAll } from './ui.js';

const $ = id => document.getElementById(id);
const fmt = n => n.toFixed(2);

// ── INTERNAL HELPERS ────────────────────────────────────────

export function addFundsInternal(n, lbl) {
  G.bal  = parseFloat((G.bal + n).toFixed(2));
  G.txns = [{ lbl: lbl || 'Deposit', d: n }, ...G.txns].slice(0, 20);
  updateAll();
}

// ── DEPOSIT ─────────────────────────────────────────────────

let depAmt    = 0;
let depMethod = null;

const DEP_STEPS = ['dep-step-1','dep-step-2-card','dep-step-2-crypto','dep-step-processing','dep-step-success','dep-step-error'];

function depShowOnly(id) {
  DEP_STEPS.forEach(s => { const el = $(s); if (el) el.style.display = s === id ? 'block' : 'none'; });
}

function depUpdateBtn() {
  const btn = $('dep-continue-btn');
  if (!btn) return;
  const ready = depAmt > 0 && depMethod;
  btn.style.opacity      = ready ? '1' : '.4';
  btn.style.pointerEvents = ready ? 'auto' : 'none';
  btn.className          = ready ? 'btn btn-p' : 'btn btn-g';
  if (ready) btn.textContent = `Pay $${depAmt} with ${depMethod === 'card' ? 'Card' : 'Crypto'} →`;
}

export function depReset() {
  depAmt = 0; depMethod = null;
  depShowOnly('dep-step-1');
  document.querySelectorAll('.dep-amt-row').forEach(r => { r.style.borderColor = 'var(--rim2)'; r.style.background = 'var(--l1)'; });
  document.querySelectorAll('.dep-method-row').forEach(r => { r.style.borderColor = 'var(--rim2)'; r.style.background = 'var(--l1)'; });
  const btn = $('dep-continue-btn');
  if (btn) { btn.style.opacity = '.4'; btn.style.pointerEvents = 'none'; btn.className = 'btn btn-g'; btn.textContent = 'Select amount & method →'; }
  ['dep-card-num','dep-card-exp','dep-card-cvv','dep-card-name'].forEach(id => { const e = $(id); if (e) e.value = ''; });
  const err = $('dep-card-err'); if (err) err.style.display = 'none';
}

export function depPickAmt(el, amt) {
  depAmt = amt;
  document.querySelectorAll('.dep-amt-row').forEach(r => { r.style.borderColor = 'var(--rim2)'; r.style.background = 'var(--l1)'; });
  el.style.borderColor = 'var(--rm)';
  el.style.background  = 'var(--rd)';
  depUpdateBtn();
}

export function depPickMethod(el, method) {
  depMethod = method;
  document.querySelectorAll('.dep-method-row').forEach(r => { r.style.borderColor = 'var(--rim2)'; r.style.background = 'var(--l1)'; });
  el.style.borderColor = 'var(--rm)';
  el.style.background  = 'rgba(232,25,44,.06)';
  depUpdateBtn();
}

export function depGoStep1() { depShowOnly('dep-step-1'); }

export function depGoStep2() {
  if (!depAmt || !depMethod) return;
  const amtStr = '$' + depAmt;
  if (depMethod === 'card') {
    const d = $('dep-amt-display'); if (d) d.textContent = amtStr;
    const p = $('dep-pay-amt');    if (p) p.textContent = amtStr;
    depShowOnly('dep-step-2-card');
  } else {
    const d = $('dep-crypto-amt-display'); if (d) d.textContent = amtStr;
    depShowOnly('dep-step-2-crypto');
  }
}

export function depClearErr() { const e = $('dep-card-err'); if (e) e.style.display = 'none'; }

export function fmtCard(inp) {
  let v = inp.value.replace(/\D/g, '').slice(0, 16);
  inp.value = v.match(/.{1,4}/g)?.join(' ') || v;
}

export function fmtExpiry(inp) {
  let v = inp.value.replace(/\D/g, '');
  if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2, 4);
  inp.value = v;
}

function depValidateCard() {
  const num  = ($('dep-card-num')?.value  || '').replace(/\s/g, '');
  const exp  =  $('dep-card-exp')?.value  || '';
  const cvv  =  $('dep-card-cvv')?.value  || '';
  const name = ($('dep-card-name')?.value || '').trim();
  const err  = $('dep-card-err');
  const showE = msg => { if (err) { err.textContent = msg; err.style.display = 'block'; } return false; };
  if (num.length < 13)                        return showE('Card number must be 13–16 digits.');
  if (!/^\d{2}\/\d{2}$/.test(exp))           return showE('Enter expiry as MM/YY.');
  const [mm, yy] = exp.split('/').map(Number);
  if (mm < 1 || mm > 12)                     return showE('Invalid expiry month.');
  if (new Date(2000 + yy, mm - 1, 1) < new Date()) return showE('This card has expired.');
  if (cvv.length < 3)                         return showE('CVV must be 3–4 digits.');
  if (name.length < 2)                        return showE('Enter the name on your card.');
  return true;
}

const DEP_ERR_SCENARIOS = [
  { msg: 'Your card was declined. This can happen due to insufficient funds or bank restrictions.', tips: '· Check your available balance\n· Contact your bank\n· Try a different card' },
  { msg: 'Your bank blocked this transaction. Some banks restrict online gaming payments.',         tips: '· Call your bank to authorise\n· Try a different payment method\n· Use crypto instead' },
  { msg: 'Payment gateway timeout. The network is busy right now.',                                tips: '· Wait a minute and try again\n· Check your internet connection\n· Try crypto for instant processing' },
];

function depSimulateProcessing(onSuccess, onError) {
  depShowOnly('dep-step-processing');
  const steps = ['Contacting payment provider…','Verifying card details…','Authorising transaction…','Finalising…'];
  let i = 0;
  const sub = $('dep-proc-sub');
  const interval = setInterval(() => { if (sub && i < steps.length) sub.textContent = steps[i++]; }, 600);
  const willDecline = Math.random() < 0.1;
  setTimeout(() => { clearInterval(interval); willDecline ? onError() : onSuccess(); }, 2800);
}

export function depSubmitCard() {
  if (!depValidateCard()) return;
  depSimulateProcessing(
    () => {
      addFundsInternal(depAmt, 'Card Deposit');
      const sa = $('dep-success-amt'); if (sa) sa.textContent = '+$' + depAmt;
      const sb = $('dep-success-bal'); if (sb) sb.textContent = 'New balance: $' + fmt(G.bal);
      depShowOnly('dep-step-success');
    },
    () => {
      const s  = DEP_ERR_SCENARIOS[Math.floor(Math.random() * DEP_ERR_SCENARIOS.length)];
      const em = $('dep-err-msg');  if (em) em.textContent = s.msg;
      const et = $('dep-err-tips'); if (et) et.textContent = s.tips;
      depShowOnly('dep-step-error');
    }
  );
}

export function depSubmitCrypto() {
  depShowOnly('dep-step-processing');
  const sub   = $('dep-proc-sub');
  const steps = ['Scanning blockchain…','Confirming transaction…','Crediting account…'];
  let i = 0;
  const iv = setInterval(() => { if (sub && i < steps.length) sub.textContent = steps[i++]; }, 700);
  setTimeout(() => {
    clearInterval(iv);
    addFundsInternal(depAmt, 'Crypto Deposit');
    const sa = $('dep-success-amt'); if (sa) sa.textContent = '+$' + depAmt;
    const sb = $('dep-success-bal'); if (sb) sb.textContent = 'New balance: $' + fmt(G.bal);
    depShowOnly('dep-step-success');
  }, 2400);
}

export function depSwitchMethod() {
  depMethod = depMethod === 'card' ? 'crypto' : 'card';
  depGoStep2();
}

export function copyCryptoAddr() {
  const el = $('dep-btc-addr'); if (!el) return;
  navigator.clipboard.writeText(el.textContent.trim()).catch(() => {});
  el.style.color = 'var(--g)';
  setTimeout(() => { el.style.color = 'var(--t2)'; }, 1400);
}

// ── WITHDRAW ────────────────────────────────────────────────

let wdMethod = null;
let wdNet    = 'BTC';

const WD_STEPS = ['wd-step-1','wd-step-2-bank','wd-step-2-crypto','wd-step-processing','wd-step-success','wd-step-error'];

function wdShowOnly(id) {
  WD_STEPS.forEach(s => { const el = $(s); if (el) el.style.display = s === id ? 'block' : 'none'; });
}

export function openShWithdraw() {
  const wb = $('wd-bal'); if (wb) wb.textContent = fmt(G.bal);
  const zw = $('wd-zero-warn'); if (zw) zw.style.display = G.bal <= 0 ? 'block' : 'none';
  ['wd-bank-btn-amt','wd-crypto-btn-amt'].forEach(id => { const e = $(id); if (e) e.textContent = fmt(G.bal); });
  ['wd-bank-display','wd-crypto-display'].forEach(id => { const e = $(id); if (e) e.textContent = '$' + fmt(G.bal); });
  wdShowOnly('wd-step-1');
}

export function wdPickMethod(method) {
  if (G.bal <= 0) {
    const zw = $('wd-zero-warn');
    if (zw) { zw.style.display = 'block'; zw.style.color = 'var(--r)'; zw.textContent = '⚠ Balance is $0 — nothing to withdraw'; }
    return;
  }
  wdMethod = method;
  const balStr = fmt(G.bal);
  ['wd-bank-btn-amt','wd-crypto-btn-amt'].forEach(id => { const e = $(id); if (e) e.textContent = balStr; });
  ['wd-bank-display','wd-crypto-display'].forEach(id => { const e = $(id); if (e) e.textContent = '$' + balStr; });
  wdShowOnly('wd-step-2-' + method);
}

export function wdGoStep1() { wdShowOnly('wd-step-1'); }

export function wdClearErr() {
  ['wd-bank-err','wd-wallet-err'].forEach(id => { const e = $(id); if (e) e.style.display = 'none'; });
}

export function wdPickNet(el, net) {
  wdNet = net;
  ['wd-net-btc','wd-net-eth','wd-net-usdt'].forEach(id => { const e = $(id); if (e) e.classList.remove('sel'); });
  el.classList.add('sel');
}

function wdValidateBank() {
  const name = ($('wd-bank-name')?.value || '').trim();
  const iban = ($('wd-bank-iban')?.value || '').trim().replace(/\s/g, '');
  const err  = $('wd-bank-err');
  const showE = msg => { if (err) { err.textContent = msg; err.style.display = 'block'; } return false; };
  if (name.length < 2) return showE('Enter the account holder name.');
  if (iban.length < 8) return showE('Enter a valid IBAN or account number.');
  return true;
}

function wdValidateCrypto() {
  const addr = ($('wd-wallet-addr')?.value || '').trim();
  const err  = $('wd-wallet-err');
  if (addr.length < 10) { if (err) { err.textContent = 'Enter a valid wallet address.'; err.style.display = 'block'; } return false; }
  return true;
}

export function wdSubmit(method) {
  if (method === 'bank'   && !wdValidateBank())   return;
  if (method === 'crypto' && !wdValidateCrypto()) return;
  wdShowOnly('wd-step-processing');
  const sub   = $('wd-proc-sub');
  const steps = method === 'bank'
    ? ['Verifying account…','Initiating transfer…','Confirming details…']
    : ['Verifying wallet…','Broadcasting transaction…','Confirming…'];
  let i = 0;
  const iv = setInterval(() => { if (sub && i < steps.length) sub.textContent = steps[i++]; }, 700);
  setTimeout(() => {
    clearInterval(iv);
    const amt = G.bal;
    G.txns = [{ lbl: 'Withdrawal', d: -amt }, ...G.txns].slice(0, 20);
    G.bal  = 0;
    updateAll();
    const sa = $('wd-success-amt'); if (sa) sa.textContent = '$' + fmt(amt);
    const ss = $('wd-success-sub'); if (ss) ss.textContent = method === 'bank' ? 'Sent to bank account' : 'Sent to crypto wallet';
    const se = $('wd-success-eta'); if (se) se.textContent = method === 'bank' ? 'ETA: 2–5 business days' : 'ETA: ~1 hour';
    wdShowOnly('wd-step-success');
  }, 2200);
}

export function wdReset() {
  wdMethod = null; wdNet = 'BTC';
  wdShowOnly('wd-step-1');
  ['wd-bank-name','wd-bank-iban','wd-bank-bic','wd-wallet-addr'].forEach(id => { const e = $(id); if (e) e.value = ''; });
  wdClearErr();
}
