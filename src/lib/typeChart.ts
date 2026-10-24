// Tabela de tipos, com as diferenças entre gerações.

export const ALL_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;

export type TypeName = (typeof ALL_TYPES)[number];

type Row = Partial<Record<TypeName, number>>;
type Chart = Record<TypeName, Row>;

// Gen 6 em diante. Linha = tipo do ataque, coluna = tipo do defensor; o que não aparece é 1x.
const MODERN_CHART: Chart = {
  normal: { rock: 0.5, steel: 0.5, ghost: 0 },
  fire: { grass: 2, ice: 2, bug: 2, steel: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
  water: { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
  grass: {
    water: 2, ground: 2, rock: 2,
    fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5,
  },
  ice: { grass: 2, ground: 2, flying: 2, dragon: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  fighting: {
    normal: 2, ice: 2, rock: 2, dark: 2, steel: 2,
    poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0,
  },
  poison: { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying: { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug: {
    grass: 2, psychic: 2, dark: 2,
    fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5,
  },
  rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost: { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel: { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy: { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
};

/** Tipos que existem na geração (Dark/Steel chegaram na Gen 2, Fairy na Gen 6). */
export function typesForGen(gen: number): TypeName[] {
  return ALL_TYPES.filter((type) => {
    if (gen < 2 && (type === 'dark' || type === 'steel')) return false;
    if (gen < 6 && type === 'fairy') return false;
    return true;
  });
}

const chartCache = new Map<number, Chart>();

function chartForGen(gen: number): Chart {
  const era = gen >= 6 ? 6 : gen >= 2 ? 2 : 1;
  const cached = chartCache.get(era);
  if (cached) return cached;

  const chart = Object.fromEntries(
    ALL_TYPES.map((type) => [type, { ...MODERN_CHART[type] }]),
  ) as Chart;

  if (era < 6) {
    // Gen 2-5: Steel resistia Ghost e Dark.
    chart.ghost.steel = 0.5;
    chart.dark.steel = 0.5;
  }
  if (era === 1) {
    chart.ghost.psychic = 0; // o famoso bug da Gen 1
    chart.bug.poison = 2;
    chart.poison.bug = 2;
    delete chart.ice.fire; // Fire só passou a resistir Ice na Gen 2
  }

  chartCache.set(era, chart);
  return chart;
}

/** Multiplicador de um tipo de ataque contra um único tipo defensor. */
export function effectiveness(attack: TypeName, defend: TypeName, gen: number): number {
  return chartForGen(gen)[attack][defend] ?? 1;
}

/** Multiplicador de um tipo de ataque contra um pokémon (1 ou 2 tipos). */
export function defensiveMultiplier(attack: TypeName, defenderTypes: TypeName[], gen: number): number {
  return defenderTypes.reduce((mult, type) => mult * effectiveness(attack, type, gen), 1);
}
