// Efeitos das habilidades que o builder leva em conta. Só as relevantes estão aqui:
// as que não aparecem são tratadas como neutras.

import type { Ability } from './data';
import type { TypeName } from './typeChart';

export interface AbilityEffect {
  /** Ajuste em "pontos de BST": negativo = prejudicial (Truant), positivo = muito boa. */
  rating?: number;
  immune?: TypeName[]; // dano 0 desses tipos
  resist?: TypeName[]; // dano pela metade desses tipos
  extra?: Partial<Record<TypeName, number>>; // multiplicadores extras (ex.: Dry Skin contra Fogo)
  filter?: boolean; // golpes super efetivos causam 3/4 do dano
  physicalMultiplier?: number; // multiplica o Ataque (Huge Power)
  stab?: number; // novo bônus de STAB (Adaptability)
  technician?: boolean; // golpes com poder <= 60 ganham 1,5x
}

export const ABILITY_EFFECTS: Record<string, AbilityEffect> = {
  // Prejudiciais
  truant: { rating: -220 },
  'slow-start': { rating: -200 },
  defeatist: { rating: -80 },
  klutz: { rating: -40 },
  normalize: { rating: -40 },
  stall: { rating: -30 },
  'wimp-out': { rating: -20 },
  'emergency-exit': { rating: -20 },

  // Defensivas (mudam a tabela de tipos do pokémon)
  levitate: { immune: ['ground'] },
  'earth-eater': { immune: ['ground'] },
  'flash-fire': { immune: ['fire'] },
  'well-baked-body': { immune: ['fire'] },
  'water-absorb': { immune: ['water'] },
  'storm-drain': { immune: ['water'] },
  'dry-skin': { immune: ['water'], extra: { fire: 1.25 } },
  'volt-absorb': { immune: ['electric'] },
  'lightning-rod': { immune: ['electric'] },
  'motor-drive': { immune: ['electric'] },
  'sap-sipper': { immune: ['grass'] },
  'thick-fat': { resist: ['fire', 'ice'] },
  heatproof: { resist: ['fire'] },
  'water-bubble': { resist: ['fire'], rating: 20 },
  'purifying-salt': { resist: ['ghost'], rating: 20 },
  fluffy: { extra: { fire: 2 }, rating: 20 },
  filter: { filter: true },
  'solid-rock': { filter: true },
  'prism-armor': { filter: true },

  // Ofensivas
  'huge-power': { rating: 120, physicalMultiplier: 2 },
  'pure-power': { rating: 120, physicalMultiplier: 2 },
  'gorilla-tactics': { rating: 30, physicalMultiplier: 1.5 },
  hustle: { rating: 10, physicalMultiplier: 1.2 }, // 1,5x de Ataque, mas 80% de precisão
  adaptability: { rating: 30, stab: 2 },
  technician: { rating: 20, technician: true },
  'sheer-force': { rating: 30 },
  'tough-claws': { rating: 20 },
  'iron-fist': { rating: 15 },
  'strong-jaw': { rating: 15 },
  'mega-launcher': { rating: 15 },
  sharpness: { rating: 15 },
  moxie: { rating: 30 },
  'beast-boost': { rating: 30 },
  'intrepid-sword': { rating: 40 },

  // Gerais
  'speed-boost': { rating: 40 },
  intimidate: { rating: 40 },
  protean: { rating: 40 },
  libero: { rating: 40 },
  drought: { rating: 30 },
  drizzle: { rating: 30 },
  'sand-stream': { rating: 20 },
  'snow-warning': { rating: 20 },
  multiscale: { rating: 30 },
  'shadow-shield': { rating: 30 },
  regenerator: { rating: 30 },
  'magic-guard': { rating: 30 },
  'magic-bounce': { rating: 30 },
  'dauntless-shield': { rating: 30 },
  'good-as-gold': { rating: 30 },
  prankster: { rating: 20 },
  'serene-grace': { rating: 20 },
  guts: { rating: 20 },
  unaware: { rating: 20 },
  sturdy: { rating: 10 },
};

/** Habilidade oculta costuma ser mais difícil de obter numa campanha. */
const HIDDEN_PENALTY = -10;

export const abilityEffect = (ability: Ability | null): AbilityEffect =>
  (ability && ABILITY_EFFECTS[ability.id]) || {};

export function abilityRating(ability: Ability | null): number {
  if (!ability) return 0;
  return (abilityEffect(ability).rating ?? 0) + (ability.hidden ? HIDDEN_PENALTY : 0);
}

export const isHarmful = (ability: Ability) => (ABILITY_EFFECTS[ability.id]?.rating ?? 0) < 0;

/** Aplica a habilidade ao multiplicador que o pokémon recebe de um tipo de ataque. */
export function applyAbilityDefense(multiplier: number, attack: TypeName, ability: Ability | null): number {
  const effect = abilityEffect(ability);
  if (effect.immune?.includes(attack)) return 0;
  let result = multiplier;
  if (effect.resist?.includes(attack)) result *= 0.5;
  result *= effect.extra?.[attack] ?? 1;
  if (effect.filter && result > 1) result *= 0.75;
  return result;
}
