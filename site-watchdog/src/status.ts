import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WatchdogState, WebsitesConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const state: WatchdogState = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
const config: WebsitesConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'websites.config.json'), 'utf8'));

const nextIndex = (state.lastSiteIndex + 1) % config.sites.length;
const nextSite = config.sites[nextIndex];

console.log('\n🐾 Site Watchdog Status');
console.log('═══════════════════════════════');
console.log(`Last run:   ${state.lastRunDate ? new Date(state.lastRunDate).toLocaleString() : 'Never'}`);
console.log(`Next site:  ${nextSite.name} (${nextSite.url})`);
console.log(`Sites:      ${config.sites.length} total`);
console.log('');
console.log('Recent History:');

if (state.history.length === 0) {
  console.log('  No runs yet');
} else {
  state.history.slice(0, 10).forEach(h => {
    const icon = h.status === 'success' ? '✅' : h.status === 'no-changes' ? '✨' : '❌';
    const date = new Date(h.date).toLocaleDateString();
    console.log(`  ${icon} ${date} — ${h.siteName}: ${h.status}`);
    if (h.deployUrl) console.log(`       → ${h.deployUrl}`);
    if (h.improvements.length > 0) {
      h.improvements.slice(0, 2).forEach(i => console.log(`       · ${i}`));
    }
  });
}

console.log('');
console.log('Scheduled sites (in order):');
config.sites.forEach((s, i) => {
  const marker = i === nextIndex ? '→ ' : '  ';
  console.log(`${marker}${i + 1}. ${s.name}`);
});
console.log('');
