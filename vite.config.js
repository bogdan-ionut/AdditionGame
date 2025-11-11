import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const CHIRP_ENDPOINT = '/api/chirp-pack/run'
const MAX_BODY_SIZE = 5 * 1024 * 1024
const DEFAULT_MANIFEST = 'chirp-pack-request.json'
const DEFAULT_OUT_DIR = 'public/audio/ro-RO/chirp3-hd-a'
const DEFAULT_SUMMARY = 'public/audio/ro-RO/chirp3-hd-a/manifest.json'

const readRequestBody = (req, limit = MAX_BODY_SIZE) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let received = 0
    let aborted = false
    req.on('data', (chunk) => {
      if (aborted) return
      received += chunk.length
      if (limit && received > limit) {
        aborted = true
        reject(new Error('payload_too_large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (aborted) return
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('aborted', () => {
      if (aborted) return
      aborted = true
      reject(new Error('request_aborted'))
    })
    req.on('error', (error) => {
      if (aborted) return
      aborted = true
      reject(error)
    })
  })

const runNodeScript = (cwd, args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      resolve({ exitCode: null, error, stdout, stderr })
    })
    child.on('close', (code) => {
      resolve({ exitCode: code, error: null, stdout, stderr })
    })
  })

const summarizeClips = (summary) => {
  if (!summary || typeof summary !== 'object' || !Array.isArray(summary.clips)) {
    return null
  }
  return summary.clips.reduce(
    (acc, clip) => {
      if (clip && typeof clip === 'object') {
        if (clip.skipped) {
          acc.skipped += 1
        } else {
          acc.generated += 1
        }
      }
      acc.total += 1
      return acc
    },
    { generated: 0, skipped: 0, total: 0 },
  )
}

