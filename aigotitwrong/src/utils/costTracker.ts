import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { CostEntry } from '../types';

// Free tier stack cost breakdown:
// - Gemini Imagen 3: FREE (up to 1500 requests/day on free tier)
// - ElevenLabs eleven_v3: FREE up to 10k chars/mo (~20 videos), then $0.15/1k chars
// - Claude Haiku: ~$0.015/video (not free but tiny)
// - FFmpeg: free/local
// Monthly estimate at 90 videos: ~$1.35 Claude only, until ElevenLabs free tier runs out

export async function trackCost(jobId: string, topic: string, audioDurationMs: number): Promise<void> {
  const wordCount = (audioDurationMs / 1000 / 60) * 150;
  const charCount = wordCount * 5;

  const costs: CostEntry = {
    jobId,
    topic,
    timestamp: new Date().toISOString(),
    costs: {
      claudeApi: 0.015,           // Haiku — cheapest model
      elevenlabs: (charCount / 1000) * 0.15, // $0 until 10k chars/mo free tier exhausted
      falAiKling: 0,              // Replaced with Gemini Imagen (free)
      falAiFlux: 0,               // Not used
      total: 0,
    },
  };

  costs.costs.total = costs.costs.claudeApi + costs.costs.elevenlabs;

  logger.info(`COST_TRACK job=${jobId} topic="${topic}" total=$${costs.costs.total.toFixed(4)}`);

  const logsDir = path.join(process.cwd(), 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  fs.appendFileSync(path.join(logsDir, 'costs.log'), JSON.stringify(costs) + '\n');
}
