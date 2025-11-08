import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number.parseInt(process.env.PORT ?? '8000', 10);
const allowedOriginsEnv = (process.env.CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
const allowedOrigins = allowedOriginsEnv.length ? allowedOriginsEnv : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
    },
  }),
);
app.use(express.json({ limit: '2mb' }));

const GEMINI_MODELS = {
  planning: 'gemini-2.5-pro',
  sprite: 'gemini-2.5-flash-image',
  audio: 'gemini-2.5-pro-preview-tts',
};

const TTS_MODELS = ['gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts'];

const TTS_VOICES = [
  {
    id: 'ally-child-en',
    label: 'Ally',
    language: 'en-US',
    gender: 'female',
    tags: ['child', 'friendly', 'warm'],
    previewText: 'Hi there! Ready for some amazing math adventures?',
  },
  {
    id: 'matei-child-ro',
    label: 'Matei',
    language: 'ro-RO',
    gender: 'male',
    tags: ['child', 'energetic'],
    previewText: 'Salut! E timpul pentru puțină magie cu adunări.',
  },
];

const SUCCESS_CHIME =
  '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';

let savedGeminiKey = null;
const recordedAttempts = [];
const spriteJobs = new Map();

const ensurePlanItems = () => [
  {
    id: 'warmup-addition',
    kind: 'warmup',
    title: 'Warm-up within 5',
    description: 'Quick review of addition within five using number lines.',
    focus: 'addition-within-5',
    durationMinutes: 5,
  },
  {
    id: 'core-lesson',
    kind: 'lesson',
    title: 'Adding within 10',
    description: 'Story problems that use friendly numbers and visual supports.',
    focus: 'addition-within-10',
    durationMinutes: 10,
  },
  {
    id: 'celebration',
    kind: 'celebration',
    title: 'Victory dance break',
    description: 'Short celebration with audio cues to reinforce effort.',
    focus: 'break',
    durationMinutes: 2,
  },
];

const buildRuntimePayload = () => {
  const serverHasKey = Boolean(savedGeminiKey);
  return {
    ai_enabled: serverHasKey,
    server_has_key: serverHasKey,
    config: {
      planning_model: GEMINI_MODELS.planning,
      sprite_model: GEMINI_MODELS.sprite,
      audio_model: GEMINI_MODELS.audio,
      ai_allowed: serverHasKey,
    },
    default_tts_model: GEMINI_MODELS.audio,
    allowed_tts_models: TTS_MODELS,
    runtime_label: 'local-dev',
  };
};

const ok = (res, payload = {}) => {
  res.json({ ok: true, ...payload });
};

app.get('/health', (req, res) => {
  ok(res, { status: 'ok', time: new Date().toISOString() });
});

app.get('/v1/status', (req, res) => {
  ok(res, { service: 'math-galaxy-api', time: new Date().toISOString() });
});

app.get('/v1/ai/status', (req, res) => {
  ok(res, {
    have_key: Boolean(savedGeminiKey),
    server_has_key: Boolean(savedGeminiKey),
  });
});

app.get('/v1/ai/runtime', (req, res) => {
  res.json(buildRuntimePayload());
});

app.get('/v1/ai/tts/models', (req, res) => {
  res.json({
    models: TTS_MODELS,
    default: GEMINI_MODELS.audio,
  });
});

app.get('/v1/ai/tts/voices', (req, res) => {
  const mode = typeof req.query.mode === 'string' ? req.query.mode : 'narration';
  res.json({
    voices: TTS_VOICES.map((voice) => ({
      ...voice,
      mode,
    })),
  });
});

app.get('/v1/ai/audio/sfx', (req, res) => {
  res.json({
    defaultPackId: 'default',
    packs: [
      {
        id: 'default',
        label: 'Default Celebration Pack',
        description: 'In-browser demo sounds for development use.',
        default: true,
        categories: {
          success: [
            {
              id: 'success-chime',
              label: 'Success Chime',
              base64: SUCCESS_CHIME,
              mimeType: 'audio/wav',
            },
          ],
          error: [
            {
              id: 'error-blip',
              label: 'Error Blip',
              base64: SUCCESS_CHIME,
              mimeType: 'audio/wav',
            },
          ],
          progress: [
            {
              id: 'progress-tone',
              label: 'Progress Tone',
              base64: SUCCESS_CHIME,
              mimeType: 'audio/wav',
            },
          ],
        },
      },
    ],
  });
});

app.post('/v1/ai/key', (req, res) => {
  const { apiKey, key, api_key: legacyKey } = req.body ?? {};
  const normalized = [apiKey, key, legacyKey].find((candidate) => typeof candidate === 'string' && candidate.trim());
  if (!normalized) {
    res.status(400).json({ ok: false, error: 'API key is required.' });
    return;
  }
  savedGeminiKey = normalized.trim();
  ok(res, {
    message: 'Gemini key saved for this session.',
    have_key: true,
  });
});

