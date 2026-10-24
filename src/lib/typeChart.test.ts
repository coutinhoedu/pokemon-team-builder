import { describe, expect, it } from 'vitest';
import { defensiveMultiplier, effectiveness, typesForGen } from './typeChart';

describe('typeChart', () => {
  it('conhece os tipos de cada geração', () => {
    expect(typesForGen(1)).toHaveLength(15);
    expect(typesForGen(5)).toHaveLength(17);
    expect(typesForGen(9)).toHaveLength(18);
  });

  it('calcula multiplicadores básicos e combinados', () => {
    expect(effectiveness('fire', 'grass', 9)).toBe(2);
    expect(effectiveness('normal', 'ghost', 9)).toBe(0);
    expect(defensiveMultiplier('ice', ['dragon', 'flying'], 9)).toBe(4);
    expect(defensiveMultiplier('ground', ['fire', 'flying'], 9)).toBe(0);
    expect(defensiveMultiplier('water', ['water', 'grass'], 9)).toBe(0.25);
  });

  it('aplica as mudanças das gerações antigas', () => {
    expect(effectiveness('dark', 'steel', 5)).toBe(0.5);
    expect(effectiveness('dark', 'steel', 6)).toBe(1);
    expect(effectiveness('ghost', 'psychic', 1)).toBe(0);
    expect(effectiveness('ghost', 'psychic', 2)).toBe(2);
    expect(effectiveness('bug', 'poison', 1)).toBe(2);
    expect(effectiveness('ice', 'fire', 1)).toBe(1);
    expect(effectiveness('ice', 'fire', 2)).toBe(0.5);
  });
});
