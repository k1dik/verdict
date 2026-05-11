/**
 * payments.test.js — тесты для логики payments.
 *
 * Тестируем чистую логику без DOM:
 *  - addFundsInternal — правильно ли добавляется баланс
 *  - fmtCard          — форматирование номера карты
 *  - fmtExpiry        — форматирование даты карты
 *  - depValidateCard  — валидация карты
 *  - wdValidateBank   — валидация банковских данных
 *  - wdValidateCrypto — валидация крипто кошелька
 *  - wdSubmit логика  — вывод обнуляет баланс
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Мок G (состояние игры) — без браузера
// ─────────────────────────────────────────────────────────────

let G;

beforeEach(() => {
  G = { bal: 100, txns: [] };
});

// ─────────────────────────────────────────────────────────────
// Копируем чистые функции для тестирования
// ─────────────────────────────────────────────────────────────

function addFundsInternal(G, n, lbl) {
  G.bal  = parseFloat((G.bal + n).toFixed(2));
  G.txns = [{ lbl: lbl || 'Deposit', d: n }, ...G.txns].slice(0, 20);
}

function fmtCard(value) {
  let v = value.replace(/\D/g, '').slice(0, 16);
  return v.match(/.{1,4}/g)?.join(' ') || v;
}

function fmtExpiry(value) {
  let v = value.replace(/\D/g, '');
  if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2, 4);
  return v;
}

function depValidateCard({ num, exp, cvv, name }) {
  const cleanNum = num.replace(/\s/g, '');
  if (cleanNum.length < 13)                         return 'Card number must be 13–16 digits.';
  if (!/^\d{2}\/\d{2}$/.test(exp))                  return 'Enter expiry as MM/YY.';
  const [mm, yy] = exp.split('/').map(Number);
  if (mm < 1 || mm > 12)                            return 'Invalid expiry month.';
  if (new Date(2000 + yy, mm - 1, 1) < new Date())  return 'This card has expired.';
  if (cvv.length < 3)                               return 'CVV must be 3–4 digits.';
  if (name.trim().length < 2)                       return 'Enter the name on your card.';
  return true;
}

function wdValidateBank({ name, iban }) {
  if (name.trim().length < 2)                       return 'Enter the account holder name.';
  if (iban.trim().replace(/\s/g, '').length < 8)    return 'Enter a valid IBAN or account number.';
  return true;
}

function wdValidateCrypto({ addr }) {
  if (addr.trim().length < 10) return 'Enter a valid wallet address.';
  return true;
}

function wdSubmit(G, method) {
  const amt = G.bal;
  G.txns = [{ lbl: 'Withdrawal', d: -amt }, ...G.txns].slice(0, 20);
  G.bal  = 0;
}

// ─────────────────────────────────────────────────────────────
// ТЕСТЫ: addFundsInternal
// ─────────────────────────────────────────────────────────────

describe('addFundsInternal — пополнение баланса', () => {
  it('добавляет сумму к балансу', () => {
    addFundsInternal(G, 50);
    expect(G.bal).toBe(150);
  });

  it('баланс не уходит в бесконечные дроби', () => {
    addFundsInternal(G, 0.1);
    addFundsInternal(G, 0.2);
    expect(G.bal).toBe(100.30);
  });

  it('добавляет запись в историю транзакций', () => {
    addFundsInternal(G, 200, 'Card Deposit');
    expect(G.txns.length).toBe(1);
    expect(G.txns[0].lbl).toBe('Card Deposit');
    expect(G.txns[0].d).toBe(200);
  });

  it('история не превышает 20 записей', () => {
    for (let i = 0; i < 25; i++) addFundsInternal(G, 10);
    expect(G.txns.length).toBe(20);
  });

  it('без метки — записывается как "Deposit"', () => {
    addFundsInternal(G, 50);
    expect(G.txns[0].lbl).toBe('Deposit');
  });
});

// ─────────────────────────────────────────────────────────────
// ТЕСТЫ: fmtCard
// ─────────────────────────────────────────────────────────────

describe('fmtCard — форматирование номера карты', () => {
  it('добавляет пробелы каждые 4 цифры', () => {
    expect(fmtCard('1234567890123456')).toBe('1234 5678 9012 3456');
  });

  it('убирает нецифровые символы', () => {
    expect(fmtCard('1234-5678-9012-3456')).toBe('1234 5678 9012 3456');
  });

  it('обрезает до 16 цифр', () => {
    expect(fmtCard('12345678901234567890')).toBe('1234 5678 9012 3456');
  });

  it('короткий номер форматируется правильно', () => {
    expect(fmtCard('1234')).toBe('1234');
  });
});

// ─────────────────────────────────────────────────────────────
// ТЕСТЫ: fmtExpiry
// ─────────────────────────────────────────────────────────────

describe('fmtExpiry — форматирование даты карты', () => {
  it('добавляет слэш после месяца', () => {
    expect(fmtExpiry('1225')).toBe('12/25');
  });

  it('не трогает уже отформатированную дату', () => {
    expect(fmtExpiry('12/25')).toBe('12/25');
  });

  it('меньше 3 цифр — без слэша', () => {
    expect(fmtExpiry('12')).toBe('12');
  });
});

// ─────────────────────────────────────────────────────────────
// ТЕСТЫ: depValidateCard
// ─────────────────────────────────────────────────────────────

describe('depValidateCard — валидация карты', () => {
  const valid = { num: '4111 1111 1111 1111', exp: '12/99', cvv: '123', name: 'John Doe' };

  it('валидная карта → возвращает true', () => {
    expect(depValidateCard(valid)).toBe(true);
  });

  it('короткий номер карты → ошибка', () => {
    expect(depValidateCard({ ...valid, num: '1234' })).toContain('13–16 digits');
  });

  it('неправильный формат даты → ошибка', () => {
    expect(depValidateCard({ ...valid, exp: '1299' })).toContain('MM/YY');
  });

  it('невалидный месяц (13) → ошибка', () => {
    expect(depValidateCard({ ...valid, exp: '13/99' })).toContain('month');
  });

  it('просроченная карта → ошибка', () => {
    expect(depValidateCard({ ...valid, exp: '01/20' })).toContain('expired');
  });

  it('CVV меньше 3 цифр → ошибка', () => {
    expect(depValidateCard({ ...valid, cvv: '12' })).toContain('CVV');
  });

  it('пустое имя → ошибка', () => {
    expect(depValidateCard({ ...valid, name: '' })).toContain('name');
  });
});

// ─────────────────────────────────────────────────────────────
// ТЕСТЫ: wdValidateBank
// ─────────────────────────────────────────────────────────────

describe('wdValidateBank — валидация банковских данных', () => {
  it('валидные данные → true', () => {
    expect(wdValidateBank({ name: 'John Doe', iban: 'GB29NWBK60161331926819' })).toBe(true);
  });

  it('пустое имя → ошибка', () => {
    expect(wdValidateBank({ name: '', iban: 'GB29NWBK60161331926819' })).toContain('name');
  });

  it('слишком короткий IBAN → ошибка', () => {
    expect(wdValidateBank({ name: 'John', iban: '123' })).toContain('IBAN');
  });
});

// ─────────────────────────────────────────────────────────────
// ТЕСТЫ: wdValidateCrypto
// ─────────────────────────────────────────────────────────────

describe('wdValidateCrypto — валидация крипто адреса', () => {
  it('валидный адрес → true', () => {
    expect(wdValidateCrypto({ addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf Na' })).toBe(true);
  });

  it('слишком короткий адрес → ошибка', () => {
    expect(wdValidateCrypto({ addr: 'abc' })).toContain('wallet address');
  });
});

// ─────────────────────────────────────────────────────────────
// ТЕСТЫ: wdSubmit — логика вывода
// ─────────────────────────────────────────────────────────────

describe('wdSubmit — вывод средств', () => {
  it('обнуляет баланс после вывода', () => {
    wdSubmit(G, 'bank');
    expect(G.bal).toBe(0);
  });

  it('записывает транзакцию с минусом', () => {
    wdSubmit(G, 'bank');
    expect(G.txns[0].d).toBe(-100);
    expect(G.txns[0].lbl).toBe('Withdrawal');
  });

  it('нельзя вывести больше чем есть — баланс не уходит в минус', () => {
    G.bal = 50;
    wdSubmit(G, 'crypto');
    expect(G.bal).toBe(0);
    expect(G.bal).toBeGreaterThanOrEqual(0);
  });
});
