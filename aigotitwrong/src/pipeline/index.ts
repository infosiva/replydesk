import path from 'path';
import fs from 'fs';
import { getNextTopic } from '../content/topics';
import { buildMetadata } from '../content/titleGenerator';
import { generateScript } from './scriptGenerator';
import { synthesizeVoice } from './voiceSynthesis';
import { generateVisuals } from './visualGenerator';
import { assembleVideo } from './videoAssembler';
import { uploadToYouTube } from './youtubeUploader';
import { trackCost } from '../utils/costTracker';
import { logger } from '../utils/logger';

const OUTPUT_BASE = path.join(process.cwd(), 'output');

export async function runPipeline(slot: string = 'morning'): Promise<void> {
  const runId = `${Date.now()}`;
  const workDir = path.join(OUTPUT_BASE, runId);
  fs.mkdirSync(workDir, { recursive: true });

  logger.info(`=== Pipeline run ${runId} (slot: ${slot}) ===`);

  try {
    // Step 1: Pick topic + generate script
    logger.info('Step 1: Generating script...');
    const topic = getNextTopic(slot);
    const script = await generateScript(topic);
    logger.info(`Script for: "${topic.subject}" | hook: "${script.hook.substring(0, 50)}..."`);

    // Step 2: Voice synthesis
    logger.info('Step 2: Synthesizing voice...');
    const audioPath = path.join(workDir, 'voice.mp3');
    const { durationMs } = await synthesizeVoice(script.fullText, audioPath);
    logger.info(`Audio duration: ${durationMs}ms`);

    // Step 3: Generate visuals (3 clips, one per scene)
    logger.info('Step 3: Generating visuals...');
    const clipPaths = await generateVisuals(script.visualPrompts, workDir);
    logger.info(`Generated ${clipPaths.length} clips`);

    // Step 4: Assemble video
    logger.info('Step 4: Assembling video...');
    const finalVideoPath = path.join(workDir, 'final.mp4');
    await assembleVideo(clipPaths, audioPath, finalVideoPath, durationMs, workDir);

    // Step 5: Upload to YouTube
    logger.info('Step 5: Uploading to YouTube...');
    const metadata = buildMetadata(script, topic);
    const videoId = await uploadToYouTube(finalVideoPath, {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
    });

    // Step 6: Track costs + cleanup
    trackCost(runId, topic.subject, durationMs);
    cleanupWorkDir(workDir, finalVideoPath);

    logger.info(`=== Pipeline complete: https://youtube.com/shorts/${videoId} ===`);
  } catch (err) {
    logger.error(`Pipeline failed for run ${runId}:`, err);
    throw err;
  }
}

function cleanupWorkDir(workDir: string, keepFinal: string): void {
  try {
    const files = fs.readdirSync(workDir);
    for (const file of files) {
      const filePath = path.join(workDir, file);
      if (filePath !== keepFinal) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    logger.warn('Cleanup error (non-fatal):', err);
  }
}
