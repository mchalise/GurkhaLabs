export function parseRetryAfter(v: string | null | undefined, now = Date.now()): number | null {
  if (v == null) return null
  const t = v.trim()
  if (!t) return null
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 1000)
  const dur = t.match(/^(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?(?:(\d+)ms)?$/)
  if (dur && (dur[1] || dur[2] || dur[3]))
    return Math.round(
      Number(dur[1] ?? 0) * 60_000 + Number(dur[2] ?? 0) * 1000 + Number(dur[3] ?? 0),
    )
  const at = Date.parse(t)
  return Number.isNaN(at) ? null : Math.max(0, at - now)
}
