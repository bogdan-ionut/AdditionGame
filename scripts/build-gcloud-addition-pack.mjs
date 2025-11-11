#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) continue;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        index += 1;
      } else {
        args[key] = 'true';
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function toInteger(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stableSerialize(descriptor) {
  const normalized = {
    text: descriptor.text ?? '',
    lang: descriptor.lang ?? '',
    voice: descriptor.voice ?? '',
    model: descriptor.model ?? '',
    rate: Number.isFinite(descriptor.rate) ? Number(descriptor.rate) : 1,
    pitch: Number.isFinite(descriptor.pitch) ? Number(descriptor.pitch) : 1,
    format: descriptor.format ?? 'audio/mpeg',
    sampleRate: Number.isFinite(descriptor.sampleRate) ? Number(descriptor.sampleRate) : null,
  };
  return JSON.stringify(normalized);
}

function makeCacheKey(descriptor) {
  const payload = stableSerialize(descriptor);
  let hash = 0x811c9dc5n;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= BigInt(payload.charCodeAt(index));
    hash = (hash * 0x1000193n) & 0xffffffffffffffffn;
  }
  const hex = hash.toString(16).padStart(16, '0');
  return `v2-${hex.slice(0, 16)}`;
}

async function ensureDirectory(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function removeIfExists(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function copyFile(source, destination) {
  await ensureDirectory(path.dirname(destination));
  await fs.copyFile(source, destination);
}

async function runZip(zipPath, workingDir) {
  await new Promise((resolve, reject) => {
    const child = spawn('zip', ['-r', '-X', zipPath, 'manifest.json', 'clips'], {
      cwd: workingDir,
      stdio: 'inherit',
    });
    child.on('error', (error) => {
      reject(new Error(`Nu am putut rula comanda zip: ${error.message}`));
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Comanda zip a ieșit cu codul ${code}.`));
      }
    });
  });
}

function buildPrompt(i, j) {
  return `Cât face ${i} plus ${j}?`;
}

async function main() {
  const args = parseArgs(process.argv);
  const inputDir = path.resolve(args.input || args._[0] || path.join(__dirname, '..', 'audio/ro-RO/chirp3-hd-kore/raw'));
  const outputDir = path.resolve(args.output || path.join(inputDir, '..', 'pack'));
  const lang = args.lang || 'ro-RO';
  const voice = args.voice || 'ro-RO-Chirp3-HD-Kore';
  const model = args.model || 'gcloud-tts';
  const flavor = args.flavor || 'problem.v2';
  const format = args.format || 'audio/mpeg';
  const rate = toNumber(args.rate, 1);
  const pitch = toNumber(args.pitch, 1);
  const sampleRate = toInteger(args['sample-rate'], 24000);
  const minOperand = toInteger(args.min, 0);
  const maxOperand = toInteger(args.max, 9);
  const zipName = args['zip-name'] || 'gcloud-ro-addition-pack.zip';
  const zipPath = path.resolve(path.join(outputDir, '..', zipName));

  const entries = [];
  const createdAt = Date.now();

  for (let i = minOperand; i <= maxOperand; i += 1) {
    for (let j = minOperand; j <= maxOperand; j += 1) {
      const fileName = `cat-face-${i}-plus-${j}.mp3`;
      const sourcePath = path.join(inputDir, fileName);
      let fileStats;
      try {
        fileStats = await fs.stat(sourcePath);
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          throw new Error(`Lipsește fișierul audio: ${sourcePath}`);
        }
        throw error;
      }
      const text = buildPrompt(i, j);
      const descriptor = {
        text,
        lang,
        voice,
        model,
        flavor,
        rate,
        pitch,
        format,
        sampleRate,
      };
      const key = makeCacheKey(descriptor);
      const relativeClipPath = path.join('clips', `${key}.mp3`);
      const destinationPath = path.join(outputDir, relativeClipPath);
      await copyFile(sourcePath, destinationPath);
      entries.push({
        key,
        bytes: fileStats.size,
        file: relativeClipPath.replace(/\\/g, '/'),
        meta: {
          text,
          lang,
          voice,
          model,
          flavor,
          rate,
          pitch,
          format,
          sampleRate,
        },
      });
    }
  }

  entries.sort((a, b) => a.key.localeCompare(b.key));

  const manifest = {
    version: 1,
    createdAt,
    entries,
  };

  await ensureDirectory(outputDir);
  const manifestPath = path.join(outputDir, 'manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  await removeIfExists(zipPath);
  await runZip(zipPath, outputDir);
  console.log(`✔ Pachetul a fost generat: ${zipPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
