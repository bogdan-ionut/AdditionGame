const BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
const LOCAL_SFX_BASE_PATH = `${BASE_URL}/assets/sfx/default`;

const successUrl = `${LOCAL_SFX_BASE_PATH}/success.mp3`;
const encourageUrl = `${LOCAL_SFX_BASE_PATH}/encourage.mp3`;
const levelUpUrl = `${LOCAL_SFX_BASE_PATH}/levelup.mp3`;
const streakUrl = `${LOCAL_SFX_BASE_PATH}/streak.mp3`;

type LocalClip = {
  url: string;
  label: string;
  tags?: string[];
};

type LocalManifest = Record<string, LocalClip>;

type LocalPacks = Record<string, { label: string; manifest: LocalManifest }>;

const LOCAL_PACKS: LocalPacks = {
  default: {
    label: 'Local fallback',
    manifest: {
      success: { url: successUrl, label: 'Success chime', tags: ['victory'] },
      encourage: { url: encourageUrl, label: 'Encouragement chime', tags: ['friendly'] },
      levelup: { url: levelUpUrl, label: 'Level up fanfare', tags: ['progress'] },
      streak: { url: streakUrl, label: 'Streak sparkle', tags: ['progress'] },
    },
  },
  'low-stim': {
    label: 'Local low-stim',
    manifest: {
      success: { url: successUrl, label: 'Soft success chime', tags: ['victory', 'low-stim'] },
      encourage: { url: encourageUrl, label: 'Soft encouragement', tags: ['friendly', 'low-stim'] },
      levelup: { url: levelUpUrl, label: 'Soft level up', tags: ['progress', 'low-stim'] },
      streak: { url: streakUrl, label: 'Soft streak sparkle', tags: ['progress', 'low-stim'] },
    },
  },
};

function normalizePack(pack?: string) {
  if (!pack) return 'default';
  const normalized = pack.toLowerCase();
  if (LOCAL_PACKS[normalized]) return normalized;
  return 'default';
}

function normalizeCategory(category?: string) {
  if (!category) return 'success';
  const normalized = category.toLowerCase();
  return normalized;
}

export function getLocalSfxCatalog(pack?: string) {
  const selectedPack = LOCAL_PACKS[normalizePack(pack)];
  if (!selectedPack) return null;
  const categories: Record<string, Array<{ id: string; label: string; url: string; mimeType: string; tags?: string[] }>> = {};
  Object.entries(selectedPack.manifest).forEach(([category, clip]) => {
    categories[category] = [
      {
        id: `local-${normalizePack(pack)}-${category}`,
        label: clip.label,
        url: clip.url,
        mimeType: 'audio/mpeg',
        tags: clip.tags,
      },
    ];
  });
  return {
    packs: [
      {
        id: `local-${normalizePack(pack)}`,
        label: selectedPack.label,
        description: 'Offline sound effects pack',
        categories,
        default: true,
      },
    ],
    defaultPackId: `local-${normalizePack(pack)}`,
  };
}

export function getLocalSfxClip(category?: string, pack?: string) {
  const normalizedPack = normalizePack(pack);
  const normalizedCategory = normalizeCategory(category);
  const selectedPack = LOCAL_PACKS[normalizedPack];
  if (!selectedPack) return null;
  const clip = selectedPack.manifest[normalizedCategory] || selectedPack.manifest.success;
  if (!clip) return null;
  return {
    buffer: null as ArrayBuffer | null,
    mimeType: 'audio/mpeg',
    url: clip.url,
  };
}

export function listLocalSfxPacks() {
  return Object.keys(LOCAL_PACKS).map((pack) => getLocalSfxCatalog(pack));
}
