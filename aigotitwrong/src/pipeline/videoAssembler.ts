import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Use bundled ffmpeg binary
if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

const TARGET_W = 1080;
const TARGET_H = 1920;
const TARGET_FPS = 30;
const CLIP_DURATION = 5; // seconds each

/**
 * Normalize a single clip to 1080x1920 @ 30fps, pad if needed, exactly CLIP_DURATION seconds.
 */
function normalizeClip(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters([
        `scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease`,
        `pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2:black`,
        `fps=${TARGET_FPS}`,
        `setsar=1`,
      ])
      .duration(CLIP_DURATION)
      .outputOptions(['-an', '-c:v libx264', '-preset fast', '-crf 23'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });
}

/**
 * Concatenate silent video clips then add audio track.
 */
function concatWithAudio(
  normalizedClips: string[],
  audioPath: string,
  outputPath: string,
  audioDurationMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Write concat list file
    const listPath = path.join(path.dirname(outputPath), 'concat_list.txt');
    const listContent = normalizedClips.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync(listPath, listContent);

    const totalVideoDuration = normalizedClips.length * CLIP_DURATION;
    const audioDurationSec = audioDurationMs / 1000;

    // If audio is longer than video, loop last clip by adjusting concat
    // We just let ffmpeg handle mismatch with shortest flag
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .input(audioPath)
      .complexFilter([
        // Loop video if audio is longer
        `[0:v]loop=${Math.ceil(audioDurationSec / totalVideoDuration)}:size=${totalVideoDuration * TARGET_FPS}:start=0,trim=duration=${audioDurationSec},setpts=PTS-STARTPTS[v]`,
        `[1:a]atrim=duration=${audioDurationSec},asetpts=PTS-STARTPTS[a]`,
      ])
      .outputOptions([
        '-map [v]',
        '-map [a]',
        '-c:v libx264',
        '-c:a aac',
        '-preset fast',
        '-crf 23',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', () => {
        fs.unlinkSync(listPath);
        resolve();
      })
      .on('error', (err) => {
        if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
        reject(err);
      })
      .run();
  });
}

export async function assembleVideo(
  clipPaths: string[],
  audioPath: string,
  outputPath: string,
  audioDurationMs: number,
  workDir: string
): Promise<string> {
  logger.info(`Assembling video from ${clipPaths.length} clips + audio`);

  // Step 1: normalize each clip
  const normalizedPaths: string[] = [];
  for (let i = 0; i < clipPaths.length; i++) {
    const normPath = path.join(workDir, `norm_${i}.mp4`);
    logger.info(`Normalizing clip ${i + 1}/${clipPaths.length}`);
    await normalizeClip(clipPaths[i], normPath);
    normalizedPaths.push(normPath);
  }

  // Step 2: concat + add audio
  logger.info(`Concatenating clips and adding audio`);
  await concatWithAudio(normalizedPaths, audioPath, outputPath, audioDurationMs);

  // Cleanup normalized intermediates
  normalizedPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });

  logger.info(`Final video: ${outputPath}`);
  return outputPath;
}
