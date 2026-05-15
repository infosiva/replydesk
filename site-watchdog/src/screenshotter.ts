import fs from 'fs';
import path from 'path';

export async function screenshotUrl(url: string, outputPath: string): Promise<boolean> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    // Try Playwright first (works best on VPS — bundled Chromium)
    const pw = await import('playwright-core').catch(() => null);
    if (pw) {
      const browser = await pw.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 800 });
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
        await new Promise(r => setTimeout(r, 1500));
      } catch {
        await page.goto(url, { waitUntil: 'load', timeout: 15000 });
      }
      await page.screenshot({ path: outputPath as `${string}.png`, clip: { x: 0, y: 0, width: 1280, height: 800 } });
      await browser.close();
      console.log(`  📸 Screenshot saved: ${path.basename(outputPath)}`);
      return true;
    }

    // Fallback: puppeteer-core with system Chrome
    const puppeteer = await import('puppeteer-core').catch(() => null);
    if (puppeteer) {
      const chromePaths = [
        '/usr/bin/google-chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ];
      const executablePath = chromePaths.find(p => fs.existsSync(p));
      if (!executablePath) throw new Error('No Chrome found for puppeteer-core');

      const browser = await puppeteer.default.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url, { waitUntil: 'load', timeout: 20000 });
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: 1280, height: 800 } });
      await browser.close();
      console.log(`  📸 Screenshot saved: ${path.basename(outputPath)}`);
      return true;
    }

    console.log('  📸 Screenshot skipped — no browser available');
    return false;
  } catch (e: any) {
    console.log(`  📸 Screenshot failed: ${e.message?.slice(0, 80)}`);
    return false;
  }
}

export function screenshotDir(logDir: string): string {
  const dir = path.join(logDir, 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
