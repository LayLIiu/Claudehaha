export type DiffStats = {
  additions: number
  deletions: number
}

/**
 * Keep this intentionally identical to the file diff header math: compare each
 * line at the same index, then count lines that differ on either side.
 */
export function calculateDiffStats(oldString: string, newString: string): DiffStats {
  const oldLines = oldString.split('\n')
  const newLines = newString.split('\n')
  return {
    additions: newLines.filter((line, index) => line !== (oldLines[index] ?? null)).length,
    deletions: oldLines.filter((line, index) => line !== (newLines[index] ?? null)).length,
  }
}
