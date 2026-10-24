// Baixa da PokeAPI tudo o que o team builder precisa e gera public/data/pokedex.json.
//
// A PokeAPI pede (fair use policy) que os dados sejam cacheados localmente, então cada
// resposta é salva em scripts/.cache e reaproveitada nas próximas execuções.
// Rode com: npm run fetch-data   (apague scripts/.cache para forçar um download novo)

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://pokeapi.co/api/v2';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, 'scripts', '.cache');
const OUT_FILE = path.join(ROOT, 'public', 'data', 'pokedex.json');
const GAMES_DIR = path.join(ROOT, 'public', 'data', 'games');
const CONCURRENCY = 8;

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
const genNumber = (generationName) => ROMAN[generationName.replace('generation-', '')];

const GAME_LABELS = {
  'red-blue': 'Red / Blue',
  yellow: 'Yellow',
  'gold-silver': 'Gold / Silver',
  crystal: 'Crystal',
  'ruby-sapphire': 'Ruby / Sapphire',
  emerald: 'Emerald',
  'firered-leafgreen': 'FireRed / LeafGreen',
  'diamond-pearl': 'Diamond / Pearl',
  platinum: 'Platinum',
  'heartgold-soulsilver': 'HeartGold / SoulSilver',
  'black-white': 'Black / White',
  'black-2-white-2': 'Black 2 / White 2',
  'x-y': 'X / Y',
  'omega-ruby-alpha-sapphire': 'Omega Ruby / Alpha Sapphire',
  'sun-moon': 'Sun / Moon',
  'ultra-sun-ultra-moon': 'Ultra Sun / Ultra Moon',
  'lets-go-pikachu-lets-go-eevee': "Let's Go Pikachu / Eevee",
  'sword-shield': 'Sword / Shield',
  'the-isle-of-armor': 'Sword / Shield: The Isle of Armor',
  'the-crown-tundra': 'Sword / Shield: The Crown Tundra',
  'brilliant-diamond-shining-pearl': 'Brilliant Diamond / Shining Pearl',
  'legends-arceus': 'Legends: Arceus',
  'scarlet-violet': 'Scarlet / Violet',
  'the-teal-mask': 'Scarlet / Violet: The Teal Mask',
  'the-indigo-disk': 'Scarlet / Violet: The Indigo Disk',
  'red-green-japan': 'Red / Green (JP)',
  'blue-japan': 'Blue (JP)',
  'legends-za': 'Legends: Z-A',
  'mega-dimension': 'Legends: Z-A: Mega Dimension',
};

// Formas regionais que existem em cada jogo. A PokeAPI não diz diretamente quais formas
// aparecem em qual jogo, então isso é uma aproximação mantida à mão.
const ALL_REGIONS = ['alola', 'galar', 'hisui', 'paldea'];
const REGIONAL_FORMS = {
  'sun-moon': ['alola'],
  'ultra-sun-ultra-moon': ['alola'],
  'lets-go-pikachu-lets-go-eevee': ['alola'],
  'sword-shield': ['alola', 'galar'],
  'the-isle-of-armor': ['alola', 'galar'],
  'the-crown-tundra': ['alola', 'galar'],
  'legends-arceus': ['hisui'],
  'scarlet-violet': ALL_REGIONS,
  'the-teal-mask': ALL_REGIONS,
  'the-indigo-disk': ALL_REGIONS,
  champions: ALL_REGIONS,
};

// Formas que não fazem sentido num time "de campanha".
const EXCLUDED_FORM_PATTERNS = ['-gmax', '-totem', '-mega', '-primal', '-eternamax'];

// A PokeAPI não marca Ultra Beasts nem Paradox como lendários, então a lista é mantida à mão.
const ULTRA_BEASTS = new Set([
  'nihilego', 'buzzwole', 'pheromosa', 'xurkitree', 'celesteela', 'kartana', 'guzzlord',
  'poipole', 'naganadel', 'stakataka', 'blacephalon',
]);
const PARADOX = new Set([
  'great-tusk', 'scream-tail', 'brute-bonnet', 'flutter-mane', 'slither-wing', 'sandy-shocks',
  'roaring-moon', 'walking-wake', 'gouging-fire', 'raging-bolt', 'iron-treads', 'iron-bundle',
  'iron-hands', 'iron-jugulis', 'iron-moth', 'iron-thorns', 'iron-valiant', 'iron-leaves',
  'iron-boulder', 'iron-crown',
]);
const subLegendaryOf = (speciesName) =>
  ULTRA_BEASTS.has(speciesName) ? 'ultra-beast' : PARADOX.has(speciesName) ? 'paradox' : null;

