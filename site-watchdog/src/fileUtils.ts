import fs from 'fs';
import path from 'path';

export function readFileIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

export function listFilesRecursive(dir: string, ext: string[] = ['.tsx', '.ts', '.css']): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item.startsWith('.') || item === 'node_modules' || item === '.next' || item === 'dist') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...listFilesRecursive(fullPath, ext));
    } else if (ext.some(e => item.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Compress file content for AI prompts — SAFE compression only.
 * Only collapses excess blank lines (no comment stripping, no reordering).
 * This keeps the content identical to the real file except for whitespace,
 * so AI-generated oldContent snippets will still match the actual file.
 */
export function compressContent(content: string, maxChars: number): string {
  // Collapse 3+ consecutive blank lines to 1 (safe — doesn't change tokens)
  let c = content.replace(/\n{3,}/g, '\n\n');
  // Trim trailing whitespace per line
  c = c.split('\n').map(l => l.trimEnd()).join('\n').trim();
  // Simple end-truncation — keeps the start (imports + config) intact
  return c.length <= maxChars ? c : c.slice(0, maxChars) + '\n// ... (truncated)';
}

/** Extract only the dependencies section from package.json (skips scripts, devDeps, etc.) */
export function getPackageDeps(packageJsonContent: string): string {
  try {
    const pkg = JSON.parse(packageJsonContent);
    const deps = pkg.dependencies || {};
    return JSON.stringify(deps, null, 2).slice(0, 600);
  } catch {
    return packageJsonContent.slice(0, 300);
  }
}

export function readSiteFiles(sitePath: string, keyFiles: string[], maxCharsPerFile = 3500): Record<string, string> {
  const contents: Record<string, string> = {};

  for (const relPath of keyFiles) {
    const fullPath = path.join(sitePath, relPath);
    const stat = fs.existsSync(fullPath) ? fs.statSync(fullPath) : null;

    if (stat?.isDirectory()) {
      // Read all tsx/ts files in the directory (limit to 4 files)
      const files = listFilesRecursive(fullPath).slice(0, 4);
      for (const f of files) {
        const rel = path.relative(sitePath, f);
        const content = readFileIfExists(f);
        if (content) contents[rel] = compressContent(content, maxCharsPerFile);
      }
    } else {
      const content = readFileIfExists(fullPath);
      if (content) contents[relPath] = compressContent(content, maxCharsPerFile);
    }
  }

  return contents;
}
