export function parseMigrateSummary(lines: string[]): {
  ok: string[]
  skipped: string[]
  failed: string[]
} {
  const result = { ok: [] as string[], skipped: [] as string[], failed: [] as string[] }
  for (const line of lines) {
    const ok = line.match(/OK:\s*(.+)$/)
    const skipped = line.match(/SKIPPED:\s*(.+)$/)
    const failed = line.match(/FAILED:\s*(.+)$/)
    if (ok) {
      result.ok = ok[1] === '(none)' ? [] : ok[1].trim().split(/\s+/).filter(Boolean)
    }
    if (skipped) {
      result.skipped =
        skipped[1] === '(none)' ? [] : skipped[1].trim().split(/\s+/).filter(Boolean)
    }
    if (failed) {
      result.failed =
        failed[1] === '(none)' ? [] : failed[1].trim().split(/\s+/).filter(Boolean)
    }
  }
  return result
}

export function parseBackupSummary(lines: string[]): {
  ok: string[]
  failed: string[]
} {
  const result = { ok: [] as string[], failed: [] as string[] }
  for (const line of lines) {
    const ok = line.match(/Backup OK:\s*(.+)$/i)
    const failed = line.match(/Backup FAILED:\s*(.+)$/i)
    if (ok) {
      result.ok = ok[1] === '(none)' ? [] : ok[1].trim().split(/\s+/).filter(Boolean)
    }
    if (failed) {
      result.failed =
        failed[1] === '(none)' ? [] : failed[1].trim().split(/\s+/).filter(Boolean)
    }
  }
  if (result.ok.length === 0 && result.failed.length === 0) {
    for (const line of lines) {
      const dumpOk = line.match(/Dumped\s+(\S+)/i)
      if (dumpOk) result.ok.push(dumpOk[1])
      const dumpFail = line.match(/Failed to dump\s+(\S+)/i)
      if (dumpFail) result.failed.push(dumpFail[1])
    }
  }
  return result
}

export function parseRestoreSummary(lines: string[]): {
  ok: string[]
  failed: string[]
} {
  const result = { ok: [] as string[], failed: [] as string[] }
  for (const line of lines) {
    const ok = line.match(/Restore OK:\s*(.+)$/i)
    const failed = line.match(/Restore FAILED:\s*(.+)$/i)
    if (ok) {
      result.ok = ok[1] === '(none)' ? [] : ok[1].trim().split(/\s+/).filter(Boolean)
    }
    if (failed) {
      result.failed =
        failed[1] === '(none)' ? [] : failed[1].trim().split(/\s+/).filter(Boolean)
    }
  }
  if (result.ok.length === 0 && result.failed.length === 0) {
    for (const line of lines) {
      const restored = line.match(/Restored\s+(\S+)/i)
      if (restored) result.ok.push(restored[1])
      const dropped = line.match(/Dropped\s+(\S+)/i)
      if (dropped) result.ok.push(dropped[1])
      const restoreFail = line.match(/Failed to restore\s+(\S+)/i)
      if (restoreFail) result.failed.push(restoreFail[1])
    }
  }
  return result
}

export function parseJobHeadline(
  kind: string | null,
  lines: string[]
): { ok: string[]; skipped: string[]; failed: string[] } {
  if (kind === 'migrate') {
    return parseMigrateSummary(lines)
  }
  if (kind === 'backup') {
    const { ok, failed } = parseBackupSummary(lines)
    return { ok, skipped: [], failed }
  }
  if (kind === 'restore') {
    const { ok, failed } = parseRestoreSummary(lines)
    return { ok, skipped: [], failed }
  }
  return { ok: [], skipped: [], failed: [] }
}
