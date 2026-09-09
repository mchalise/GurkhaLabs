# Asset manifest

All page images live in `assets/`. Every slot below is wired and populated.

## Naming convention

Where a company appears **both** as a client logo and as a project screenshot, the
logo keeps the plain name and the screenshot takes a `1` suffix:

| Company | Logo (logo band) | Screenshot (Engineers Have Shipped) |
|---|---|---|
| MySecondTeacher | `mysecondteacher.png` | `mysecondteacher1.png` |
| ZenLedger | `zenledger.png` | `zenledger1.png` |
| BATS | `bats.png` | `bats1.png` |
| Jelajah Ilmu | `jelajah-ilmu.png` | — |
| InvestReady | — | `investready.png` (no suffix — no logo collision) |

## Slots

| Section | Files |
|---|---|
| Hero | `hero-illustration.png` |
| Logo band (marquee) | `mysecondteacher.png`, `zenledger.png`, `jelajah-ilmu.png`, `bats.png` |
| Founding engineer | `founding-engineer.png` |
| Engineers Have Shipped | `zenledger1.png`, `bats1.png`, `investready.png`, `mysecondteacher1.png` |
| Services icons | `mobile-apps.png`, `web-platforms.png`, `applied-ai.png` |
| Our Work | `new-platform-build.png`, `mobile-product-sprint.png`, `ai-workflow-layer.png` |
| Why Choose Us | `hands-on-execution.png`, `systems-thinking.png`, `visible-progress.png` |
| Capabilities | `capabilities-illustration.png` |
| Brand | `gurkha-logo.png`, `gl-monogram.png`, `gl-monogram-512.png` |
| Team | `anmol-chalise.jpg`, `manish-chalise.jpg`, `david-tamang.jpg`, `pratik-poudel.jpg`, `likhil-dahal.jpg`, `avaya.png` (pending) |
| Favicons | `gurkha-favicon.png`, `gurkha-favicon-48.png`, `gurkha-favicon-96.png`, `gurkha-favicon-192.png` |

## Still at the repo root (deliberately)

`favicon.ico` and `apple-touch-icon.png` stay at the root because browsers and
crawlers probe those well-known paths directly, independently of the `<link>` tags.
`site.webmanifest` also stays at the root and points at `assets/gl-monogram-512.png`.

## Placeholder behaviour

Slots use `.asset-slot`; if a file is ever missing, a small script at the end of
`<body>` marks it and the slot renders as a dashed box labelled with the expected
filename rather than a broken image.

## Not files

The Core Stack row and the four capability tab marks are inline SVG in
`index.html` — no assets needed.

## Known pre-existing issue

`privacy-policy.html` references `apple-icon.png`, which does not exist in the
repo (predates the assets move). Either add that file or repoint it at
`/apple-touch-icon.png`.
