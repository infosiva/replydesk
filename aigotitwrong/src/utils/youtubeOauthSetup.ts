/**
 * Run once: node dist/utils/youtubeOauthSetup.js
 * Follow the URL, paste the code, refresh_token printed to console — add to .env
 */
import { google } from 'googleapis';
import readline from 'readline';
import dotenv from 'dotenv';
dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube'];

const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
console.log('\n=== YouTube OAuth Setup ===');
console.log('1. Open this URL in your browser:');
console.log(authUrl);
console.log('\n2. Authorize the app and paste the code below:\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste code here: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Success! Add this to your .env:');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (err) {
    console.error('Failed to get tokens:', err);
  }
  rl.close();
});