app.post('/v1/ai/planning', (req, res) => {
  const studentName =
    typeof req.body?.student?.name === 'string' && req.body.student.name.trim()
      ? req.body.student.name.trim()
      : 'young mathematician';
  const model = typeof req.body?.model === 'string' ? req.body.model : GEMINI_MODELS.planning;
  const plan = {
    planId: `plan-${Date.now()}`,
    source: model,
    microStory: `${studentName} embarks on a playful math quest!`,
    items: ensurePlanItems(),
    metadata: {
      generatedAt: new Date().toISOString(),
    },
  };
  res.json({
    plan,
    _meta: { used_model: model },
  });
});

app.post('/v1/ai/tts/synthesize', (req, res) => {
  const { text, language, voiceId } = req.body ?? {};
  res.json({
    text: typeof text === 'string' ? text : 'Hello from the local TTS stub!',
    voiceId: typeof voiceId === 'string' ? voiceId : TTS_VOICES[0].id,
    language: typeof language === 'string' ? language : TTS_VOICES[0].language,
    audio: {
      base64: SUCCESS_CHIME,
      mimeType: 'audio/wav',
    },
    meta: {
      generatedAt: new Date().toISOString(),
    },
  });
});

app.post('/v1/interests/packs', (req, res) => {
  const jobId = `sprite-${Date.now()}`;
  spriteJobs.set(jobId, {
    status: 'pending',
    createdAt: Date.now(),
  });
  res.json({
    ok: true,
    status: 'pending',
    job_id: jobId,
    retry_after_ms: 2000,
  });
});

app.get('/v1/sprites/job_status', (req, res) => {
  const jobId = typeof req.query.job_id === 'string' ? req.query.job_id : null;
  if (!jobId) {
    res.status(400).json({ ok: false, error: 'job_id is required' });
    return;
  }
  const job = spriteJobs.get(jobId);
  if (!job) {
    res.status(404).json({ ok: false, error: 'Job not found' });
    return;
  }
  const age = Date.now() - job.createdAt;
  const done = age > 2000;
  if (done) {
    job.status = 'done';
  }
  res.json({
    ok: true,
    status: job.status,
    job_id: jobId,
    result: done
      ? {
          url: 'https://placehold.co/256x256/png?text=Math+Sprite',
        }
      : null,
  });
});

app.post('/v1/sprites/process_job', (req, res) => {
  const jobId = typeof req.body?.job_id === 'string' ? req.body.job_id : typeof req.body?.jobId === 'string' ? req.body.jobId : null;
  if (!jobId) {
    res.status(400).json({ ok: false, error: 'job_id is required' });
    return;
  }
  const job = spriteJobs.get(jobId);
  if (!job) {
    res.status(404).json({ ok: false, error: 'Job not found' });
    return;
  }
  job.status = 'processing';
  res.json({ ok: true, status: job.status, job_id: jobId });
});

app.post('/v1/sessions/attempt', (req, res) => {
  const attempt = req.body ?? {};
  recordedAttempts.push({
    ...attempt,
    receivedAt: new Date().toISOString(),
  });
  ok(res);
});

app.get('/v1/sessions/user/:userId/stats', (req, res) => {
  const userId = req.params.userId;
  const lookbackDays = Number.parseInt(req.query.days ?? '30', 10);
  const sinceMs = Number.isFinite(lookbackDays) ? Date.now() - lookbackDays * 24 * 60 * 60 * 1000 : 0;
  const attempts = recordedAttempts.filter((item) => {
    if (item.userId !== userId) return false;
    if (!sinceMs) return true;
    const ts = Date.parse(item.receivedAt ?? item.savedAt ?? '');
    return Number.isFinite(ts) ? ts >= sinceMs : true;
  });
  const total = attempts.length;
  const correct = attempts.filter((item) => item.correct).length;
  const totalSeconds = attempts.reduce((sum, item) => {
    if (Number.isFinite(item.seconds)) return sum + Number(item.seconds);
    if (Number.isFinite(item.elapsedMs)) return sum + Number(item.elapsedMs) / 1000;
    return sum;
  }, 0);
  res.json({
    userId,
    days: lookbackDays,
    total_attempts: total,
    total_correct: correct,
    accuracy: total ? correct / total : 0,
    total_seconds: totalSeconds,
  });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found', path: req.path });
});

app.use((error, req, res, next) => {
  console.error('API error:', error);
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).json({ ok: false, error: error?.message ?? 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Math Galaxy dev API listening on port ${PORT}`);
});
