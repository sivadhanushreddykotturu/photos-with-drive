import { ZipArchive } from 'archiver'
import type { Response } from 'express'
import type { FileRecordDocument } from '../models/FileRecord.js'
import { ConnectedAccount, type ConnectedAccountDocument } from '../models/ConnectedAccount.js'
import { getAuthedGoogleClient, getDriveFileStream } from './drive.service.js'

/**
 * Streams a ZIP of Drive files straight to the response: Drive -> archiver ->
 * client, chunk by chunk. Nothing is buffered on disk or held in memory;
 * 'store' mode (no compression) since photos/videos are already compressed.
 */
export async function streamZipOfFiles(files: FileRecordDocument[], zipName: string, res: Response) {
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`)

  const archive = new ZipArchive({ store: true })
  archive.on('error', (error: Error) => {
    console.error('ZIP archive error:', error)
    res.destroy(error)
  })
  res.on('close', () => archive.destroy())
  archive.pipe(res)

  const accountCache = new Map<string, ConnectedAccountDocument>()
  const usedNames = new Map<string, number>()
  const skipped: string[] = []

  const dedupeName = (name: string) => {
    const count = usedNames.get(name) ?? 0
    usedNames.set(name, count + 1)
    if (count === 0) return name
    const dot = name.lastIndexOf('.')
    return dot === -1 ? `${name} (${count})` : `${name.slice(0, dot)} (${count})${name.slice(dot)}`
  }

  for (const file of files) {
    try {
      let account = accountCache.get(file.connectedAccountId.toString())
      if (!account) {
        const found = await ConnectedAccount.findById(file.connectedAccountId).select('+accessToken +refreshToken')
        if (!found) throw new Error('account missing')
        account = found
        accountCache.set(file.connectedAccountId.toString(), account)
      }
      const auth = await getAuthedGoogleClient(account)
      const stream = await getDriveFileStream(auth, file.driveFileId)
      archive.append(stream, { name: dedupeName(file.name) })
    } catch (error) {
      console.error(`ZIP: skipping ${file._id.toString()} (${file.name}):`, error)
      skipped.push(file.name)
    }
  }

  if (skipped.length > 0) {
    archive.append(`The following files could not be fetched and were skipped:\n\n${skipped.join('\n')}\n`, {
      name: '-skipped.txt',
    })
  }

  await archive.finalize()
}
