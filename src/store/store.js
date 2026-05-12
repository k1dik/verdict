/**
 * store.js — Reactive state. Extracted verbatim from verdict-v27.
 *
 * HOW TO USE:
 *   import { Store, G } from './store/store.js'
 *
 *   G.bal = 300                          // triggers subscribers
 *   Store.subscribe('bal', val => ...)   // react to changes
 *   Store.snapshot()                     // save state
 *   Store.reset({ uid: G.uid })          // reset keeping uid
 */

const Store = (() => {
  const _initial = {
    bal: 1000, realBal: 0, rounds: 0, wins: 0, trusts: 0, stake: 25,
    myC: null, theirC: null, hist: [], txns: [],
    pnl: 0, waged: 0, rake: 0, rid: 1,
    name: 'Player', avatar: '0', global: 12483, wt: null,
    lastOpp: null, lastOppReal: false, mode: 'demo',
    uid: null, _challenger: null,
  };

  const _listeners = {};

  function _notify(key, val) {
    (_listeners[key] || []).forEach(fn => { try { fn(val, key); } catch (e) { console.warn('[Store] subscriber error:', e); } });
    (_listeners['*'] || []).forEach(fn => { try { fn(val, key); } catch (e) {} });
  }

  function _clone(v) {
    if (v === null || typeof v !== 'object') return v;
    return JSON.parse(JSON.stringify(v));
  }

  const _state = Object.assign({}, _initial);

  const proxy = new Proxy(_state, {
    set(target, key, value) {
      const prev = target[key];
      target[key] = value;
      if (prev !== value) _notify(key, value);
      return true;
    },
    get(target, key) {
      return target[key];
    },
  });

  return {
    state: proxy,

    subscribe(key, fn) {
      if (!_listeners[key]) _listeners[key] = new Set();
      _listeners[key].add(fn);
      return () => _listeners[key].delete(fn);
    },

    snapshot() { return _clone(_state); },

    restore(snap) {
      Object.keys(snap).forEach(k => { proxy[k] = snap[k]; });
    },

    reset(overrides = {}) {
      const fresh = Object.assign({}, _initial, overrides);
      Object.keys(fresh).forEach(k => { proxy[k] = fresh[k]; });
    },
  };
})();

// Drop-in alias — all existing HTML code using G.* works unchanged
const G = Store.state;

export { Store, G };
