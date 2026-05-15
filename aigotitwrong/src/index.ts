import dotenv from 'dotenv';
dotenv.config();

import { startScheduler } from './scheduler/cron';
import { runPipeline } from './pipeline';
import { logger } from './utils/logger';

const args = process.argv.slice(2);

if (args[0] === '--run-now') {
  // Manual trigger: node dist/index.js --run-now [slot]
  const slot = args[1] || 'morning';
  logger.info(`Manual run triggered for slot: ${slot}`);
  runPipeline(slot)
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Manual run failed:', err);
      process.exit(1);
    });
} else {
  // Default: start the 3x daily scheduler
  startScheduler();
}
