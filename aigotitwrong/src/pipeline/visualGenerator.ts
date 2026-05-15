import { GoogleGenerativeAI } from '@google/generative-ai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const TARGET_W = 1080;
const TARGET_H = 1920;
const CLIP_DURATION = 5; // seconds per scene

// Ken Burns effect variants — different motion per scene for visual variety
const KB_EFFECTS = [
  // Slow zoom in from centre
  `zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${CLIP_DURATION * 30}:s=${TARGET_W}x${TARGET_H}`,
  // Pan left to right + slight zoom
  `zoompan=z='1.15':x='if(gte(on,1),x+1.2,iw/4)':y='ih/2-(ih/zoom/2)':d=${CLIP_DURATION * 30}:s=${TARGET_W}x${TARGET_H}`,
  // Zoom out from top-right
  `zoompan=z='if(gte(on,1),max(zoom-0.001,1.0),1.25)':x='iw*0.6-(iw/zoom/2)':y='ih*0.2-(ih/zoom/2)':d=${CLIP_DURATION * 30}:s=${TARGET_W}x${TARGET_H}`,
];

async function generateImage(prompt: string, outputPath: string): Promise<string> {
  logger.info(`Generating image: ${prompt.substring(0, 60)}...`);

  // Gemini Imagen 3 via generateContent with image output
  const model = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-001' });

  const result = await withRetry(
    async () => {
      const response = await (model as any).generateImages({
        prompt: `Vertical portrait photo, 9:16 aspect ratio. ${prompt}. Cinematic lighting, high detail, photorealistic.`,
        number_of_images: 1,
        aspect_ratio: '9:16',
        safety_filter_level: 'block_few',
        person_generation: 'allow_adult',
      });
      return response;
    },
    { retries: 3, delay: 3000, label: 'Gemini Imagen' }
  );

  const imageData = result.generatedImages[0].image.imageBytes;
  const buffer = Buffer.from(imageData, 'base64');
  fs.writeFileSync(outputPath, buffer);
  logger.info(`Image saved: ${outputPath} (${buffer.length} bytes)`);
  return outputPath;
}

function applyKenBurns(
  imagePath: string,
  outputPath: string,
  effectIndex: number
): Promise<void> {
  const effect = KB_EFFECTS[effectIndex % KB_EFFECTS.length];

  return new Promise((resolve, reject) => {
    ffmpeg(imagePath)
      .loop(CLIP_DURATION)
      .videoFilters([
        // Scale up so we have room to pan/zoom without black bars
        `scale=${TARGET_W * 2}:${TARGET_H * 2}:flags=lanczos`,
        effect,
        `scale=${TARGET_W}:${TARGET_H}`,
        `setsar=1`,
        `fps=30`,
      ])
      .outputOptions([
        '-t', String(CLIP_DURATION),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-an',
        '-pix_fmt', 'yuv420p',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });
}

export async function generateVisuals(
  prompts: string[],
  outputDir: string
): Promise<string[]> {
  fs.mkdirSync(outputDir, { recursive: true });

  const clipPaths: string[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const imagePath = path.join(outputDir, `scene_${i}.jpg`);
    const clipPath = path.join(outputDir, `clip_${i}.mp4`);

    // Generate still image with Gemini Imagen (free)
    await generateImage(prompts[i], imagePath);

    // Apply Ken Burns motion effect with FFmpeg
    logger.info(`Applying Ken Burns effect ${i + 1}/${prompts.length}`);
    await applyKenBurns(imagePath, clipPath, i);

    // Clean up source image
    try { fs.unlinkSync(imagePath); } catch {}

    clipPaths.push(clipPath);
  }

  logger.info(`Generated ${clipPaths.length} animated clips`);
  return clipPaths;
}
