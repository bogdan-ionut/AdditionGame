#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const __filename = fileURLToPath(import.meta.url);

const DEFAULT_MANIFEST = path.resolve(process.cwd(), 'chirp-pack-request.json');
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), 'public/audio/ro-RO/chirp3-hd-a');
const DEFAULT_SUMMARY = path.resolve(DEFAULT_OUT_DIR, 'manifest.json');

const DEFAULT_VOICE = {
  languageCode: 'ro-RO',
  name: 'ro-RO-Chirp3-HD-A',
  audioEncoding: 'MP3',
  sampleRateHertz: 24000,
};

const SUPPORTED_ENCODINGS = new Set(['MP3', 'LINEAR16']);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    manifest: DEFAULT_MANIFEST,
    outDir: DEFAULT_OUT_DIR,
    summary: DEFAULT_SUMMARY,
    concurrency: 1,
    voiceName: null,
    languageCode: null,
    audioEncoding: null,
    sampleRateHertz: null,
    dryRun: false,
    force: false,
    verbose: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--manifest':
      case '-m':
        options.manifest = path.resolve(process.cwd(), args[++index] ?? '');
        break;
      case '--out-dir':
      case '-o':
        options.outDir = path.resolve(process.cwd(), args[++index] ?? '');
        break;
      case '--summary':
      case '-s':
        options.summary = path.resolve(process.cwd(), args[++index] ?? '');
        break;
      case '--voice':
        options.voiceName = args[++index] ?? null;
        break;
      case '--language':
        options.languageCode = args[++index] ?? null;
        break;
      case '--encoding':
        options.audioEncoding = args[++index] ?? null;
        break;
      case '--sample-rate':
        options.sampleRateHertz = Number.parseInt(args[++index] ?? '', 10) || null;
        break;
      case '--concurrency':
        options.concurrency = Math.max(1, Number.parseInt(args[++index] ?? '1', 10) || 1);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        if (arg && arg.startsWith('-')) {
          console.warn(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  return options;
};

const printHelp = () => {
  console.log(`Usage: node ${path.relative(process.cwd(), __filename)} [options]\n\n` +
    'Options:\n' +
    '  -m, --manifest <file>    Path to JSON manifest exported from the UI\n' +
    '  -o, --out-dir <dir>      Directory where audio files will be written\n' +
    '  -s, --summary <file>     Output manifest describing generated clips\n' +
    '      --voice <name>       Override Google Cloud voice name (default Chirp3-HD-A)\n' +
    '      --language <code>    Override language code (default ro-RO)\n' +
    '      --encoding <type>    Audio encoding (MP3 or LINEAR16)\n' +
    '      --sample-rate <hz>   Sample rate in hertz (default 24000)\n' +
    '      --concurrency <n>    Number of parallel synthesize calls (default 1)\n' +
    '      --force              Re-generate even if files exist\n' +
    '      --dry-run            Validate manifest without calling the API\n' +
    '      --verbose            Log detailed progress\n' +
    '  -h, --help               Show this message\n');
};

const readJsonFile = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Unable to read manifest at ${filePath}:`, error.message);
    throw error;
  }
};

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const hashText = (text) =>
  crypto.createHash('sha1').update(text, 'utf8').digest('hex');

const normalizePrompt = (prompt, index) => {
  const text = typeof prompt?.text === 'string' ? prompt.text.trim() : '';
  if (!text) {
    throw new Error(`Prompt at index ${index} is missing text.`);
  }
  const languageCode = typeof prompt?.languageCode === 'string' && prompt.languageCode.trim()
    ? prompt.languageCode.trim()
    : null;
  const kind = typeof prompt?.kind === 'string' && prompt.kind ? prompt.kind : null;
  const categories = Array.isArray(prompt?.categories)
    ? prompt.categories.map(String)
    : [];
  return { text, languageCode, kind, categories };
};

const chunk = (items, size) => {
  const groups = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
};

const main = async () => {
  const options = parseArgs();
  const manifestPath = options.manifest || DEFAULT_MANIFEST;

  const manifest = await readJsonFile(manifestPath);

  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifest must be a JSON object.');
  }

  const prompts = Array.isArray(manifest.prompts) ? manifest.prompts : [];
  if (!prompts.length) {
    console.log('Manifest does not contain any prompts to synthesize. Nothing to do.');
    return;
  }

  const unique = new Map();
  prompts.forEach((prompt, index) => {
    const normalized = normalizePrompt(prompt, index);
    const key = normalized.text.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, normalized);
    } else {
      const existing = unique.get(key);
      existing.categories = Array.from(new Set([...existing.categories, ...normalized.categories]));
    }
  });

  const voice = {
    ...DEFAULT_VOICE,
    ...(manifest.voice ?? {}),
  };

  if (options.voiceName) {
    voice.name = options.voiceName;
  }
  if (options.languageCode) {
    voice.languageCode = options.languageCode;
  }
  if (options.audioEncoding) {
    const encoding = options.audioEncoding.toUpperCase();
    if (!SUPPORTED_ENCODINGS.has(encoding)) {
      throw new Error(`Unsupported encoding: ${options.audioEncoding}`);
    }
    voice.audioEncoding = encoding;
  }
  if (options.sampleRateHertz) {
    voice.sampleRateHertz = options.sampleRateHertz;
  }

  if (!SUPPORTED_ENCODINGS.has(String(voice.audioEncoding).toUpperCase())) {
    throw new Error(`Unsupported encoding in manifest: ${voice.audioEncoding}`);
  }

  if (!voice.languageCode) {
    throw new Error('Voice languageCode is required.');
  }

  const extension = voice.audioEncoding === 'LINEAR16' ? 'wav' : 'mp3';
  const summaryEntries = [];

  await ensureDir(options.outDir);

  const client = options.dryRun ? null : new TextToSpeechClient();

  const dedupedPrompts = Array.from(unique.values());
  console.log(`Preparing ${dedupedPrompts.length} unique prompts (from ${prompts.length} entries).`);

  if (options.dryRun) {
    console.log('Dry run enabled; skipping synthesis.');
  }

  const groups = chunk(dedupedPrompts, options.concurrency);
  let processed = 0;
  for (const group of groups) {
    await Promise.all(
      group.map(async (prompt) => {
        const languageCode = prompt.languageCode || voice.languageCode;
        const sha1 = hashText(prompt.text);
        const fileName = `${sha1}-${voice.sampleRateHertz ?? 'auto'}.${extension}`;
        const filePath = path.join(options.outDir, fileName);

        const entry = {
          text: prompt.text,
          languageCode,
          kind: prompt.kind,
          categories: prompt.categories,
          voiceName: voice.name,
          audioEncoding: voice.audioEncoding,
          sampleRateHertz: voice.sampleRateHertz,
          fileName,
          filePath,
          sha1,
          generatedAt: new Date().toISOString(),
        };

        if (!options.force) {
          try {
            await fs.access(filePath);
            if (options.verbose) {
              console.log(`Skipping existing clip for "${prompt.text}" -> ${fileName}`);
            }
            summaryEntries.push({ ...entry, skipped: true });
            return;
          } catch (_) {
            // file is missing; continue
          }
        }

        if (options.dryRun) {
          if (options.verbose) {
            console.log(`[dry-run] Would synthesize "${prompt.text}" -> ${fileName}`);
          }
          summaryEntries.push({ ...entry, skipped: false });
          return;
        }

        const request = {
          input: { text: prompt.text },
          voice: { languageCode, name: voice.name },
          audioConfig: {
            audioEncoding: voice.audioEncoding,
            sampleRateHertz: voice.sampleRateHertz || undefined,
          },
        };

        const [response] = await client.synthesizeSpeech(request);
        if (!response.audioContent) {
          throw new Error(`Synthesis returned no audio for prompt: ${prompt.text}`);
        }
        await fs.writeFile(filePath, response.audioContent, 'binary');
        if (options.verbose) {
          console.log(`Generated ${fileName} (${prompt.text})`);
        }
        summaryEntries.push({ ...entry, skipped: false });
      }),
    );
    processed += group.length;
    process.stdout.write(`\rProcessed ${processed}/${dedupedPrompts.length}`);
  }
  process.stdout.write('\n');

  const summaryPayload = {
    generatedAt: new Date().toISOString(),
    sourceManifest: path.relative(process.cwd(), manifestPath),
    outputDirectory: path.relative(process.cwd(), options.outDir),
    voice,
    clips: summaryEntries.map(({ filePath, ...rest }) => ({ ...rest })),
  };

  if (!options.dryRun) {
    await ensureDir(path.dirname(options.summary));
    await fs.writeFile(options.summary, `${JSON.stringify(summaryPayload, null, 2)}\n`, 'utf8');
    console.log(`Saved summary to ${path.relative(process.cwd(), options.summary)}`);
  }

  console.log('Done.');
};

main().catch((error) => {
  console.error('Chirp pack generation failed:', error);
  process.exitCode = 1;
});
