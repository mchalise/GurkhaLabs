// Loads `.env` from the repo root into process.env (no dotenv dependency —
// Node ≥ 21.7 ships process.loadEnvFile). Existing env vars win, so
// `VENICE_API_KEY=... npm run venice:test` still overrides the file.
import fs from 'node:fs'
import path from 'node:path'

export function loadEnv(): void {
  const file = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(file)) return
  const before = { ...process.env }
  try {
    process.loadEnvFile(file)
  } catch {
    // very old Node — minimal fallback parser
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1)
      process.env[m[1]] ??= v
    }
  }
  // restore anything the shell had already set
  for (const [k, v] of Object.entries(before)) if (v !== undefined) process.env[k] = v
}

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `${name} is not set. Add it to .env (gitignored) — see .env.example — or export it in the shell.`,
    )
  }
  return v
}