// Jogos sem learnset próprio na API usam o de outros jogos (o primeiro que tiver golpes).
// Para Legends: Z-A é uma aproximação (o jogo tem golpes próprios que a API ainda não cobre).
const RECENT_LEARNSETS = ['scarlet-violet', 'sword-shield', 'ultra-sun-ultra-moon', 'omega-ruby-alpha-sapphire'];
const LEARNSET_SOURCE = {
  'the-isle-of-armor': ['sword-shield'],
  'the-crown-tundra': ['sword-shield'],
  'the-teal-mask': ['scarlet-violet'],
  'the-indigo-disk': ['scarlet-violet'],
  'legends-za': RECENT_LEARNSETS,
  'mega-dimension': RECENT_LEARNSETS,
  champions: ['champions', ...RECENT_LEARNSETS],
};
// "train" é como Pokémon Champions ensina golpes.
const LEARN_METHODS = new Set(['level-up', 'machine', 'tutor', 'train']);

// Golpes de dano que não fazem sentido sugerir (recarga, autodestruição, condições especiais,
// tipo variável...). Golpes de poder variável (Low Kick, Return...) já vêm com power null.
const EXCLUDED_MOVES = new Set([
  'hyper-beam', 'giga-impact', 'blast-burn', 'hydro-cannon', 'frenzy-plant', 'rock-wrecker',
  'roar-of-time', 'prismatic-laser', 'eternabeam', 'meteor-assault', 'explosion', 'self-destruct',
  'misty-explosion', 'dream-eater', 'focus-punch', 'fake-out', 'first-impression', 'last-resort',
  'snore', 'belch', 'synchronoise', 'spit-up', 'natural-gift', 'fling', 'hidden-power',
  'future-sight', 'doom-desire', 'razor-wind', 'skull-bash', 'sky-attack', 'solar-beam',
  'solar-blade', 'meteor-beam', 'freeze-shock', 'ice-burn', 'steel-beam', 'mind-blown',
  'shadow-force', 'chloroblast', 'burn-up', 'double-shock', 'gigaton-hammer', 'blood-moon',
]);

// Antes da Gen 4 a categoria (físico/especial) dependia do tipo do golpe.
const SPECIAL_TYPES_PRE_GEN4 = new Set(['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark']);

const regionOf = (pokemonName) => ALL_REGIONS.find((r) => pokemonName.includes(`-${r}`));

