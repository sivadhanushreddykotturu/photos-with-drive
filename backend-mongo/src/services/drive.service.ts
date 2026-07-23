import type { Readable } from 'node:stream'
import { google, type drive_v3 } from 'googleapis'
import { ConnectedAccount, type ConnectedAccountDocument } from '../models/ConnectedAccount.js'
import { env } from '../config/env.js'
import { decryptText, encryptText } from './encryption.service.js'

export type GoogleOAuth2Client = InstanceType<typeof google.auth.OAuth2>

export const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
export const APP_FOLDER_NAME = '9drive'

const DRIVE_FILE_FIELDS =
  'id,name,mimeType,size,thumbnailLink,imageMediaMetadata(width,height),videoMediaMetadata(durationMillis),createdTime'

export function createOAuthClient() {
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI)
}

export function generateConnectUrl(state: string) {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: env.GOOGLE_SCOPES,
    state,
  })
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.access_token) throw new Error('Google did not return an access token.')
  return { client, tokens }
}

export async function getGoogleAccountEmail(auth: GoogleOAuth2Client) {
  const oauth2 = google.oauth2({ version: 'v2', auth })
  const profile = await oauth2.userinfo.get()
  if (!profile.data.email) throw new Error('Google profile is missing an email address.')
  return profile.data.email
}

export async function getAuthedGoogleClient(account: ConnectedAccountDocument) {
  const client = createOAuthClient()
  client.setCredentials({
    access_token: decryptText(account.accessToken),
    refresh_token: decryptText(account.refreshToken),
    expiry_date: account.tokenExpiresAt.getTime(),
  })

  if (account.tokenExpiresAt.getTime() < Date.now() + 60_000) {
    const result = await client.refreshAccessToken()
    const credentials = result.credentials
    if (credentials.access_token) {
      account.accessToken = encryptText(credentials.access_token)
      account.tokenExpiresAt = new Date(credentials.expiry_date ?? Date.now() + 3600_000)
      await account.save()
      client.setCredentials(credentials)
    }
  }

  return client
}

export async function syncGoogleQuota(accountId: string) {
  const account = await ConnectedAccount.findById(accountId).select('+accessToken +refreshToken').orFail()
  const auth = await getAuthedGoogleClient(account)
  const drive = google.drive({ version: 'v3', auth })
  const about = await drive.about.get({ fields: 'storageQuota' })
  const quota = about.data.storageQuota
  account.storageQuota = {
    total: quota?.limit ? Number(quota.limit) : null,
    used: quota?.usage ? Number(quota.usage) : 0,
  }
  account.lastSyncedAt = new Date()
  await account.save()
  return account.storageQuota
}

export async function revokeGoogleAccount(account: ConnectedAccountDocument) {
  const client = createOAuthClient()
  try {
    await client.revokeToken(decryptText(account.refreshToken))
  } catch {
    // Best-effort revoke; token may already be invalid.
  }
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export async function ensureAppFolder(auth: GoogleOAuth2Client) {
  const drive = google.drive({ version: 'v3', auth })
  const queryName = escapeDriveQueryValue(APP_FOLDER_NAME)
  const existing = await drive.files.list({
    q: `name = '${queryName}' and mimeType = '${GOOGLE_DRIVE_FOLDER_MIME_TYPE}' and 'root' in parents and trashed = false`,
    spaces: 'drive',
    fields: 'files(id,name)',
    pageSize: 1,
  })
  const folderId =
    existing.data.files?.[0]?.id ??
    (
      await drive.files.create({
        requestBody: { name: APP_FOLDER_NAME, mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE, parents: ['root'] },
        fields: 'id',
      })
    ).data.id

  if (!folderId) throw new Error('Failed to create Google Drive app folder.')
  return folderId
}

export async function uploadFileToDrive(
  auth: GoogleOAuth2Client,
  appFolderId: string,
  file: { name: string; mimeType: string; body: Readable },
) {
  const drive = google.drive({ version: 'v3', auth })
  const created = await drive.files.create({
    requestBody: { name: file.name, parents: [appFolderId] },
    media: { mimeType: file.mimeType, body: file.body },
    fields: DRIVE_FILE_FIELDS,
  })
  if (!created.data.id) throw new Error('Google Drive upload failed.')
  return created.data as drive_v3.Schema$File & { id: string }
}

export type DriveFileEntry = NonNullable<drive_v3.Schema$FileList['files']>[number]

export async function listAppFolderFiles(auth: GoogleOAuth2Client, appFolderId: string) {
  const drive = google.drive({ version: 'v3', auth })
  const files: DriveFileEntry[] = []
  let pageToken: string | undefined
  do {
    const response = await drive.files.list({
      q: `'${appFolderId}' in parents and mimeType != '${GOOGLE_DRIVE_FOLDER_MIME_TYPE}' and trashed = false`,
      spaces: 'drive',
      fields: `nextPageToken,files(${DRIVE_FILE_FIELDS})`,
      pageSize: 1000,
      pageToken,
    })
    files.push(...(response.data.files ?? []))
    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)
  return files
}

export async function renameDriveFile(auth: GoogleOAuth2Client, driveFileId: string, name: string) {
  const drive = google.drive({ version: 'v3', auth })
  await drive.files.update({ fileId: driveFileId, requestBody: { name } })
}

export async function deleteDriveFile(auth: GoogleOAuth2Client, driveFileId: string) {
  const drive = google.drive({ version: 'v3', auth })
  await drive.files.delete({ fileId: driveFileId })
}

export async function getDriveFileStream(auth: GoogleOAuth2Client, driveFileId: string) {
  const drive = google.drive({ version: 'v3', auth })
  const response = await drive.files.get({ fileId: driveFileId, alt: 'media' }, { responseType: 'stream' })
  return response.data
}
