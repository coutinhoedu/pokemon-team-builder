// Papel de cada pokémon no time (atacante físico, especial, misto ou tank) e as composições
// aceitas pela opção "Equilibrar atacantes".

import { abilityEffect } from './abilities';
import type { TeamMember } from './data';

export type Role = 'physical' | 'special' | 'mixed' | 'tank';

export const ROLE_LABELS: Record<Role, string> = {
  physical: 'Físico',
  special: 'Especial',
  mixed: 'Misto',
  tank: 'Tank',
};

/** Ataque e Ataque Especial a menos de 15% um do outro contam como misto. */
const MIXED_RATIO = 0.85;
/** Tank: a média de HP/Def/SpD supera o melhor atributo ofensivo em 5% ou mais. */
const TANK_RATIO = 1.05;

export function classifyRole({ pokemon: p, ability }: TeamMember): Role {
  // Huge Power e afins contam: um Azumarill com Huge Power é atacante físico.
  const atk = p.atk * (abilityEffect(ability).physicalMultiplier ?? 1);
  const offense = Math.max(atk, p.spa);
  const bulk = (p.hp + p.def + p.spd) / 3;
  if (bulk >= offense * TANK_RATIO) return 'tank';
  if (Math.min(atk, p.spa) / offense >= MIXED_RATIO) return 'mixed';
  return atk > p.spa ? 'physical' : 'special';
}

export type RoleCounts = Record<Role, number>;

const ALL_ATTACKERS: RoleCounts = { physical: 3, special: 3, mixed: 0, tank: 0 };
const TWO_MIXED: RoleCounts = { physical: 2, special: 2, mixed: 2, tank: 0 };
const MIXED_AND_TANK: RoleCounts = { physical: 2, special: 2, mixed: 1, tank: 1 };
const TWO_TANKS: RoleCounts = { physical: 2, special: 2, mixed: 0, tank: 2 };

/** Estilo do time quando "Equilibrar atacantes" está ligado. */
export type BalanceStyle = 'auto' | 'offensive' | 'balanced' | 'defensive';

export interface BalanceStyleInfo {
  label: string;
  description: string;
  compositions: RoleCounts[]; // composições aceitas nesse estilo
}

/**
 * Composições aceitas em cada estilo. "auto" aceita todas e deixa a busca escolher a de melhor
 * nota (inclusive 3 físicos + 3 especiais); os outros fixam as duas vagas flexíveis.
 */
export const BALANCE_STYLES: Record<BalanceStyle, BalanceStyleInfo> = {
  auto: {
    label: 'Automático',
    description: 'A melhor nota entre todas as composições',
    compositions: [ALL_ATTACKERS, TWO_MIXED, MIXED_AND_TANK, TWO_TANKS],
  },
  offensive: { label: 'Ofensivo', description: '2 físicos, 2 especiais e 2 mistos', compositions: [TWO_MIXED] },
  balanced: { label: 'Equilibrado', description: '2 físicos, 2 especiais, 1 misto e 1 tank', compositions: [MIXED_AND_TANK] },
  defensive: { label: 'Defensivo', description: '2 físicos, 2 especiais e 2 tanks', compositions: [TWO_TANKS] },
};

export const emptyCounts = (): RoleCounts => ({ physical: 0, special: 0, mixed: 0, tank: 0 });

export function countRoles(roles: Role[]): RoleCounts {
  const counts = emptyCounts();
  for (const role of roles) counts[role]++;
  return counts;
}

/** Um time (parcial ou completo) ainda cabe em alguma composição aceita pelo estilo? */
export const canReachBalance = (counts: RoleCounts, style: BalanceStyle) =>
  BALANCE_STYLES[style].compositions.some((target) =>
    (Object.keys(target) as Role[]).every((role) => counts[role] <= target[role]),
  );

const ROLE_PLURALS: Record<Role, string> = {
  physical: 'físicos',
  special: 'especiais',
  mixed: 'mistos',
  tank: 'tanks',
};

/** Ex.: "3 físicos · 2 especiais · 1 tank". */
export function describeCounts(counts: RoleCounts): string {
  return (Object.keys(counts) as Role[])
    .filter((role) => counts[role] > 0)
    .map((role) => `${counts[role]} ${counts[role] > 1 ? ROLE_PLURALS[role] : ROLE_LABELS[role].toLowerCase()}`)
    .join(' · ');
}
