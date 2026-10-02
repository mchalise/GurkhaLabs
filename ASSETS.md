# Asset manifest

Revamp (Oct 2026): original logo, brand palette sampled from it — navy `#0C253A`, Gurkha blue `#0A4272`, Gurkha orange `#C55818` — light base with navy bands. Static HTML, no build step.

## Code

| File | What |
|---|---|
| `index.html` | The whole page. Logo: `assets/gurkha-logo.png` (nav + footer), monogram: `assets/gl-monogram-512.png` (hero summit + fleet diagram). |
| `assets/site.css` | All styles. Brand colour tokens at the top of `:root`; sections with class `dark` flip to the navy palette. |
| `assets/site.js` | All motion: topographic hero canvas, pinned stage timeline, agent-fleet animation, count-up stats, reveals, card tilt, magnetic CTAs, brief form → mailto. **Set `BOOKING_URL` at the top** (Cal.com / Calendly) and every "Book a call" button uses it. |
| `assets/fonts/` | Self-hosted Geist + Geist Mono variable fonts (SIL OFL, `OFL.txt`). |

Motion respects `prefers-reduced-motion` (static frame, no pin, no packets) and pauses when off-screen.
Slow devices drop the hero canvas to ~12fps at 1× resolution automatically.

## Pages

- `index.html`: hero (painted Venice sunrise with prayer flags, plays once and holds on the sun; GL flag on the summit; drifting snow; rotating headline word), proof + stats, ascent climb, case-study gallery, agent fleet on a night base camp, Engage cards with looping 3D art, Built in Kathmandu band with live clock, team, FAQ, contact.
- `outsourcing.html`: same design system. Hero, stats, why outsource, services (with the looping 3D art), how it works, Kathmandu band, contact.

Tech layer (index hero): typed terminal line, live `gurkha.ops` HUD card (desktop ≥1100px), commit-feed strip along the hero's bottom edge, and the painting cross-fades into `art/hero-blueprint.webp` as you scroll.
Case deck (Shipped work): pinned on desktop; each scroll step swaps to the next case; tabs jump. Swipe on mobile.

Site-wide: reading-progress bar, active nav link, mobile "Book a call" dock, button sheen, page view transitions, 0.75s monogram intro (once per session). Everything respects reduced motion.

## Venice art (assets/art/)

| File | Source | Used on |
|---|---|---|
| `hero-sky.webp` / `-1280.webp` | flags/skyflags-2 | hero still (both pages) |
| `hero-sky.mp4` / `.webm` | loops/skyflags-raw, slowed 1.8× (frame-blended) | hero sunrise, plays once (index, desktop only) |
| `hero-sky-loop.mp4` / `.webm` | last 4.7s of the slowed clip, ping-pong | flags keep fluttering after the sunrise |
| `hero-blueprint.webp` / `-1280.webp` | blueprint/blueprint-1 | scroll cross-fade in the hero |
| `hero-fg.webp` | hero/fg-2, magenta keyed | foreground ridge (both pages) |
| `ascent-summit.webp` | ascent/summit-2 | ascent section |
| `engage-{build,agentic,mobile}.webp` + `.mp4`/`.webm` | engage/build-1, agentic-2, mobile-2 + loops | Engage cards, outsourcing services |
| `fleet-basecamp.webp` / `-1280.webp` | fleet/basecamp-2 | agent fleet band |
| `kathmandu-valley.webp` | kathmandu/valley-2 | Built in Kathmandu band (both pages) |

Regenerate with `npm run venice:site` (see `tools/venice/README.md`).

## Images in use

| Section | Files |
|---|---|
| Share card (OG / Twitter) | `og-card.jpg` (1200×630) |
| Logo marquee | `mstn.png`, `zen.svg`, `mstg.png`, `jeli.svg`, `bats.png` |
| Shipped work | `opt/zenledger1.webp`, `opt/bats1.webp`, `opt/investready.webp`, `opt/mysecondteacher1.webp` |
| Team | `opt/anmol-chalise.webp`, `opt/manish-chalise.webp`, `opt/david-tamang.webp`, `opt/pratik-poudel.webp`, `opt/likhil-dahal.webp`, `opt/avaya.webp` (360×360, from the originals) |
| Favicons / manifest | `gurkha-favicon*.png`, `gl-monogram-512.png`, root `favicon.ico`, `apple-touch-icon.png` |

The work screenshots are only 550×265. Replace with 1200px+ captures when possible (same names in `opt/`).

## No longer used by index.html (kept, not deleted)

`hero-illustration.svg`, `hero.png`, `work.png`, `founding-engineer.png`, `capabilities-illustration.png`,
`new-platform-build.png`, `mobile-product-sprint.png`, `ai-workflow-layer.png`, `hands-on-execution.png`,
`systems-thinking.png`, `visible-progress.png`, `mobile-apps.png`, `web-platforms.png`, `applied-ai.png`,
`typescript.svg`, `gl-monogram.png`, the original team photos, and `/gl-fixes.css`.
`outsourcing.html` / `privacy-policy.html` still use the old styling.

## Venice (phase 4, not run yet)

`tools/venice/` — standalone copy of the Venice AI client with its own key (`.env`) and ledger (cap 15 USD).
Planned: Himalayan ridge plates + 1–2 short ambient loops. Always `--dry-run` first.

## Deploy & caching (Vercel)

- `vercel.json`: security headers on every page; HTML/robots/sitemap revalidate every visit; `assets/site.css` and `assets/site.js` are cached **1 year, immutable**, fonts 1 year, art/images 30 days (+ stale-while-revalidate).
- **When you edit `site.css` or `site.js`, bump the `?v=` number** in the `<head>` of `index.html`, `outsourcing.html`, `privacy-policy.html` (and `404.html` for CSS). Otherwise returning visitors keep the old file.
- If you replace an image in `assets/art/` or `assets/opt/`, give it a new file name (or accept up to 30 days of the old one for returning visitors).
- `.vercelignore` keeps `tools/`, `node_modules/`, docs and `.env` out of the deploy. `404.html` is served automatically for unknown URLs.
- `robots.txt` + `sitemap.xml` are in the root. Submit the sitemap in Google Search Console after the deploy.
- Fonts are Latin subsets (`Geist-latin.woff2`, `GeistMono-latin.woff2`, ~33KB each). The old full `*-Variable.woff2` files are no longer used.
- Logos in the marquee and the GL mark are resized WebP copies in `assets/opt/`; the originals in `assets/` are no longer referenced by the pages (the manifest/OG still use `gl-monogram-512.png` and `gurkha-logo.png`).
