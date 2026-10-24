// Sugere 4 golpes de dano para cada membro do time.
//
// 1. Cada membro leva o STAB mais forte de cada um dos seus tipos.
// 2. As vagas restantes são preenchidas, uma por vez, com o golpe (de qualquer membro) que mais
//    acrescenta: acertar super efetivo os tipos que ameaçam o próprio pokémon e o time,
//    e tipos que ainda ninguém do time acerta. Repetir golpes entre membros é permitido.

import { abilityEffect, applyAbilityDefense } from './abilities';
import type { GameMoves, Move, TeamMember } from './data';
import { defensiveMultiplier, effectiveness, typesForGen, type TypeName } from './typeChart';

export const MOVES_PER_POKEMON = 4;

/** Pesos do ganho de cada golpe. */
const WEIGHTS = {
  coverage: 1, // acertar super efetivo um tipo qualquer
  teamThreat: 1, // extra se o time tem mais membros fracos do que resistentes a esse tipo
  unresisted: 0.5, // extra se ninguém do time resiste a esse tipo
  selfThreat: 1.2, // extra se o próprio pokémon é fraco a esse tipo
  strength: 0.6, // a cada 100 de poder efetivo
  usefulStrength: 60, // abaixo disso o golpe conta só parcialmente para cobertura
};

export interface SuggestedMove extends Move {
  stab: boolean;
  /** Poder efetivo: poder × acertos × precisão × STAB × atributo de ataque × habilidade. */
  strength: number;
  /** Tipos que o golpe acerta super efetivo e que são fraquezas do pokémon ou do time. */
  counters: TypeName[];
}

export interface Moveset {
  pokemonId: number;
  moves: SuggestedMove[];
}

interface Option {
  move: Move;
  strength: number;
}

function moveStrength(move: Move, { pokemon, ability }: TeamMember): number {
  const effect = abilityEffect(ability);
  // Huge Power e afins multiplicam o Ataque, o que pode mudar qual categoria compensa mais.
  const atk = pokemon.atk * (effect.physicalMultiplier ?? 1);
  const stat = move.category === 'physical' ? atk : pokemon.spa;
  const statFactor = stat / Math.max(atk, pokemon.spa, 1);
  const stab = pokemon.types.includes(move.type) ? (effect.stab ?? 1.5) : 1;
  const technician = effect.technician && move.power <= 60 ? 1.5 : 1;
  return move.power * technician * move.hits * ((move.accuracy ?? 100) / 100) * stab * statFactor;
}

export function suggestMovesets(team: TeamMember[], gameMoves: GameMoves, gen: number): Moveset[] {
  const types = typesForGen(gen);
  const validTypes = new Set(types);

  // Índices dos tipos defensores que um tipo de golpe acerta super efetivo.
  const superEffective = new Map(
    types.map((attack) => [attack, types.flatMap((defend, i) => (effectiveness(attack, defend, gen) > 1 ? [i] : []))]),
  );

  // Multiplicador que cada membro recebe de cada tipo de ataque, já com a habilidade.
  const received = (member: TeamMember, attack: TypeName) =>
    applyAbilityDefense(defensiveMultiplier(attack, member.pokemon.types, gen), attack, member.ability);

  const teamWeak = types.map((attack) => {
    let weak = 0;
    let resist = 0;
    for (const member of team) {
      const mult = received(member, attack);
      if (mult > 1) weak++;
      else if (mult < 1) resist++;
    }
    return { weak: weak > resist, unresisted: weak > 0 && resist === 0 };
  });
  const teamThreat = teamWeak.map(
    (w) => WEIGHTS.coverage + (w.weak ? WEIGHTS.teamThreat : 0) + (w.unresisted ? WEIGHTS.unresisted : 0),
  );

  const members = team.map((teamMember) => {
    const { pokemon } = teamMember;
    // Só o golpe mais forte de cada tipo interessa: dois golpes do mesmo tipo não somam cobertura.
    const bestByType = new Map<TypeName, Option>();
    for (const id of gameMoves.learnsets.get(pokemon.id) ?? []) {
      const move = gameMoves.moves.get(id);
      if (!move || !validTypes.has(move.type)) continue;
      const strength = moveStrength(move, teamMember);
      const current = bestByType.get(move.type);
      if (!current || strength > current.strength) bestByType.set(move.type, { move, strength });
    }
    return {
      pokemon,
      options: [...bestByType.values()],
      chosen: [] as Option[],
      selfWeak: types.map((attack) => received(teamMember, attack) > 1),
      hits: new Set<number>(), // tipos defensores que esse membro já acerta super efetivo
    };
  });
  type Member = (typeof members)[number];

  const membersHitting = types.map(() => 0);

  const choose = (member: Member, option: Option) => {
    member.chosen.push(option);
    for (const i of superEffective.get(option.move.type)!) {
      if (member.hits.has(i)) continue;
      member.hits.add(i);
      membersHitting[i]++;
    }
  };

  const gain = (member: Member, option: Option) => {
    let coverage = 0;
    for (const i of superEffective.get(option.move.type)!) {
      if (member.hits.has(i)) continue;
      // Cada membro a mais que já acerta o tipo vale metade do anterior.
      coverage += teamThreat[i] * 0.5 ** membersHitting[i] + (member.selfWeak[i] ? WEIGHTS.selfThreat : 0);
    }
    const usefulness = Math.min(1, option.strength / WEIGHTS.usefulStrength);
    return coverage * usefulness + (WEIGHTS.strength * option.strength) / 100;
  };

  for (const member of members) {
    for (const type of member.pokemon.types) {
      const stab = member.options.find((o) => o.move.type === type);
      if (stab) choose(member, stab);
    }
  }

  for (;;) {
    let best: { member: Member; option: Option; value: number } | null = null;
    for (const member of members) {
      if (member.chosen.length >= MOVES_PER_POKEMON) continue;
      for (const option of member.options) {
        if (member.chosen.includes(option)) continue;
        const value = gain(member, option);
        if (!best || value > best.value) best = { member, option, value };
      }
    }
    if (!best) break;
    choose(best.member, best.option);
  }

  return members.map((member) => ({
    pokemonId: member.pokemon.id,
    moves: member.chosen
      .map(({ move, strength }) => ({
        ...move,
        stab: member.pokemon.types.includes(move.type),
        strength: Math.round(strength),
        counters: superEffective
          .get(move.type)!
          .filter((i) => member.selfWeak[i] || teamWeak[i].weak)
          .map((i) => types[i]),
      }))
      .sort((a, b) => Number(b.stab) - Number(a.stab) || b.strength - a.strength),
  }));
}
