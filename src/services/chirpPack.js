const DEFAULT_ENDPOINT = '/api/chirp-pack/run';

const normalizeOptions = (input) => {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const options = {};
  if (typeof input.force === 'boolean') {
    options.force = input.force;
  }
  if (typeof input.dryRun === 'boolean') {
    options.dryRun = input.dryRun;
  }
  if (typeof input.verbose === 'boolean') {
    options.verbose = input.verbose;
  }
  if (typeof input.outDir === 'string' && input.outDir.trim()) {
    options.outDir = input.outDir.trim();
  }
  if (typeof input.summary === 'string' && input.summary.trim()) {
    options.summary = input.summary.trim();
  }
  if (typeof input.concurrency === 'number' && Number.isFinite(input.concurrency)) {
    options.concurrency = Math.max(1, Math.floor(input.concurrency));
  }
  if (typeof input.voice === 'string' && input.voice.trim()) {
    options.voice = input.voice.trim();
  }
  if (typeof input.language === 'string' && input.language.trim()) {
    options.language = input.language.trim();
  }
  if (typeof input.encoding === 'string' && input.encoding.trim()) {
    options.encoding = input.encoding.trim();
  }
  if (typeof input.sampleRateHertz === 'number' && Number.isFinite(input.sampleRateHertz)) {
    options.sampleRateHertz = Math.max(0, Math.floor(input.sampleRateHertz));
  }
  return options;
};

const parseJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
};

const buildErrorMessage = (status, payload, rawText) => {
  if (payload) {
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
  }
  if (status === 404) {
    return 'Serviciul chirp-pack nu este disponibil. Asigură-te că aplicația rulează local și include noul endpoint.';
  }
  if (status === 405) {
    return 'Metodă HTTP neacceptată pentru serviciul chirp-pack.';
  }
  if (status === 409) {
    return 'Scriptul chirp-pack rulează deja. Așteaptă finalizarea lui înainte de o nouă execuție.';
  }
  if (rawText && rawText.trim()) {
    return rawText.trim();
  }
  return `Cererea chirp-pack a eșuat (HTTP ${status}).`;
};

export async function runChirpPack({ manifest, manifestFileName, options } = {}) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifestul Chirp 3 este invalid sau lipsă.');
  }
  if (!Array.isArray(manifest.prompts)) {
    throw new Error('Manifestul Chirp 3 nu conține câmpul "prompts".');
  }

  const payload = {
    manifest,
    manifestFileName: typeof manifestFileName === 'string' && manifestFileName.trim()
      ? manifestFileName.trim()
      : null,
    options: normalizeOptions(options),
  };

  try {
    const response = await fetch(DEFAULT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    const data = parseJson(rawText);

    if (!response.ok || !data || data.success !== true) {
      const message = buildErrorMessage(response.status, data, rawText);
      throw new Error(message);
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Nu am putut contacta serviciul chirp-pack.');
  }
}
