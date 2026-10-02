// Gurkha Labs site art — Venice AI (nano-banana stills + Seedance loops).
//
//   npm run venice:site -- --dry-run                      # price everything, spend nothing
//   npm run venice:site                                   # all stills, 2 candidates each → contact sheets
//   npm run venice:site -- --set hero --only sky,mid      # one set / some jobs
//   npm run venice:site -- --n 3 --force                  # more candidates / redo existing
//   npm run venice:site -- --animate --pick sky=1,build=2,agentic=1,mobile=2 --dry-run
//   npm run venice:site -- --animate --pick sky=1,build=2,agentic=1,mobile=2
//
// Sets
//   hero       sky (16:9 dawn plate, the loop source) · mid (ridge layer on magenta) · fg (near ridge on magenta)
//   ascent     one tall summit illustration on the page colour
//   engage     build · agentic · mobile — matching clay-3D brand objects (agentic on navy, the others on white)
//   kathmandu  21:9 illustrated valley skyline at dusk
//   flags      the picked hero plate + prayer flags (edit) — its loop is the hero video
//   fleet      21:9 night base camp backdrop for the agent-fleet band
//   blueprint  the hero plate redrawn as a schematic (scroll cross-fade)
//
// Output: tools/venice/out/<set>/candidates/<job>-<k>.png (+ contact.png per set).
// Loops:  tools/venice/out/loops/<job>-raw.mp4. Post-processing (keying, webm/mp4, posters)
// happens afterwards — Claude does it from the candidates you pick.
//
// Budget: every call is priced first and reserved in tools/venice/spend-ledger.json
// (cap 15 USD by default, VENICE_BUDGET_CAP / --cap). Key: VENICE_API_KEY in .env.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { generateImage, editImage, quoteVideo, queueVideo, retrieveVideo, sleep, balances } from './client'
import { reserve, settle, report } from './budget'
import { arg, flag, dataUrl } from './media'

const OUT = path.resolve(process.cwd(), 'tools/venice/out')
const MODEL = arg('--model', 'nano-banana-2')!
const EDIT_MODEL = arg('--edit-model', 'nano-banana-2-edit')!
const N = Number(arg('--n', '2'))
const PRICE: Record<string, number> = {
  'nano-banana-2': 0.19,
  'nano-banana-2-lite': 0.06,
  'nano-banana-pro': 0.35,
  'nano-banana-2-edit': 0.19,
  'nano-banana-pro-edit': 0.35,
  'seedream-v5-pro': 0.11,
  'flux-2-pro': 0.03,
}
const price = (m: string) => PRICE[m] ?? 0.4

// ── brand ────────────────────────────────────────────────────────────────────
const PALETTE =
  'Strict brand palette: deep navy #0C253A, Gurkha blue #0A4272, steel blue-grey #5D7489, pale sky #EAF0F6, ' +
  'off-white #F4F7FB and a single warm accent of burnt orange #C55818 used sparingly for sunlight. No other hues, no purple, no green, no teal.'
const PAINT =
  'Refined modern editorial illustration, painterly gouache texture with clean graphic shapes, soft atmospheric ' +
  'perspective, calm and premium, generous negative space. ' + PALETTE
const NO_TEXT = 'text, letters, words, logo, watermark, signature, numbers, caption, frame, border, UI'
const NEG_PAINT = `${NO_TEXT}, people, person, climber, animals, birds, photo, photorealistic, 3D render, neon, saturated, busy detail, clutter, harsh contrast, vignette`
const KEY = '#FF00FF'
const ON_KEY = 'Isolated on a perfectly flat, uniform solid magenta (#FF00FF) background — the magenta fills everything that is not the subject, no gradient, no shadow on it, no haze.'

const CLAY =
  'Soft matte clay 3D render, isometric three-quarter view, rounded bevelled edges, gentle studio lighting with soft ' +
  'contact shadow, minimal and premium like a fintech product illustration. ' + PALETTE + ' Single centred object, lots of empty space around it.'
const NEG_CLAY = `${NO_TEXT}, people, hands, robot, face, character, cartoon, glossy plastic, chrome, neon, rainbow, clutter, multiple scenes`