const prettify = (slug) =>
  slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const englishName = (names) => names?.find((n) => n.language.name === 'en')?.name;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url) {
  const key = url.replace(`${API}/`, '').replace(/\/$/, '').replace(/[/?=&]/g, '_');
  const file = path.join(CACHE_DIR, `${key}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        await writeFile(file, JSON.stringify(data));
        return data;
      }
      if (res.status === 404) throw new Error(`404 em ${url}`);
      throw new Error(`HTTP ${res.status} em ${url}`);
    } catch (err) {
      if (attempt >= 4 || String(err.message).startsWith('404')) throw err;
      await sleep(1000 * attempt);
    }
  }
}

// Executa fn em paralelo, com no máximo `limit` requisições ao mesmo tempo.
async function mapLimit(items, limit, label, fn) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
      done++;
      if (done % 100 === 0 || done === items.length) {
        process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (items.length > 0) process.stdout.write('\n');
  return results;
}

function statsToMap(stats) {
  return Object.fromEntries(stats.map((s) => [s.stat.name, s.base_stat]));
}

// Na Gen 1 existia um único atributo "special" no lugar de sp. atk / sp. def.
function summarizeStats(map) {
  const base = { hp: map.hp, atk: map.attack, def: map.defense, spe: map.speed };
  if ('special' in map) {
    return {
      bst: map.hp + map.attack + map.defense + map.speed + map.special,
      ...base,
      spa: map.special,
      spd: map.special,
    };
  }
  return {
    bst: Object.values(map).reduce((total, value) => total + value, 0),
    ...base,
    spa: map['special-attack'],
    spd: map['special-defense'],
  };
}

// past_stats/past_types valem "até e incluindo" a geração indicada.
// Para a geração X, aplicamos todas as entradas com geração >= X, da mais nova para a mais antiga.
function pastStatsList(pokemon) {
  const current = statsToMap(pokemon.stats);
  const entries = (pokemon.past_stats ?? [])
    .map((entry) => ({ gen: genNumber(entry.generation.name), stats: statsToMap(entry.stats) }))
    .sort((a, b) => b.gen - a.gen);
  return entries.map(({ gen }) => {
    const merged = { ...current };
    for (const entry of entries) if (entry.gen >= gen) Object.assign(merged, entry.stats);
    return { gen, ...summarizeStats(merged) };
  });
}

// past_values de um golpe guardam os valores que valiam ANTES do version group indicado.
// Para um jogo, vale a entrada de menor ordem que ainda seja posterior ao jogo (campo a campo).
function moveForGame(move, gameOrder, gen, orderByVersionGroup) {
  const later = (move.past_values ?? [])
    .map((p) => ({ ...p, order: orderByVersionGroup[p.version_group.name] ?? 0 }))
    .filter((p) => p.order > gameOrder)
    .sort((a, b) => a.order - b.order);
  const pick = (field, current) => later.find((p) => p[field] != null)?.[field] ?? current;

  const power = pick('power', move.power);
  const accuracy = pick('accuracy', move.accuracy);
  const type = pick('type', move.type)?.name ?? move.type.name;
  if (!power || move.damage_class.name === 'status' || EXCLUDED_MOVES.has(move.name)) return null;
  if ((gen < 6 && type === 'fairy') || (gen < 2 && (type === 'dark' || type === 'steel'))) return null;

  const category = gen < 4 ? (SPECIAL_TYPES_PRE_GEN4.has(type) ? 'special' : 'physical') : move.damage_class.name;
  const { min_hits: minHits, max_hits: maxHits } = move.meta ?? {};
  // Golpes multi-hit: 2-5 acertos dão ~3 em média; número fixo usa o próprio valor.
  const hits = maxHits ? (minHits === maxHits ? maxHits : maxHits === 5 ? 3 : (minHits + maxHits) / 2) : 1;

  return [englishName(move.names) ?? prettify(move.name), type, power, accuracy, category, hits];
}

const typeNames = (types) => [...types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name);

// Habilidades como [nome, oculta?], na ordem dos slots. Em past_abilities, ability null = slot inexistente.
const abilitiesBySlot = (abilities) =>
  Object.fromEntries(abilities.map((a) => [a.slot, a.ability ? [a.ability.name, a.is_hidden] : null]));
const slotsToList = (bySlot) =>
  Object.keys(bySlot)
    .sort((a, b) => a - b)
    .map((slot) => bySlot[slot])
    .filter(Boolean);

// Mesma lógica de past_stats: para a geração X, aplica as entradas >= X da mais nova para a mais antiga.
function pastAbilitiesList(pokemon) {
  const current = abilitiesBySlot(pokemon.abilities);
  const entries = (pokemon.past_abilities ?? [])
    .map((entry) => ({ gen: genNumber(entry.generation.name), slots: abilitiesBySlot(entry.abilities) }))
    .sort((a, b) => b.gen - a.gen);
  return entries.map(({ gen }) => {
    const merged = { ...current };
    for (const entry of entries) if (entry.gen >= gen) Object.assign(merged, entry.slots);
    return { gen, abilities: slotsToList(merged) };
  });
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(OUT_FILE), { recursive: true });

  console.log('Baixando jogos (version groups)...');
  const vgList = await getJson(`${API}/version-group/?limit=100`);
  const versionGroups = await mapLimit(vgList.results, CONCURRENCY, 'jogos', (vg) => getJson(vg.url));
  const genByVersionGroup = Object.fromEntries(versionGroups.map((vg) => [vg.name, genNumber(vg.generation.name)]));

  console.log('Baixando pokédexes...');
  const dexUrls = [...new Set(versionGroups.flatMap((vg) => vg.pokedexes.map((d) => d.url)))];
  const dexes = await mapLimit(dexUrls, CONCURRENCY, 'pokédexes', (url) => getJson(url));
  const dexByName = Object.fromEntries(dexes.map((d) => [d.name, d]));

  const speciesUrls = [
    ...new Set(dexes.flatMap((d) => d.pokemon_entries.map((e) => e.pokemon_species.url))),
  ];
  console.log('Baixando espécies...');
  const speciesList = await mapLimit(speciesUrls, CONCURRENCY, 'espécies', (url) => getJson(url));

  console.log('Baixando pokémon e formas...');
  const varieties = speciesList.flatMap((species) =>
    species.varieties
      .filter((v) => !EXCLUDED_FORM_PATTERNS.some((p) => v.pokemon.name.includes(p)))
      .map((v) => ({ species, isDefault: v.is_default, url: v.pokemon.url })),
  );
  const loaded = await mapLimit(varieties, CONCURRENCY, 'pokémon', async (variety) => {
    const pokemon = await getJson(variety.url);
    // Só precisamos da "forma" das variedades alternativas (para nome e geração de introdução).
    const form = variety.isDefault ? null : await getJson(pokemon.forms[0].url);
    return { ...variety, pokemon, form };
  });

  const defaultBySpecies = new Map(
    loaded.filter((v) => v.isDefault).map((v) => [v.species.name, v.pokemon]),
  );

  const rawById = new Map(loaded.map((v) => [v.pokemon.id, v.pokemon]));

  const pokemon = [];
  for (const { species, isDefault, pokemon: p, form } of loaded) {
    const speciesName = englishName(species.names) ?? prettify(species.name);
    const stats = summarizeStats(statsToMap(p.stats));
    const { bst } = stats;
    const types = typeNames(p.types);

    if (!isDefault) {
      if (form.is_battle_only || form.is_mega) continue;
      // Formas puramente cosméticas (ex.: Pikachu com bonés) não mudam nada no time.
      const base = defaultBySpecies.get(species.name);
      if (base && summarizeStats(statsToMap(base.stats)).bst === bst && typeNames(base.types).join() === types.join()) {
        continue;
      }
    }

    let displayName = speciesName;
    if (!isDefault) {
      const formName = englishName(form.form_names) ?? prettify(form.form_name || p.name);
      displayName = formName.includes(speciesName) ? formName : `${speciesName} (${formName})`;
    }

    pokemon.push({
      id: p.id,
      name: p.name,
      displayName,
      speciesId: species.id,
      speciesName: species.name,
      types,
      pastTypes: (p.past_types ?? []).map((entry) => ({
        gen: genNumber(entry.generation.name),
        types: typeNames(entry.types),
      })),
      ...stats,
      pastStats: pastStatsList(p),
      abilities: slotsToList(abilitiesBySlot(p.abilities)),
      pastAbilities: pastAbilitiesList(p),
      legendary: species.is_legendary,
      mythical: species.is_mythical,
      subLegendary: subLegendaryOf(species.name),
      introGen: isDefault
        ? genNumber(species.generation.name)
        : genByVersionGroup[form.version_group?.name] ?? genNumber(species.generation.name),
      region: isDefault ? null : regionOf(p.name) ?? null,
      sprite: p.sprites.front_default ?? p.sprites.other?.['official-artwork']?.front_default ?? null,
    });
  }

  const pokemonBySpecies = new Map();
  for (const entry of pokemon) {
    if (!pokemonBySpecies.has(entry.speciesName)) pokemonBySpecies.set(entry.speciesName, []);
    pokemonBySpecies.get(entry.speciesName).push(entry);
  }

  const games = [];
  for (const vg of [...versionGroups].sort((a, b) => a.order - b.order)) {
    if (vg.pokedexes.length === 0) continue; // ex.: Colosseum e XD não têm dex na API
    const gen = genNumber(vg.generation.name);
    const allowedRegions = REGIONAL_FORMS[vg.name] ?? [];
    const speciesNames = new Set(
      vg.pokedexes.flatMap((d) => dexByName[d.name].pokemon_entries.map((e) => e.pokemon_species.name)),
    );
    const ids = [];
    for (const speciesName of speciesNames) {
      for (const entry of pokemonBySpecies.get(speciesName) ?? []) {
        if (entry.introGen > gen) continue;
        if (entry.region && !allowedRegions.includes(entry.region)) continue;
        ids.push(entry.id);
      }
    }
    ids.sort((a, b) => a - b);
    games.push({
      id: vg.name,
      label: GAME_LABELS[vg.name] ?? prettify(vg.name),
      gen,
      order: vg.order,
      approximateLearnsets: vg.name === 'legends-za' || vg.name === 'mega-dimension',
      pokemon: ids,
    });
  }

  // Learnsets: golpes de dano que cada pokémon aprende no jogo (level-up, TM/TR e tutor).
  const learnsetFor = (entry, versionGroups) => {
    const fromRaw = (raw, versionGroup) =>
      (raw?.moves ?? [])
        .filter((m) =>
          m.version_group_details.some(
            (d) => d.version_group.name === versionGroup && LEARN_METHODS.has(d.move_learn_method.name),
          ),
        )
        .map((m) => m.move.url);
    for (const versionGroup of versionGroups) {
      // Formas alternativas às vezes vêm sem golpes na API: usa os da forma padrão.
      const urls = fromRaw(rawById.get(entry.id), versionGroup);
      if (urls.length > 0) return urls;
      const fallback = fromRaw(defaultBySpecies.get(entry.speciesName), versionGroup);
      if (fallback.length > 0) return fallback;
    }
    return [];
  };

  const pokemonById = new Map(pokemon.map((p) => [p.id, p]));
  const learnsetUrls = new Map(); // gameId -> Map<pokemonId, moveUrl[]>
  for (const game of games) {
    const source = LEARNSET_SOURCE[game.id] ?? [game.id];
    learnsetUrls.set(
      game.id,
      new Map(game.pokemon.map((id) => [id, learnsetFor(pokemonById.get(id), source)])),
    );
  }

  const moveUrls = [...new Set([...learnsetUrls.values()].flatMap((m) => [...m.values()].flat()))];
  console.log('Baixando golpes...');
  const moves = await mapLimit(moveUrls, CONCURRENCY, 'golpes', (url) => getJson(url));
  const moveByUrl = new Map(moveUrls.map((url, i) => [url, moves[i]]));
  const orderByVersionGroup = Object.fromEntries(versionGroups.map((vg) => [vg.name, vg.order]));

  // Um arquivo por jogo, carregado só quando o jogo é escolhido na interface.
  await mkdir(GAMES_DIR, { recursive: true });
  for (const game of games) {
    const gameMoves = {};
    const learnsets = {};
    for (const [pokemonId, urls] of learnsetUrls.get(game.id)) {
      const ids = [];
      for (const url of urls) {
        const move = moveByUrl.get(url);
        if (!(move.id in gameMoves)) gameMoves[move.id] = moveForGame(move, game.order, game.gen, orderByVersionGroup);
        if (gameMoves[move.id]) ids.push(move.id);
      }
      learnsets[pokemonId] = ids;
    }
    for (const id of Object.keys(gameMoves)) if (!gameMoves[id]) delete gameMoves[id];
    await writeFile(path.join(GAMES_DIR, `${game.id}.json`), JSON.stringify({ moves: gameMoves, learnsets }));
  }

  // Habilidades: nome em inglês, descrição curta e geração de introdução.
  const abilityUrls = [
    ...new Set(
      loaded.flatMap(({ pokemon: p }) => [
        ...p.abilities.map((a) => a.ability.url),
        ...(p.past_abilities ?? []).flatMap((e) => e.abilities.filter((a) => a.ability).map((a) => a.ability.url)),
      ]),
    ),
  ];
  console.log('Baixando habilidades...');
  const abilityList = await mapLimit(abilityUrls, CONCURRENCY, 'habilidades', (url) => getJson(url));
  const abilities = Object.fromEntries(
    abilityList.map((a) => {
      const effect =
        a.effect_entries.find((e) => e.language.name === 'en')?.short_effect ??
        a.flavor_text_entries.filter((e) => e.language.name === 'en').at(-1)?.flavor_text ??
        '';
      return [a.name, [englishName(a.names) ?? prettify(a.name), effect.replace(/\s+/g, ' '), genNumber(a.generation.name)]];
    }),
  );

  const out = { generatedAt: new Date().toISOString(), games, pokemon, abilities };
  await writeFile(OUT_FILE, JSON.stringify(out));
  console.log(
    `Pronto: ${games.length} jogos, ${pokemon.length} pokémon, ${moves.length} golpes, ${abilityList.length} habilidades -> public/data`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
