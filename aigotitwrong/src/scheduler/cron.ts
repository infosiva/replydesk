import cron from 'node-cron';
import { runPipeline } from '../pipeline';
import { logger } from '../utils/logger';

// IST = UTC+5:30
// 8am IST  = 2:30 UTC  → cron: 30 2 * * *
// 2pm IST  = 8:30 UTC  → cron: 30 8 * * *
// 8pm IST  = 14:30 UTC → cron: 30 14 * * *

const SLOTS: Array<{ cron: string; slot: string }> = [
  { cron: '30 2 * * *', slot: 'morning' },
  { cron: '30 8 * * *', slot: 'afternoon' },
  { cron: '30 14 * * *', slot: 'evening' },
];

export function startScheduler(): void {
  logger.info('Starting AIGotItWrong scheduler (3x daily)');

  for (const { cron: schedule, slot } of SLOTS) {
    cron.schedule(
      schedule,
      async () => {
        logger.info(`Cron triggered: slot=${slot}`);
        try {
          await runPipeline(slot);
        } catch (err) {
          logger.error(`Cron job failed for slot=${slot}:`, err);
          // Don't rethrow — keep scheduler alive
        }
      },
      { timezone: 'UTC' }
    );
    logger.info(`Scheduled slot "${slot}" at ${schedule} UTC`);
  }

  logger.info('Scheduler running. Waiting for next trigger...');
}

// Keep process alive
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down scheduler gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down scheduler gracefully');
  process.exit(0);
});