interface Job {
  set: string
  name: string
  prompt: string
  negative: string
  /** final aspect; anything but 1:1 is widened with /image/edit after the first pass */
  aspect: '1:1' | '16:9' | '21:9' | '3:4'
  /** loop prompt (Seedance), if this job can be animated */
  loop?: { prompt: string; negative: string; resolution: '720p' | '1080p' }
  /** /image/edit this existing image (path under tools/venice/out) instead of generating from text */
  edit?: string
}

const JOBS: Job[] = [
  // hero — three depth layers for parallax + the loop
  {
    set: 'hero',
    name: 'sky',
    aspect: '16:9',
    prompt:
      'Wide panoramic view of the high Himalaya at first light: a calm pale sky that fades from off-white at the top to a soft warm ' +
      'glow near the horizon, thin layered clouds, a distant range of snow peaks in pale blue-grey with one tall central summit ' +
      'catching a thin rim of burnt-orange sunrise light. The upper-left 55% of the image is quiet open sky (text will sit there). ' +
      PAINT,
    negative: NEG_PAINT,
    loop: {
      prompt:
        'Very slow, calm time-lapse: thin clouds drift gently from left to right across the sky and over the peaks, the sunrise ' +
        'glow on the summit brightens very slightly. Camera completely static: no zoom, no pan, no tilt. Mountains do not move. Seamless, serene.',
      negative: 'camera movement, zoom, pan, shake, people, birds, text, flicker, morphing mountains, fast motion',
      resolution: '1080p',
    },
  },
  {
    set: 'hero',
    name: 'mid',
    aspect: '21:9',
    prompt:
      'A single horizontal band of mid-distance Himalayan foothill ridges, layered silhouettes in Gurkha blue #0A4272 fading to ' +
      'steel blue-grey with soft mist between the layers; the ridgeline undulates across the full width and occupies only the ' +
      'bottom 45% of the image. ' + ON_KEY + ' ' + PAINT,
    negative: NEG_PAINT + ', sky, clouds, sun',
  },
  {
    set: 'hero',
    name: 'fg',
    aspect: '21:9',
    prompt:
      'A single dark foreground ridge silhouette in deep navy #0C253A spanning the full width, a few tiny pine-tree shapes on the ' +
      'crest, the ridge occupies only the bottom 30% of the image. ' + ON_KEY + ' ' + PAINT,
    negative: NEG_PAINT + ', sky, clouds, sun, mist',
  },
  // ascent — the climb section backdrop
  {
    set: 'ascent',
    name: 'summit',
    aspect: '3:4',
    prompt:
      'One majestic pyramidal Himalayan summit like Everest seen from base camp, tall portrait composition, snow faces in pale ' +
      'blue-grey and white with Gurkha blue shadows, the very top lit with a burnt-orange sunrise glow, a faint zig-zag route ' +
      'visible up the left ridge, soft clouds around the lower slopes fading into a plain off-white #F4F7FB background at the ' +
      'edges and bottom. ' + PAINT,
    negative: NEG_PAINT,
  },
  // engage — card art
  {
    set: 'engage',
    name: 'build',
    aspect: '1:1',
    prompt:
      'Three stacked rounded platform slabs like a layered software stack — navy base, Gurkha blue middle, off-white top with a ' +
      'small burnt-orange cube being placed on top. Plain pure white #FFFFFF background. ' + CLAY,
    negative: NEG_CLAY,
    loop: {
      prompt: 'The small orange cube gently lowers and settles onto the top slab, the slabs float up and down very slightly. Camera static. Smooth, slow, loopable.',
      negative: 'camera movement, zoom, text, people, extra objects, morphing, flicker',
      resolution: '720p',
    },
  },
  {
    set: 'engage',
    name: 'agentic',
    aspect: '1:1',
    prompt:
      'A central rounded burnt-orange hub sphere with five small pale-blue satellite pills orbiting it on thin elliptical rings, ' +
      'like one engineer coordinating a fleet of agents. Plain solid deep navy #0C253A background. ' + CLAY,
    negative: NEG_CLAY,
    loop: {
      prompt: 'The five small satellites orbit slowly and smoothly around the central hub along their rings; the hub glows softly. Camera static. Slow, loopable.',
      negative: 'camera movement, zoom, text, people, extra objects, morphing, flicker',
      resolution: '720p',
    },
  },
  {
    set: 'engage',
    name: 'mobile',
    aspect: '1:1',
    prompt:
      'A rounded smartphone slab lying at an angle, its screen showing abstract soft blue UI cards and one burnt-orange button ' +
      '(no text), a couple of small rounded cards floating above the screen. Plain pure white #FFFFFF background. ' + CLAY,
    negative: NEG_CLAY,
    loop: {
      prompt: 'The small cards float gently up and down above the phone screen; the phone stays still. Camera static. Slow, loopable.',
      negative: 'camera movement, zoom, text, people, hands, extra objects, morphing, flicker',
      resolution: '720p',
    },
  },
  // flags — the picked hero plate with Nepali prayer flags added (one loop: clouds drift + flags flutter)
  {
    set: 'flags',
    name: 'skyflags',
    aspect: '16:9',
    edit: 'hero/candidates/sky-1.png',
    prompt:
      'Keep this exact painting unchanged — same mountains, sky, clouds, palette, brushwork and framing. Add only one thing: ' +
      'a single long string of small Tibetan/Nepali prayer flags (lungta) running diagonally from the lower-right foreground ' +
      'up toward the middle-right of the image, tied off on a rock at the right edge, gently sagging, the small square flags in ' +
      'muted brand tones (off-white, pale blue, steel blue, deep navy and burnt orange #C55818), painted in the same gouache ' +
      'style, slightly lifted by the wind. Leave the left half and the central summit completely untouched. No text, no symbols ' +
      'readable on the flags, no people.',
    negative: NEG_PAINT,
    loop: {
      prompt:
        'The prayer flags flutter and ripple gently in a steady breeze; thin clouds drift slowly left to right; the sunrise glow ' +
        'on the summit brightens very slightly. Camera completely static — no zoom, no pan. Mountains never move. Calm, seamless.',
      negative: 'camera movement, zoom, pan, shake, people, birds, text, flicker, morphing mountains, flags detaching, fast motion',
      resolution: '1080p',
    },
  },
  // fleet — painted backdrop for the dark agent-fleet band
  {
    set: 'fleet',
    name: 'basecamp',
    aspect: '21:9',
    prompt:
      'Wide nocturnal panorama of a Himalayan base camp under a deep navy starry sky: a small cluster of dome tents on a rocky ' +
      'glacier moraine glowing warm burnt-orange from inside like lit screens, thin lines of warm light connecting the tents like ' +
      'a quiet network, the massive snow-covered peaks behind in pale moonlit blue-grey, faint stars. The left 55% is calm dark ' +
      'sky and dark ground (text will sit there), the camp sits in the right third. ' + PAINT.replace('calm and premium', 'calm, premium and nocturnal'),
    negative: NEG_PAINT + ', daylight, sun, bright sky',
  },
  // blueprint — the same hero plate redrawn as an engineering schematic (cross-fades in on scroll)
  {
    set: 'blueprint',
    name: 'blueprint',
    aspect: '16:9',
    edit: 'flags/candidates/skyflags-2.png',
    prompt:
      'Redraw this exact scene as a technical engineering blueprint / CAD schematic, keeping the identical composition, ' +
      'mountain silhouettes, summit position, prayer-flag line and rock in exactly the same places. Deep navy #0C253A ' +
      'background with a faint fine square grid; every ridge, peak and cloud outlined in thin glowing pale-blue #9FC3E6 ' +
      'wireframe lines with contour/elevation lines on the slopes; small node dots and thin dashed connector lines between ' +
      'some peaks like a network diagram; the summit outline and the prayer-flag line accented in burnt orange #C55818. ' +
      'Clean vector look, no shading, no painting texture, no text, no numbers, no labels, no logos.',
    negative: 'text, letters, numbers, labels, watermark, logo, people, painterly texture, photo, colours other than navy blue and orange, moved mountains, different composition',
  },
  // kathmandu — built-in-Kathmandu band
  {
    set: 'kathmandu',
    name: 'valley',
    aspect: '21:9',
    prompt:
      'Wide illustrated skyline of the Kathmandu valley at dusk: tiered pagoda temple roofs, a white stupa dome with a golden ' +
      'spire, dense low city rooftops, terraced hills behind and the snow Himalaya faintly on the horizon, a few warm lit ' +
      'windows in burnt orange, calm navy evening sky. ' + PAINT,
    negative: NEG_PAINT + ', eyes painted on stupa',
  },
]

