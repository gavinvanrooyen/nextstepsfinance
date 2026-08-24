import { google } from 'googleapis';

function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Downloads a Drive file's raw bytes into memory.
 * Fine for typical short-form/long-form export sizes; if files start
 * regularly exceeding a few hundred MB, switch this to a streamed
 * pipe straight into the upload call instead of buffering fully in memory.
 *
 * @param {string} fileId - the driveFileId field stored on the Sanity record
 * @returns {Promise<Buffer>}
 */
export async function getDriveFileBuffer(fileId) {
  const drive = getDriveClient();

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(res.data);
}
