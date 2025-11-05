// src/lib/interestThemes.js
/*
 * Helpers for turning learner interests into themed counting visuals.
 * Supports deterministic procedural themes when AI isn't available.
 */

const FALLBACK_THEME_PRESETS = [
  // ... (presets remain the same)
];

const UNIVERSAL_EMOJI_POOL = [
  // ... (emojis remain the same)
];

const ADDITIONAL_ICON_CATALOG = [
  // ... (catalog remains the same)
];

const normalizedPresetCache = new Map();

function slugify(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleCase(value = '') {
  return value.split(/\s|-/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function stringHash(value = '') {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
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
  const shadow = swatch.shadow || swatch.boxShadow || `0 10px 22px hsla(${fallbackHue}, 70%, 45%, 0.18)`;
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
  const preset = FALLBACK_THEME_PRESETS.find((entry) => entry.matchers.some((matcher) => normalized.includes(matcher)));
  if (preset) return preset.icons;
  const catalogHit = ADDITIONAL_ICON_CATALOG.find((entry) => entry.matchers.some((matcher) => normalized.includes(matcher)));
  if (catalogHit) return catalogHit.icons;
  const hash = stringHash(normalized || 'interest');
  const icons = [];
  for (let i = 0; i < 5; i += 1) {
    icons.push(UNIVERSAL_EMOJI_POOL[(hash + i * 7) % UNIVERSAL_EMOJI_POOL.length]);
  }
  return icons;
}

function normalizeInterestTheme(theme = {}, { defaultKey = null, origin = null } = {}) {
  if (!theme || typeof theme !== 'object') return null;
  const keyRaw = theme.key || defaultKey || slugify(theme.label || theme.theme || 'interest-theme');
  const key = keyRaw || null;
  if (!key) return null;

  const label = theme.label || titleCase(key.replace(/[-_]/g, ' '));
  const rawMatchers = [...(ensureArray(theme.matchers)), ...(ensureArray(theme.keywords)), key, label, theme.theme || ''];
  const matchers = Array.from(new Set(rawMatchers.map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : '')).filter(Boolean)));
  const iconCandidates = [...(ensureArray(theme.icons)), ...(theme.icon ? [theme.icon] : [])].map((icon) => (typeof icon === 'string' ? icon.trim() : '')).filter(Boolean);
  const icons = iconCandidates.length ? iconCandidates.slice(0, 8) : ['⭐'];

  let swatches = Array.isArray(theme.swatches) ? theme.swatches : null;
  if (!swatches || !swatches.length) {
    const presetSwatches = choosePaletteForMatchers(matchers);
    swatches = presetSwatches || createProceduralSwatches(key, theme.palette || theme.paletteHint);
  }
  const normalizedSwatches = swatches.map((swatch, index) => normalizeSwatch(swatch, (stringHash(key) + index * 37) % 360));
  const searchTokens = Array.from(new Set([...matchers, key.toLowerCase(), label.toLowerCase(), ...(theme.tags || [])].map((token) => (typeof token === 'string' ? token.trim().toLowerCase() : '')).filter(Boolean)));

  return { key, label, matchers, icons, swatches: normalizedSwatches, source: theme.source || origin || 'procedural', searchTokens };
}

const NORMALIZED_FALLBACK_PRESETS = FALLBACK_THEME_PRESETS.map((preset) => {
  if (!normalizedPresetCache.has(preset.key)) {
    normalizedPresetCache.set(preset.key, normalizeInterestTheme(preset, { origin: preset.source }));
  }
  return normalizedPresetCache.get(preset.key);
});

function themeMatchesTerm(theme, term) {
  if (!theme || !term) return false;
  const lower = term.toLowerCase();
  return theme.searchTokens?.some((token) => lower.includes(token)) ?? false;
}

function createProceduralInterestTheme(interest = '') {
  const slug = slugify(interest) || `interest-${Math.random().toString(36).slice(2)}`;
  const label = `${titleCase(interest || slug)} Adventure`;
  const matchers = Array.from(new Set([slug, ...(interest.split(/\\s|-/).map((part) => part.trim().toLowerCase()).filter(Boolean))]));
  const icons = chooseIconsForInterest(interest);
  const swatches = createProceduralSwatches(slug);
  return { key: `interest-${slug}`, label, matchers, icons, swatches, source: 'fallback-procedural' };
}

export function sanitizeInterestThemes(themes = []) {
  if (!Array.isArray(themes)) return [];
  const sanitized = [];
  const seen = new Set();
  themes.forEach((theme) => {
    const normalized = normalizeInterestTheme(theme);
    if (normalized && !seen.has(normalized.key)) {
      sanitized.push(normalized);
      seen.add(normalized.key);
    }
  });
  return sanitized;
}

export function buildInterestThemes(interests = [], { baseThemes = [] } = {}) {
  const sanitized = sanitizeInterestThemes(baseThemes);
  const seen = new Set(sanitized.map((theme) => theme.key));
  const interestList = (Array.isArray(interests) ? interests : []).map((interest) => (typeof interest === 'string' ? interest.trim() : '')).filter(Boolean);

  interestList.forEach((interest) => {
    const lower = interest.toLowerCase();
    const alreadyCovered = sanitized.some((theme) => themeMatchesTerm(theme, lower));
    if (alreadyCovered) return;

    const presetHit = NORMALIZED_FALLBACK_PRESETS.find((theme) => themeMatchesTerm(theme, lower));
    const theme = presetHit || createProceduralInterestTheme(interest);
    if (theme && !seen.has(theme.key)) {
      const normalized = normalizeInterestTheme(theme, { origin: theme.source });
      if (normalized) {
        sanitized.push(normalized);
        seen.add(normalized.key);
      }
    }
  });

  return sanitized;
}

export function resolveInterestTheme({ interests = [], themes = [] } = {}) {
  const sanitizedThemes = sanitizeInterestThemes(themes);
  const interestTokens = (interests || []).map((interest) => (typeof interest === 'string' ? interest.toLowerCase() : '')).filter(Boolean);
  const candidates = [...sanitizedThemes, ...NORMALIZED_FALLBACK_PRESETS];
  const directMatch = candidates.find((theme) => interestTokens.some((token) => themeMatchesTerm(theme, token)));
  if (directMatch) return directMatch;
  if (sanitizedThemes.length) return sanitizedThemes[0];
  return NORMALIZED_FALLBACK_PRESETS[0] || null;
}
