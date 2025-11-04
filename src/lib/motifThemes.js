/*
 * Helpers for turning learner interests or AI motif packs into themed counting visuals.
 * Supports remote Gemini responses, on-device Gemini Nano ("banana") fallbacks,
 * and deterministic procedural themes when AI isn't available.
 */

const FALLBACK_THEME_PRESETS = [
  {
    key: 'fire-rescue',
    label: 'Firefighter Mission',
    matchers: ['fire', 'firefighter', 'fireman', 'rescue', 'ladder', 'ember', 'engine'],
    icons: ['🚒', '🧯', '🔥', '🚨', '🪓'],
    swatches: [
      { bg: '#fef2f2', border: '#f97316', text: '#9a3412', shadow: '0 10px 22px rgba(249,115,22,0.18)' },
      { bg: '#fee2e2', border: '#f87171', text: '#b91c1c', shadow: '0 8px 18px rgba(239,68,68,0.18)' },
      { bg: '#fff7ed', border: '#fb923c', text: '#c2410c', shadow: '0 8px 18px rgba(251,146,60,0.18)' },
    ],
    source: 'fallback-preset',
  },
  {
    key: 'dinosaur-discovery',
    label: 'Dinosaur Discovery',
    matchers: ['dino', 'dinosaur', 'jurassic', 'raptor', 'prehistoric'],
    icons: ['🦕', '🦖', '🥚', '🌿', '🌋'],
    swatches: [
      { bg: '#dcfce7', border: '#22c55e', text: '#166534', shadow: '0 10px 22px rgba(34,197,94,0.18)' },
      { bg: '#f0fdf4', border: '#4ade80', text: '#047857', shadow: '0 8px 18px rgba(74,222,128,0.18)' },
      { bg: '#fefce8', border: '#facc15', text: '#ca8a04', shadow: '0 8px 18px rgba(250,204,21,0.18)' },
    ],
    source: 'fallback-preset',
  },
  {
    key: 'space-adventure',
    label: 'Space Adventure',
    matchers: ['space', 'galaxy', 'rocket', 'astronaut', 'planet', 'star'],
    icons: ['🚀', '🪐', '⭐', '👩‍🚀', '🌌'],
    swatches: [
      { bg: '#eef2ff', border: '#6366f1', text: '#312e81', shadow: '0 12px 24px rgba(99,102,241,0.2)' },
      { bg: '#e0f2fe', border: '#0ea5e9', text: '#075985', shadow: '0 10px 20px rgba(14,165,233,0.2)' },
      { bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6', shadow: '0 10px 20px rgba(139,92,246,0.2)' },
    ],
    source: 'fallback-preset',
  },
  {
    key: 'ocean-exploration',
    label: 'Ocean Expedition',
    matchers: ['ocean', 'sea', 'dolphin', 'shark', 'marine', 'mermaid', 'aquatic'],
    icons: ['🐬', '🐠', '🦈', '🐳', '🌊'],
    swatches: [
      { bg: '#dbeafe', border: '#38bdf8', text: '#0c4a6e', shadow: '0 10px 22px rgba(59,130,246,0.2)' },
      { bg: '#cffafe', border: '#06b6d4', text: '#0f766e', shadow: '0 8px 18px rgba(6,182,212,0.2)' },
      { bg: '#ecfeff', border: '#22d3ee', text: '#0e7490', shadow: '0 8px 18px rgba(34,211,238,0.2)' },
    ],
    source: 'fallback-preset',
  },
  {
    key: 'sweet-bakery',
    label: 'Baking Bonanza',
    matchers: ['bake', 'bakery', 'cake', 'cookie', 'dessert', 'sweet', 'cupcake'],
    icons: ['🧁', '🍪', '🍰', '🍩', '🥧'],
    swatches: [
      { bg: '#fdf2f8', border: '#ec4899', text: '#9d174d', shadow: '0 10px 22px rgba(236,72,153,0.18)' },
      { bg: '#fce7f3', border: '#f472b6', text: '#be185d', shadow: '0 8px 18px rgba(244,114,182,0.18)' },
      { bg: '#fff7ed', border: '#f97316', text: '#c2410c', shadow: '0 8px 18px rgba(249,115,22,0.18)' },
    ],
    source: 'fallback-preset',
  },
  {
    key: 'building-crew',
    label: 'Builder Crew',
    matchers: ['truck', 'construction', 'builder', 'engineer', 'machine', 'vehicle', 'bulldozer'],
    icons: ['🚜', '🏗️', '🚧', '🔧', '🛠️'],
    swatches: [
      { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', shadow: '0 10px 22px rgba(245,158,11,0.18)' },
      { bg: '#fffbeb', border: '#eab308', text: '#854d0e', shadow: '0 8px 18px rgba(234,179,8,0.18)' },
      { bg: '#fef9c3', border: '#facc15', text: '#ca8a04', shadow: '0 8px 18px rgba(250,204,21,0.18)' },
    ],
    source: 'fallback-preset',
  },
];

const UNIVERSAL_EMOJI_POOL = [
  '⭐', '🌈', '🎈', '⚡', '🎯', '🎲', '🧠', '🌟', '🎉', '🧩', '🚀', '🌻', '🐾', '🍀', '🍎', '🎵', '🏀', '🛸',
  '🪴', '🎨', '🛷', '🧸', '🧪', '🎻', '🪄', '🎤', '🎮', '🎳', '🎺', '🥽', '📚', '🪁', '🎠', '🛶', '🎢', '🐉', '🧜',
];

const ADDITIONAL_ICON_CATALOG = [
  { matchers: ['soccer', 'football'], icons: ['⚽', '🥅', '🏟️', '🎽', '🏆'], palette: { hue: 120 } },
  { matchers: ['basketball'], icons: ['🏀', '⛹️', '🎽', '🥇', '🏆'], palette: { hue: 28 } },
  { matchers: ['music', 'song', 'sing', 'piano', 'guitar', 'violin', 'drum'], icons: ['🎵', '🎸', '🎹', '🥁', '🎤'], palette: { hue: 280 } },
  { matchers: ['animal', 'zoo', 'pet', 'cat', 'dog', 'horse', 'lion', 'tiger', 'bear'], icons: ['🐱', '🐶', '🦁', '🐯', '🐻'], palette: { hue: 30 } },
  { matchers: ['princess', 'fairy', 'magic', 'wizard'], icons: ['🧚', '👑', '🪄', '🌟', '🦄'], palette: { hue: 315 } },
  { matchers: ['robot', 'coding', 'tech', 'computer'], icons: ['🤖', '🖥️', '💡', '⚙️', '🔌'], palette: { hue: 200 } },
  { matchers: ['garden', 'flower', 'nature', 'butterfly'], icons: ['🌸', '🌼', '🦋', '🌿', '🌷'], palette: { hue: 100 } },
  { matchers: ['vehicle', 'car', 'race', 'speed'], icons: ['🏎️', '🚗', '🚙', '🛞', '⛽'], palette: { hue: 12 } },
  { matchers: ['ninja', 'samurai', 'martial'], icons: ['🥷', '⚔️', '🎴', '🏯', '🌀'], palette: { hue: 260 } },
];

const normalizedPresetCache = new Map();

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCase(value = '') {
  return value
    .split(/\s|-/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stringHash(value = '') {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function normalizeSwatch(swatch = {}, fallbackHue = 220) {
  const bg = swatch.bg || swatch.background || `hsl(${fallbackHue}, 95%, 92%)`;
  const border = swatch.border || swatch.borderColor || `hsl(${fallbackHue}, 70%, 58%)`;
  const text = swatch.text || swatch.textColor || `hsl(${fallbackHue}, 65%, 24%)`;
  const shadow =
    swatch.shadow || swatch.boxShadow || `0 10px 22px hsla(${fallbackHue}, 70%, 45%, 0.18)`;
  return { bg, border, text, shadow };
}

function choosePaletteForMatchers(matchers = []) {
  const allMatchers = (matchers || []).map((m) => (typeof m === 'string' ? m.toLowerCase() : ''));
  for (const preset of FALLBACK_THEME_PRESETS) {
    if (preset.matchers.some((matcher) => allMatchers.includes(matcher))) {
      return preset.swatches;
    }
  }
  for (const catalog of ADDITIONAL_ICON_CATALOG) {
    if (catalog.matchers.some((matcher) => allMatchers.includes(matcher))) {
      const hue = catalog.palette?.hue ?? 220;
      return [0, 12, 24].map((offset) => normalizeSwatch({}, (hue + offset) % 360));
    }
  }
  return null;
}

function createProceduralSwatches(seed = 'interest', paletteHint) {
  if (paletteHint && Array.isArray(paletteHint)) {
    return paletteHint.map((swatch, index) => normalizeSwatch(swatch, (index * 42) % 360));
  }
  const baseHash = stringHash(seed);
  return [0, 1, 2].map((index) => {
    const hue = (baseHash + index * 57) % 360;
    return normalizeSwatch({}, hue);
  });
}

function chooseIconsForInterest(interest = '') {
  const normalized = interest.toLowerCase();
  const preset = FALLBACK_THEME_PRESETS.find((entry) =>
    entry.matchers.some((matcher) => normalized.includes(matcher)),
  );
  if (preset) {
    return preset.icons;
  }
  const catalogHit = ADDITIONAL_ICON_CATALOG.find((entry) =>
    entry.matchers.some((matcher) => normalized.includes(matcher)),
  );
  if (catalogHit) {
    return catalogHit.icons;
  }
  const hash = stringHash(normalized || 'interest');
  const icons = [];
  for (let i = 0; i < 5; i += 1) {
    icons.push(UNIVERSAL_EMOJI_POOL[(hash + i * 7) % UNIVERSAL_EMOJI_POOL.length]);
  }
  return icons;
}

function normalizeThemePack(pack = {}, { defaultKey = null, origin = null } = {}) {
  if (!pack || typeof pack !== 'object') return null;
  const keyRaw = pack.key || defaultKey || slugify(pack.label || pack.theme || 'motif');
  const key = keyRaw || null;
  if (!key) return null;

  const label = pack.label || titleCase(key.replace(/[-_]/g, ' '));
  const rawMatchers = [
    ...(ensureArray(pack.matchers)),
    ...(ensureArray(pack.keywords)),
    key,
    label,
    pack.theme || '',
  ];
  const matchers = Array.from(
    new Set(
      rawMatchers
        .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
        .filter(Boolean),
    ),
  );

  const iconCandidates = [
    ...(ensureArray(pack.icons)),
    ...(pack.icon ? [pack.icon] : []),
  ]
    .map((icon) => (typeof icon === 'string' ? icon.trim() : ''))
    .filter(Boolean);
  const icons = iconCandidates.length ? iconCandidates.slice(0, 8) : ['⭐'];

  let swatches = Array.isArray(pack.swatches) ? pack.swatches : null;
  if (!swatches || !swatches.length) {
    const presetSwatches = choosePaletteForMatchers(matchers);
    swatches = presetSwatches || createProceduralSwatches(key, pack.palette || pack.paletteHint);
  }
  const normalizedSwatches = swatches.map((swatch, index) =>
    normalizeSwatch(swatch, (stringHash(key) + index * 37) % 360),
  );

  const searchTokens = Array.from(
    new Set([
      ...matchers,
      key.toLowerCase(),
      label.toLowerCase(),
      ...(pack.tags || []),
    ]
      .map((token) => (typeof token === 'string' ? token.trim().toLowerCase() : ''))
      .filter(Boolean)),
  );

  return {
    key,
    label,
    matchers,
    icons,
    swatches: normalizedSwatches,
    source: pack.source || origin || 'ai',
    searchTokens,
  };
}

const NORMALIZED_FALLBACK_PRESETS = FALLBACK_THEME_PRESETS.map((preset) => {
  if (!normalizedPresetCache.has(preset.key)) {
    normalizedPresetCache.set(preset.key, normalizeThemePack(preset, { origin: preset.source }));
  }
  return normalizedPresetCache.get(preset.key);
});

function packMatchesTerm(pack, term) {
  if (!pack || !term) return false;
  const lower = term.toLowerCase();
  return pack.searchTokens?.some((token) => lower.includes(token)) ?? false;
}

function createProceduralThemePack(interest = '') {
  const slug = slugify(interest) || `interest-${Math.random().toString(36).slice(2)}`;
  const label = `${titleCase(interest || slug)} Adventure`;
  const matchers = Array.from(
    new Set([
      slug,
      ...(interest
        .split(/\s|-/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)),
    ]),
  );
  const icons = chooseIconsForInterest(interest);
  const swatches = createProceduralSwatches(slug);
  return {
    key: `interest-${slug}`,
    label,
    matchers,
    icons,
    swatches,
    source: 'fallback-procedural',
  };
}

export function sanitizeThemePacks(themePacks = []) {
  if (!Array.isArray(themePacks)) return [];
  const sanitized = [];
  const seen = new Set();
  themePacks.forEach((pack) => {
    const normalized = normalizeThemePack(pack);
    if (normalized && !seen.has(normalized.key)) {
      sanitized.push(normalized);
      seen.add(normalized.key);
    }
  });
  return sanitized;
}

export function buildThemePacksForInterests(interests = [], { basePacks = [], motifHints = [] } = {}) {
  const sanitized = sanitizeThemePacks(basePacks);
  const seen = new Set(sanitized.map((pack) => pack.key));

  const motifList = (Array.isArray(motifHints) ? motifHints : [])
    .map((motif) => (typeof motif === 'string' ? motif.trim() : ''))
    .filter(Boolean);

  motifList.forEach((motif) => {
    const lower = motif.toLowerCase();
    const alreadyCovered = sanitized.some((pack) => packMatchesTerm(pack, lower));
    if (alreadyCovered) return;
    const presetHit = NORMALIZED_FALLBACK_PRESETS.find((pack) => packMatchesTerm(pack, lower));
    const pack = presetHit || createProceduralThemePack(motif);
    if (pack && !seen.has(pack.key)) {
      const normalized = normalizeThemePack(pack, { origin: pack.source });
      if (normalized) {
        sanitized.push(normalized);
        seen.add(normalized.key);
      }
    }
  });

  const interestList = (Array.isArray(interests) ? interests : [])
    .map((interest) => (typeof interest === 'string' ? interest.trim() : ''))
    .filter(Boolean);

  interestList.forEach((interest) => {
    const lower = interest.toLowerCase();
    const alreadyCovered = sanitized.some((pack) => packMatchesTerm(pack, lower));
    if (alreadyCovered) {
      return;
    }

    const presetHit = NORMALIZED_FALLBACK_PRESETS.find((pack) => packMatchesTerm(pack, lower));
    const pack = presetHit || createProceduralThemePack(interest);
    if (pack && !seen.has(pack.key)) {
      const normalized = normalizeThemePack(pack, { origin: pack.source });
      if (normalized) {
        sanitized.push(normalized);
        seen.add(normalized.key);
      }
    }
  });

  return sanitized;
}

export function resolveMotifTheme({ motifHints = [], themePacks = [] } = {}) {
  const sanitizedThemePacks = sanitizeThemePacks(themePacks);
  const motifTokens = (motifHints || [])
    .map((motif) => (typeof motif === 'string' ? motif.toLowerCase() : ''))
    .filter(Boolean);

  const candidates = [...sanitizedThemePacks, ...NORMALIZED_FALLBACK_PRESETS];
  const directMatch = candidates.find((pack) => motifTokens.some((token) => packMatchesTerm(pack, token)));
  if (directMatch) return directMatch;
  if (sanitizedThemePacks.length) return sanitizedThemePacks[0];
  return NORMALIZED_FALLBACK_PRESETS[0] || null;
}

function stripCodeFence(payload = '') {
  if (typeof payload !== 'string') return '';
  const trimmed = payload.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  return trimmed;
}

function parsePacksFromAiResponse(responseText = '') {
  const cleaned = stripCodeFence(responseText);
  if (!cleaned) return [];
  const tryParse = (text) => {
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  };

  let parsed = tryParse(cleaned);
  if (!parsed) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      parsed = tryParse(jsonMatch[0]);
    }
  }

  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.packs)) return parsed.packs;
  if (Array.isArray(parsed.themePacks)) return parsed.themePacks;
  if (Array.isArray(parsed.motifPacks)) return parsed.motifPacks;
  return [];
}

export async function maybeGenerateOnDeviceThemePacks(interests = []) {
  if (typeof window === 'undefined') return [];
  const ai = window.ai;
  if (!ai?.assistant?.create || !Array.isArray(interests) || !interests.length) {
    return [];
  }

  let session;
  try {
    session = await ai.assistant.create({ model: 'gemini-nano-banana' });
    const prompt =
      'Generate JSON {"packs": [ {"key": string, "label": string, "matchers": string[], "icons": string[], "swatches": [{"bg": string, "border": string, "text": string, "shadow": string}]} ] } for kid counting app. Interests: ' +
      JSON.stringify(interests.slice(0, 6));
    const result = await session.prompt(prompt);
    const text = typeof result === 'string' ? result : result?.output || result?.text || '';
    const packs = parsePacksFromAiResponse(text);
    return sanitizeThemePacks(
      packs.map((pack) => ({
        ...pack,
        source: pack.source || 'gemini-nano-banana',
      })),
    );
  } catch (error) {
    console.warn('Gemini Nano theme pack generation failed', error);
    return [];
  } finally {
    try {
      await session?.destroy?.();
    } catch (error) {
      // ignore
    }
  }
}

export { FALLBACK_THEME_PRESETS };

