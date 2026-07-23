type QuotaHolder = {
  storageQuota: { total: number | null; used: number }
}

/**
 * Pick the account with the most free space that can fit `sizeBytes`.
 * Accounts with an unknown/unlimited quota (total === null) are treated as unlimited.
 * Returns null when no account can fit the upload.
 */
export function pickUploadAccount<T extends QuotaHolder>(accounts: T[], sizeBytes: number): T | null {
  let best: T | null = null
  let bestFree = -1
  for (const account of accounts) {
    const { total, used } = account.storageQuota
    const free = total === null ? Number.MAX_SAFE_INTEGER : total - used
    if (total !== null && free < sizeBytes) continue
    if (free > bestFree) {
      best = account
      bestFree = free
    }
  }
  return best
}