// ── helpers ─────────────────────────────────────────────────────────────────
function contactSheet(dir: string, out: string) {
  const py = `
import glob, os
from PIL import Image, ImageDraw
files = sorted(f for f in glob.glob(os.path.join(${JSON.stringify(dir)}, '*.png')))
cell, cols = 360, 4
rows = max(1, (len(files) + cols - 1) // cols)
sheet = Image.new('RGB', (cols * cell, rows * (cell + 24)), (236, 240, 245))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB'); im.thumbnail((cell - 10, cell - 10))
    x, y = (i % cols) * cell, (i // cols) * (cell + 24)
    sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
    d.text((x + 6, y + cell + 4), os.path.basename(f)[:-4], fill=(12, 37, 58))
sheet.save(${JSON.stringify(out)})
`
  const r = spawnSync('python3', ['-c', py], { stdio: 'inherit' })
  if (r.status === 0) console.log(`  ✓ contact sheet → ${path.relative(process.cwd(), out)}`)
}

function selected(): Job[] {
  const set = arg('--set')
  const only = arg('--only')?.split(',').filter(Boolean)
  return JOBS.filter((j) => (!set || set === 'all' || j.set === set) && (!only || only.includes(j.name)))
}

function costOf(j: Job) {
  if (j.edit) return price(EDIT_MODEL)
  return price(MODEL) + (j.aspect === '1:1' ? 0 : price(EDIT_MODEL))
}

