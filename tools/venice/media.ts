// ffmpeg helpers for the Venice asset pipeline. Needs ffmpeg on PATH
// (`brew install ffmpeg`). Everything here is local — no network.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export function hasFfmpeg(): boolean {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
}
export function requireFfmpeg() {
  if (!hasFfmpeg()) {
    console.error('ffmpeg not found — install it first:  brew install ffmpeg')
    process.exit(1)
  }
}

/** Does this ffmpeg build ship an encoder (e.g. libwebp_anim)? Homebrew's does;
 *  static/minimal builds often don't. */
export function hasEncoder(name: string): boolean {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' })
  return r.status === 0 && new RegExp(`\\s${name}\\s`).test(r.stdout)
}

export function ff(args: string[], label = 'ffmpeg') {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: 'inherit',
  })
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status})`)
}

export function dataUrl(file: string): string {
  const ext = path.extname(file).slice(1).toLowerCase()
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
}

/** Flatten a transparent PNG onto a solid colour, padded to a square canvas. */
export function compositeOnColor(src: string, hex: string, out: string, size = 1024) {
  const color = hex.replace('#', '0x')
  ff(
    [
      '-f',
      'lavfi',
      '-i',
      `color=c=${color}:s=${size}x${size}`,
      '-i',
      src,
      '-filter_complex',
      // fit the character into ~78% of the canvas, centred, leave air above
      `[1:v]scale=${Math.round(size * 0.78)}:-1:flags=lanczos[c];[0:v][c]overlay=(W-w)/2:(H-h)/2+${Math.round(size * 0.04)}:format=auto`,
      '-frames:v',
      '1',
      out,
    ],
    'composite',
  )
}

/** Forward + reversed copy → perfectly seamless loop for breathing/sway motion. */
export function boomerang(inMp4: string, outMp4: string) {
  ff(
    [
      '-i',
      inMp4,
      '-filter_complex',
      '[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[v]',
      '-map',
      '[v]',
      '-an',
      '-c:v',
      'libx264',
      '-crf',
      '20',
      '-preset',
      'slow',
      '-movflags',
      '+faststart',
      outMp4,
    ],
    'boomerang',
  )
}

/** Chroma-key a flat-colour video into a transparent animated WebP (what
 *  expo-image + Mascot already play for namaste/talking/meditation). */
export function keyToWebp(
  inMp4: string,
  outWebp: string,
  opts: {
    keyHex?: string
    size?: number
    fps?: number
    similarity?: number
    blend?: number
    /** forward+reverse (seamless idle loops, default) or plain forward (one-shot actions) */
    boomerang?: boolean
    /** seconds of the clip to use for a boomerang (default 3 → a 6 s loop) */
    trimSec?: number
    /** libwebp quality 0–100 (default 70) */
    quality?: number
  } = {},
) {
  const key = (opts.keyHex ?? '#00FF00').replace('#', '0x')
  const size = opts.size ?? 384
  const fps = opts.fps ?? 12
  const sim = opts.similarity ?? 0.2
  const blend = opts.blend ?? 0.08
  const trim = opts.trimSec ?? 3
  // frame 0 is the input still (smaller, un-animated) — skip the first 0.25 s
  // so the loop seam doesn't flash it
  const loop =
    opts.boomerang === false
      ? '[0:v]trim=start=0.25,setpts=PTS-STARTPTS,'
      : `[0:v]trim=start=0.25:duration=${trim + 0.25},setpts=PTS-STARTPTS,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,`
  ff(
    [
      '-i',
      inMp4,
      '-filter_complex',
      `${loop}fps=${fps},chromakey=${key}:${sim}:${blend},despill=type=green,scale=${size}:-1:flags=lanczos,format=yuva420p[v]`,
      '-map',
      '[v]',
      '-c:v',
      'libwebp_anim',
      '-lossless',
      '0',
      '-q:v',
      String(opts.quality ?? 70),
      '-loop',
      '0',
      '-an',
      outWebp,
    ],
    'keyToWebp',
  )
}

/** Chroma-key a flat-colour still into a transparent PNG (sticker props). */
export function keyToPng(
  inPng: string,
  outPng: string,
  opts: { keyHex?: string; size?: number; similarity?: number; blend?: number } = {},
) {
  const key = (opts.keyHex ?? '#00FF00').replace('#', '0x')
  const size = opts.size ?? 512
  const sim = opts.similarity ?? 0.22
  const blend = opts.blend ?? 0.1
  // despill only makes sense for green/blue keys; a magenta key gets none
  const despill = /00ff00$/i.test(key)
    ? ',despill=type=green'
    : /0000ff$/i.test(key)
      ? ',despill=type=blue'
      : ''
  ff(
    [
      '-i',
      inPng,
      '-vf',
      `chromakey=${key}:${sim}:${blend}${despill},scale=${size}:-1:flags=lanczos,format=rgba`,
      '-frames:v',
      '1',
      outPng,
    ],
    'keyToPng',
  )
}

/** First frame as a PNG poster (for the still fallback / reduce-motion). */
export function poster(inMp4: string, outPng: string, width = 1080) {
  ff(['-i', inMp4, '-frames:v', '1', '-vf', `scale=${width}:-1`, outPng], 'poster')
}

export function arg(name: string, def?: string, argv = process.argv): string | undefined {
  const i = argv.indexOf(name)
  if (i >= 0) return argv[i + 1] ?? ''
  return def
}
export const flag = (name: string, argv = process.argv) => argv.includes(name)
