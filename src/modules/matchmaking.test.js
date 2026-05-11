/**
 * matchmaking.test.js — тесты для логики matchmaking.
 *
 * Тестируем только чистую логику (без DOM и браузера):
 *  - simulateChoice — что выбирает бот в зависимости от стратегии
 *  - histDotsHtml   — правильно ли рисуются точки истории
 *  - trustBarColor  — правильный ли цвет для процента доверия
 */

import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Копируем чистые функции прямо сюда для тестирования.
// Они не зависят от DOM или G — можно тестировать изолированно.
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// ТЕСТЫ: simulateChoice
// ─────────────────────────────────────────────────────────────

describe('simulateChoice — стратегия tit_for_tat', () => {
  const player = { strategy: 'tit_for_tat' };

  it('первый ход (нет истории) → доверяет', () => {
    expect(simulateChoice(player, null)).toBe('trust');
  });

  it('я доверял → доверяет в ответ', () => {
    expect(simulateChoice(player, 'trust')).toBe('trust');
  });

  it('я предал → предаёт в ответ', () => {
    expect(simulateChoice(player, 'take')).toBe('take');
  });
});

describe('simulateChoice — стратегия suspicious_tft', () => {
  const player = { strategy: 'suspicious_tft' };

  it('первый ход → сразу предаёт (подозрительный)', () => {
    expect(simulateChoice(player, null)).toBe('take');
  });

  it('я доверял → доверяет', () => {
    expect(simulateChoice(player, 'trust')).toBe('trust');
  });

  it('я предал → предаёт', () => {
    expect(simulateChoice(player, 'take')).toBe('take');
  });
});

describe('simulateChoice — стратегия defector', () => {
  const player = { strategy: 'defector' };

  it('возвращает только trust или take', () => {
    // Запускаем 20 раз — всегда должен быть один из двух вариантов
    for (let i = 0; i < 20; i++) {
      const result = simulateChoice(player, null);
      expect(['trust', 'take']).toContain(result);
    }
  });

  it('в основном предаёт (>50% take из 100 попыток)', () => {
    let takes = 0;
    for (let i = 0; i < 100; i++) {
      if (simulateChoice(player, null) === 'take') takes++;
    }
    // Дефектор берёт take с вероятностью 80% — должно быть >50
    expect(takes).toBeGreaterThan(50);
  });
});

describe('simulateChoice — стратегия random', () => {
  const player = { strategy: 'random' };

  it('возвращает только trust или take', () => {
    for (let i = 0; i < 20; i++) {
      const result = simulateChoice(player, null);
      expect(['trust', 'take']).toContain(result);
    }
  });
});

describe('simulateChoice — неизвестная стратегия', () => {
  it('неизвестная стратегия работает как random', () => {
    const player = { strategy: 'неизвестно_123' };
    for (let i = 0; i < 10; i++) {
      expect(['trust', 'take']).toContain(simulateChoice(player, null));
    }
  });
});

// ─────────────────────────────────────────────────────────────
// ТЕСТЫ: trustBarColor
// ─────────────────────────────────────────────────────────────

describe('trustBarColor — цвет полоски доверия', () => {
  it('65% и выше → зелёный', () => {
    expect(trustBarColor(65)).toBe('var(--g)');
    expect(trustBarColor(80)).toBe('var(--g)');
    expect(trustBarColor(100)).toBe('var(--g)');
  });

  it('40–64% → жёлтый', () => {
    expect(trustBarColor(40)).toBe('var(--y)');
    expect(trustBarColor(50)).toBe('var(--y)');
    expect(trustBarColor(64)).toBe('var(--y)');
  });

  it('ниже 40% → красный', () => {
    expect(trustBarColor(0)).toBe('var(--r)');
    expect(trustBarColor(20)).toBe('var(--r)');
    expect(trustBarColor(39)).toBe('var(--r)');
  });
});

// ─────────────────────────────────────────────────────────────
// ТЕСТЫ: histDotsHtml
// ─────────────────────────────────────────────────────────────

describe('histDotsHtml — история решений в точках', () => {
  it('пустая история → показывает "No data"', () => {
    expect(histDotsHtml(null)).toContain('No data');
    expect(histDotsHtml('')).toContain('No data');
  });

  it('T → зелёная точка', () => {
    const html = histDotsHtml('T');
    expect(html).toContain('var(--g)');
    expect(html).toContain('hdot');
  });

  it('B → красная точка (предательство)', () => {
    const html = histDotsHtml('B');
    expect(html).toContain('var(--r)');
  });

  it('TTBT → 4 точки', () => {
    const html = histDotsHtml('TTBT');
    const count = (html.match(/hdot/g) || []).length;
    expect(count).toBe(4);
  });

  it('размер точки применяется корректно', () => {
    const html = histDotsHtml('T', 14);
    expect(html).toContain('width:14px');
    expect(html).toContain('height:14px');
  });
});