async function still(j: Job, k: number) {
  const dir = path.join(OUT, j.set, 'candidates')
  const out = path.join(dir, `${j.name}-${k}.png`)
  if (fs.existsSync(out) && !flag('--force')) {
    console.log(`  · ${j.name}-${k} exists (skip; --force to redo)`)
    return 0
  }
  const usd = costOf(j)
  if (flag('--dry-run')) {
    const how = j.edit ? `${EDIT_MODEL} edit of ${j.edit}` : `${MODEL}${j.aspect === '1:1' ? '' : ` + ${EDIT_MODEL} → ${j.aspect}`}`
    console.log(`  ${j.set}/${j.name}-${k}: ${how} ≈ $${usd.toFixed(2)}`)
    return usd
  }
  const entry = reserve(usd, `site-${j.set}-${j.name}-${k}`)
  try {
    fs.mkdirSync(dir, { recursive: true })
    if (j.edit) {
      const src = path.join(OUT, j.edit)
      if (!fs.existsSync(src)) throw new Error(`no ${path.relative(process.cwd(), src)}`)
      const png = await editImage({ model: EDIT_MODEL, image: fs.readFileSync(src).toString('base64'), prompt: j.prompt, resolution: '2K', aspect_ratio: j.aspect as '16:9' })
      fs.writeFileSync(out, png)
      settle(entry, 'spent')
      console.log(`  ✓ ${path.relative(process.cwd(), out)}`)
      return usd
    }
    const res = await generateImage({ model: MODEL, prompt: j.prompt, negative_prompt: j.negative, width: 1024, height: 1024, seed: 7000 + k * 31 + j.name.length })
    let png: Buffer = Buffer.from(res.images[0], "base64")
    if (j.aspect !== '1:1') {
      // widen / reshape the square concept into the final frame at 2K, keeping its look
      png = await editImage({
        model: EDIT_MODEL,
        image: png.toString('base64'),
        prompt:
          `Extend this exact illustration to a ${j.aspect} frame. Keep the same style, palette, lighting and subject; ` +
          `continue the scene naturally at the sides${j.prompt.includes('#FF00FF') ? ' and keep the background flat solid magenta #FF00FF' : ''}. No text, no border.`,
        resolution: '2K',
        aspect_ratio: j.aspect,
      })
    }
    fs.writeFileSync(out, png)
    settle(entry, 'spent')
    console.log(`  ✓ ${path.relative(process.cwd(), out)}`)
  } catch (e) {
    settle(entry, 'refunded')
    console.error(`  ✗ ${j.name}-${k}: ${(e as Error).message}`)
    log(`ERROR still ${j.set}/${j.name}-${k}: ${(e as Error).message}`)
  }
  return usd
}