const createChirpPackMiddleware = (rootDir) => {
  let running = false

  return async (req, res, next) => {
    if (!req.url || !req.url.startsWith(CHIRP_ENDPOINT)) {
      next()
      return
    }

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: false, error: 'Metodă neacceptată.' }))
      return
    }

    if (running) {
      res.statusCode = 409
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          success: false,
          error: 'Scriptul chirp-pack rulează deja. Așteaptă finalizarea lui.',
        }),
      )
      return
    }

    let rawBody = ''
    try {
      rawBody = await readRequestBody(req)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown'
      res.statusCode = message === 'payload_too_large' ? 413 : 400
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          success: false,
          error:
            message === 'payload_too_large'
              ? 'Manifestul trimis este prea mare.'
              : 'Nu am putut citi datele trimise.',
        }),
      )
      return
    }

    let payload
    try {
      payload = rawBody ? JSON.parse(rawBody) : {}
    } catch (_error) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: false, error: 'Payload JSON invalid.' }))
      return
    }

    const manifest = payload?.manifest
    if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.prompts)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: false, error: 'Manifestul Chirp 3 este invalid.' }))
      return
    }

    running = true
    const startedAt = new Date()

    const manifestFileName =
      typeof payload?.manifestFileName === 'string' && payload.manifestFileName.trim()
        ? payload.manifestFileName.trim()
        : null

    const options = payload?.options && typeof payload.options === 'object' ? payload.options : {}
    const manifestPath = path.resolve(rootDir, DEFAULT_MANIFEST)
    const outDir = path.resolve(
      rootDir,
      typeof options.outDir === 'string' && options.outDir.trim() ? options.outDir.trim() : DEFAULT_OUT_DIR,
    )
    const summaryPath = path.resolve(
      rootDir,
      typeof options.summary === 'string' && options.summary.trim()
        ? options.summary.trim()
        : DEFAULT_SUMMARY,
    )

    try {
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    } catch (error) {
      running = false
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Nu am putut salva manifestul chirp-pack în proiect.',
        }),
      )
      return
    }

    const scriptPath = path.resolve(rootDir, 'scripts/build-chirp-voice-pack.mjs')
    const args = [scriptPath, '--manifest', manifestPath, '--out-dir', outDir, '--summary', summaryPath]

    if (typeof options.force === 'boolean' && options.force) {
      args.push('--force')
    }
    if (typeof options.dryRun === 'boolean' && options.dryRun) {
      args.push('--dry-run')
    }
    if (typeof options.verbose === 'boolean' && options.verbose) {
      args.push('--verbose')
    }
    if (typeof options.concurrency === 'number' && Number.isFinite(options.concurrency)) {
      args.push('--concurrency', String(Math.max(1, Math.floor(options.concurrency))))
    }
    if (typeof options.voice === 'string' && options.voice.trim()) {
      args.push('--voice', options.voice.trim())
    }
    if (typeof options.language === 'string' && options.language.trim()) {
      args.push('--language', options.language.trim())
    }
    if (typeof options.encoding === 'string' && options.encoding.trim()) {
      args.push('--encoding', options.encoding.trim())
    }
    if (typeof options.sampleRateHertz === 'number' && Number.isFinite(options.sampleRateHertz)) {
      args.push('--sample-rate', String(Math.max(0, Math.floor(options.sampleRateHertz))))
    }

    let processResult
    try {
      processResult = await runNodeScript(rootDir, args)
    } catch (error) {
      processResult = {
        exitCode: null,
        error: error instanceof Error ? error : new Error(String(error)),
        stdout: '',
        stderr: '',
      }
    } finally {
      running = false
    }

    const finishedAt = new Date()
    let summary = null
    let summaryError = null
    if (processResult.exitCode === 0 && !(typeof options.dryRun === 'boolean' && options.dryRun)) {
      try {
        const rawSummary = await readFile(summaryPath, 'utf8')
        summary = JSON.parse(rawSummary)
      } catch (error) {
        summaryError =
          error instanceof Error ? error.message : 'Nu am putut citi manifestul generat.'
      }
    }

    const totals = summarizeClips(summary)
    const responsePayload = {
      success: processResult.exitCode === 0,
      exitCode: processResult.exitCode,
      stdout: processResult.stdout,
      stderr: processResult.stderr,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      manifestFileName,
      manifestPath: path.relative(rootDir, manifestPath),
      outputDirectory: path.relative(rootDir, outDir),
      summaryPath: path.relative(rootDir, summaryPath),
      summary: summary ?? null,
      summaryError,
      generatedClips: totals ? totals.generated : null,
      skippedClips: totals ? totals.skipped : null,
      totalClips: totals ? totals.total : null,
    }

    if (processResult.error) {
      responsePayload.error = processResult.error.message
    }

    if (processResult.exitCode === 0) {
      const parts = []
      if (totals) {
        parts.push(`${totals.generated} clipuri generate`)
        if (totals.skipped > 0) {
          parts.push(`${totals.skipped} omise`)
        }
      }
      const baseMessage = manifestFileName
        ? `Scriptul chirp-pack a procesat ${manifestFileName}.`
        : 'Scriptul chirp-pack s-a încheiat.'
      responsePayload.message = parts.length ? `${baseMessage} (${parts.join(', ')}).` : baseMessage
      if (summaryError) {
        responsePayload.message = `${responsePayload.message} (${summaryError})`
      }
      res.statusCode = 200
    } else {
      const codeLabel =
        processResult.exitCode === null || typeof processResult.exitCode === 'undefined'
          ? 'necunoscut'
          : processResult.exitCode
      const baseError =
        (processResult.error && processResult.error.message) ||
        (processResult.stderr && processResult.stderr.trim()) ||
        `Scriptul chirp-pack a eșuat (cod ${codeLabel}).`
      responsePayload.message = summaryError ? `${baseError} (${summaryError})` : baseError
      responsePayload.error = responsePayload.message
      res.statusCode = 500
    }

    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(responsePayload))
  }
}

const chirpPackRunnerPlugin = () => ({
  name: 'addition-game-chirp-pack-runner',
  configureServer(server) {
    server.middlewares.use(createChirpPackMiddleware(server.config.root))
  },
  configurePreviewServer(server) {
    server.middlewares.use(createChirpPackMiddleware(server.config.root))
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), chirpPackRunnerPlugin()],
  base: '/AdditionGame/',
})
