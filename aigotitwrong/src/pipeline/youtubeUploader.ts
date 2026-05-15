import { google } from 'googleapis';
import fs from 'fs';
import { UploadMetadata } from '../types';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
dotenv.config();

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

export async function uploadToYouTube(
  videoPath: string,
  metadata: UploadMetadata
): Promise<string> {
  logger.info(`Uploading to YouTube: ${metadata.title}`);

  const auth = getOAuthClient();
  const youtube = google.youtube({ version: 'v3', auth });

  const videoId = await withRetry(
    async () => {
      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: metadata.title.substring(0, 100),
            description: metadata.description,
            tags: metadata.tags.slice(0, 500), // YouTube tag limit
            categoryId: '23', // Comedy
            defaultLanguage: 'en',
          },
          status: {
            privacyStatus: process.env.YOUTUBE_PRIVACY || 'public',
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          mimeType: 'video/mp4',
          body: fs.createReadStream(videoPath),
        },
      });

      const id = response.data.id;
      if (!id) throw new Error('YouTube upload returned no video ID');
      return id;
    },
    { retries: 2, delay: 10000, label: 'YouTube upload' }
  );

  const url = `https://www.youtube.com/shorts/${videoId}`;
  logger.info(`Uploaded successfully: ${url}`);
  return videoId;
}