async function loop(j: Job, pick: number) {
  const src = path.join(OUT, j.set, 'candidates', `${j.name}-${pick}.png`)
  const raw = path.join(OUT, 'loops', `${j.name}-raw.mp4`)
  if (!fs.existsSync(src)) throw new Error(`no ${path.relative(process.cwd(), src)} — run the stills first`)
  if (fs.existsSync(raw) && !flag('--force')) {
    console.log(`  · ${j.name} loop exists (skip; --force to redo)`)
    return 0
  }
  const vmodel = arg('--vmodel', 'seedance-1-5-pro-image-to-video-basic')!
  const base = { model: vmodel, duration: '5s', resolution: j.loop!.resolution, audio: false }
  const usd = await quoteVideo(base)
  console.log(`  ${j.name} loop: ${vmodel} 5s ${base.resolution} from ${path.basename(src)} ≈ $${usd.toFixed(2)}`)
  if (flag('--dry-run')) return usd
  const entry = reserve(usd, `site-loop-${j.name}`)
  let queue_id: string
  try {
    const q = await queueVideo({
      ...base,
      prompt: j.loop!.prompt,
      negative_prompt: j.loop!.negative,
      image_url: dataUrl(src),
      consents: { seedance: { confirmed_terms_and_privacy: true, confirmed_legal_right: true, confirmed_screening_acknowledged: true } },
    })
    queue_id = q.queue_id
    console.log(`  ▶ queued ${j.name}: ${queue_id}`)
  } catch (e) {
    settle(entry, 'refunded')
    throw e
  }
  const t0 = Date.now()
  while (Date.now() - t0 < 20 * 60_000) {
    const r = await retrieveVideo(vmodel, queue_id)
    if ('bytes' in r) {
      fs.mkdirSync(path.dirname(raw), { recursive: true })
      fs.writeFileSync(raw, r.bytes)
      settle(entry, 'spent')
      console.log(`  ✓ ${path.relative(process.cwd(), raw)}`)
      return usd
    }
    await sleep(7000)
  }
  settle(entry, 'spent')
  throw new Error(`${j.name}: video timed out — run again later (it resumes)`)
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  try {
    console.log('Venice balance:', JSON.stringify(await balances()))
  } catch (e) {
    console.warn('balance lookup failed (non-fatal):', (e as Error).message)
  }
  let total = 0
  if (flag('--animate')) {
    const picks = Object.fromEntries(
      (arg('--pick') ?? '').split(',').filter(Boolean).map((p) => p.split('=') as [string, string]),
    )
    const jobs = selected().filter((j) => j.loop && picks[j.name])
    if (!jobs.length) throw new Error('nothing to animate — pass --pick sky=1,build=2,agentic=1,mobile=2')
    for (const j of jobs) {
      try {
        total += await loop(j, Number(picks[j.name]))
      } catch (e) {
        const msg = (e as Error).message ?? String(e)
        log(`ERROR loop ${j.name}: ${msg}`)
        console.error(`  ✗ ${j.name} loop: ${msg}`)
      }
    }
  } else {
    const jobs = selected()
    for (const set of [...new Set(jobs.map((j) => j.set))]) {
      console.log(`\n${set}`)
      for (const j of jobs.filter((x) => x.set === set)) for (let k = 1; k <= N; k++) total += await still(j, k)
      if (!flag('--dry-run')) contactSheet(path.join(OUT, set, 'candidates'), path.join(OUT, set, 'contact.png'))
    }
  }
  console.log(`\n${flag('--dry-run') ? 'Would spend' : 'Spent this run'} ≈ $${total.toFixed(2)}`)
  report()
}

// every run appends to tools/venice/out/venice.log so failures can be read back later
const LOG = path.join(OUT, 'venice.log')
const log = (line: string) => {
  try {
    fs.mkdirSync(OUT, { recursive: true })
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {
    /* logging is best-effort */
  }
}
log(`run: ${process.argv.slice(2).join(' ') || '(no args)'}`)
main()
  .then(() => log('ok'))
  .catch((e) => {
    const msg = (e as Error).message ?? String(e)
    log(`ERROR: ${msg}`)
    console.error('❌', msg)
    console.error(`(logged to ${path.relative(process.cwd(), LOG)})`)
    process.exit(1)
  })
