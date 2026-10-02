// Spend guard. Every paid call goes through reserve() first; the ledger is a
// small JSON file (gitignored) so the cap survives across runs.
//
//   VENICE_BUDGET_CAP  cap in USD (Venice quotes are USD). Default 500.
//   --cap <n>          same, per run
//
// Nothing is submitted once cumulative reserved + new quote would exceed the
// cap — the script exits 2 with the number that would have tipped it over.
import fs from 'node:fs'
import path from 'node:path'

const LEDGER = path.resolve(process.cwd(), 'tools/venice/spend-ledger.json')

export interface LedgerEntry {
  ts: string
  label: string
  usd: number
  status: 'reserved' | 'spent' | 'refunded'
}
interface Ledger {
  entries: LedgerEntry[]
}

export function readLedger(): Ledger {
  try {
    return JSON.parse(fs.readFileSync(LEDGER, 'utf8')) as Ledger
  } catch {
    return { entries: [] }
  }
}
function writeLedger(l: Ledger) {
  fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2) + '\n')
}

export function cap(argv = process.argv): number {
  const i = argv.indexOf('--cap')
  if (i >= 0 && argv[i + 1]) return Number(argv[i + 1])
  return Number(process.env.VENICE_BUDGET_CAP ?? 15)
}

export function spent(): number {
  return readLedger()
    .entries.filter((e) => e.status !== 'refunded')
    .reduce((s, e) => s + e.usd, 0)
}

/** Reserve `usd` for `label`. Throws (exit 2) when the cap would be exceeded. */
export function reserve(usd: number, label: string, argv = process.argv): LedgerEntry {
  if (!Number.isFinite(usd) || usd < 0) throw new Error(`bad quote for ${label}: ${usd}`)
  const limit = cap(argv)
  const already = spent()
  if (already + usd > limit) {
    console.error(
      `✋ budget cap: ${already.toFixed(2)} already + ${usd.toFixed(2)} for "${label}" > cap ${limit.toFixed(2)} USD. Nothing submitted.`,
    )
    process.exit(2)
  }
  const l = readLedger()
  const e: LedgerEntry = { ts: new Date().toISOString(), label, usd, status: 'reserved' }
  l.entries.push(e)
  writeLedger(l)
  console.log(
    `💳 reserved ${usd.toFixed(2)} USD for "${label}" — ${(already + usd).toFixed(2)} / ${limit.toFixed(2)} used`,
  )
  return e
}

export function settle(entry: LedgerEntry, status: 'spent' | 'refunded') {
  const l = readLedger()
  const hit = l.entries.find((e) => e.ts === entry.ts && e.label === entry.label)
  if (hit) hit.status = status
  writeLedger(l)
}

export function report() {
  const limit = cap()
  const used = spent()
  console.log(`📒 ledger: ${used.toFixed(2)} / ${limit.toFixed(2)} USD used (${LEDGER})`)
}
