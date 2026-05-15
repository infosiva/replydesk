import { logger } from './logger';

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delay: number; label: string }
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= options.retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`[${options.label}] Attempt ${attempt}/${options.retries} failed: ${lastError.message}`);
      if (attempt < options.retries) {
        const backoff = options.delay * Math.pow(2, attempt - 1);
        await sleep(backoff);
      }
    }
  }

  throw new Error(`[${options.label}] All ${options.retries} attempts failed. Last: ${lastError.message}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
