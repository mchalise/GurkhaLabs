# Venice AI — Gurkha Labs site art

Standalone copy of the Habre Care Venice client (client / budget / media / env). Own key, own ledger.

- Key: `.env` at the repo root → `VENICE_API_KEY=...` (gitignored)
- Ledger: `tools/venice/spend-ledger.json` (gitignored). Cap **15 USD** (`VENICE_BUDGET_CAP` / `--cap`).
- Raw output: `tools/venice/out/` (gitignored). Adopted, compressed assets go to `assets/art/`.

## Run (on the Mac, from the GurkhaLabs folder)

```bash
npm install                                     # once (tsx)
npm run venice:site -- --dry-run                # prices everything, spends nothing (~$4.94 for stills)
npm run venice:site                             # stills: 2 candidates per job + contact.png per set
# review tools/venice/out/*/contact.png, then pick candidates for the loops:
npm run venice:site -- --animate --pick sky=1,build=2,agentic=1,mobile=2 --dry-run
npm run venice:site -- --animate --pick sky=1,build=2,agentic=1,mobile=2
```

Flags: `--set hero|ascent|engage|kathmandu`, `--only sky,mid`, `--n 3`, `--force`, `--model`, `--edit-model`, `--vmodel`, `--cap`.
Everything is resume-safe: existing candidates / loops are skipped unless `--force`.
